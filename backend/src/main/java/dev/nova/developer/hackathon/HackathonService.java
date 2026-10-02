package dev.nova.developer.hackathon;

import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.Exam;
import dev.nova.academics.exam.ExamRepository;
import dev.nova.academics.resource.WebLinks;
import dev.nova.common.web.ApiException;
import dev.nova.developer.hackathon.HackathonDtos.DeadlineResponse;
import dev.nova.developer.hackathon.HackathonDtos.ExamClash;
import dev.nova.developer.hackathon.HackathonDtos.HackathonRequest;
import dev.nova.developer.hackathon.HackathonDtos.HackathonResponse;
import dev.nova.developer.project.Project;
import dev.nova.developer.project.ProjectRepository;
import dev.nova.planner.task.TaskRepository;
import dev.nova.user.UserClock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Hackathons, with the deadline that matters for their status and any exams that clash. */
@Service
public class HackathonService {

    static final int MAX_HACKATHONS = 100;
    private static final String LINK_MESSAGE = "Use a full web address starting with http:// or https://.";

    private final HackathonRepository hackathons;
    private final ProjectRepository projects;
    private final ExamRepository exams;
    private final CourseRepository courses;
    private final TaskRepository tasks;
    private final UserClock userClock;

    public HackathonService(
            HackathonRepository hackathons,
            ProjectRepository projects,
            ExamRepository exams,
            CourseRepository courses,
            TaskRepository tasks,
            UserClock userClock) {
        this.hackathons = hackathons;
        this.projects = projects;
        this.exams = exams;
        this.courses = courses;
        this.tasks = tasks;
        this.userClock = userClock;
    }

    /** Upcoming (by start date) before past (most recent first); {@code statuses} empty means all. */
    @Transactional(readOnly = true)
    public List<HackathonResponse> list(UUID userId, Collection<HackathonStatus> statuses) {
        List<Hackathon> found = statuses == null || statuses.isEmpty()
                ? hackathons.findByUserId(userId)
                : hackathons.findByUserIdAndStatusIn(userId, statuses);
        return responses(userId, found).stream()
                .sorted(HackathonRules.listOrder(
                        HackathonResponse::past,
                        HackathonResponse::startsOn,
                        h -> h.endsOn() != null ? h.endsOn() : h.startsOn(),
                        HackathonResponse::createdAt))
                .toList();
    }

    @Transactional(readOnly = true)
    public HackathonResponse get(UUID userId, UUID hackathonId) {
        return responses(userId, List.of(require(userId, hackathonId))).getFirst();
    }

    @Transactional
    public HackathonResponse create(UUID userId, HackathonRequest request) {
        if (hackathons.countByUserId(userId) >= MAX_HACKATHONS) {
            throw ApiException.ruleViolation("name", "You can have up to " + MAX_HACKATHONS + " hackathons.");
        }
        Hackathon hackathon = new Hackathon(userId);
        hackathon.edit(details(userId, request));
        hackathons.saveAndFlush(hackathon);
        return get(userId, hackathon.getId());
    }

    @Transactional
    public HackathonResponse update(UUID userId, UUID hackathonId, HackathonRequest request) {
        Hackathon hackathon = require(userId, hackathonId);
        hackathon.edit(details(userId, request));
        hackathons.flush();
        return get(userId, hackathonId);
    }

    /** Linked tasks stay and lose the link; a linked project is untouched. */
    @Transactional
    public void delete(UUID userId, UUID hackathonId) {
        hackathons.delete(require(userId, hackathonId));
    }

    // ───────────── helpers ─────────────

    private Hackathon.Details details(UUID userId, HackathonRequest r) {
        if (r.endsOn() != null && r.startsOn() == null) {
            throw ApiException.invalidField("startsOn", "Add the start date too.");
        }
        if (r.endsOn() != null && r.endsOn().isBefore(r.startsOn())) {
            throw ApiException.invalidField("endsOn", "The end date can’t be before the start date.");
        }
        Instant registration = instant(r.registrationDeadline());
        Instant submission = instant(r.submissionDeadline());
        if (registration != null && submission != null && registration.isAfter(submission)) {
            throw ApiException.invalidField(
                    "registrationDeadline", "Registration should close before submissions do.");
        }
        UUID projectId = r.projectId() == null
                ? null
                : projects.findByIdAndUserId(r.projectId(), userId)
                        .map(Project::getId)
                        .orElseThrow(() -> ApiException.invalidField("projectId", "Choose one of your projects."));
        return new Hackathon.Details(
                r.name().strip(),
                blankToNull(r.organizer()),
                r.mode(),
                blankToNull(r.location()),
                link("websiteUrl", r.websiteUrl()),
                r.startsOn(),
                r.endsOn(),
                registration,
                submission,
                r.status() == null ? HackathonStatus.INTERESTED : r.status(),
                blankToNull(r.teamName()),
                blankToNull(r.teamMembers()),
                projectId,
                blankToNull(r.result()),
                link("repoUrl", r.repoUrl()),
                link("demoUrl", r.demoUrl()),
                link("certificateUrl", r.certificateUrl()),
                blankToNull(r.notes()));
    }

    private static Instant instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }

    /** Empty means no link; anything else must be a full http(s) address. */
    private static String link(String field, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return WebLinks.normalize(raw).orElseThrow(() -> ApiException.invalidField(field, LINK_MESSAGE));
    }

    private Hackathon require(UUID userId, UUID hackathonId) {
        return hackathons.findByIdAndUserId(hackathonId, userId).orElseThrow(ApiException::notFound);
    }

    /** One project, task-count, exam and course lookup for the whole batch. */
    private List<HackathonResponse> responses(UUID userId, List<Hackathon> batch) {
        if (batch.isEmpty()) {
            return List.of();
        }
        ZoneId zone = userClock.zoneOf(userId);
        LocalDate today = userClock.today(userId);
        Instant now = userClock.now();

        List<UUID> projectIds =
                batch.stream().map(Hackathon::getProjectId).filter(Objects::nonNull).distinct().toList();
        Map<UUID, Project> projectById = projectIds.isEmpty()
                ? Map.of()
                : projects.findAllById(projectIds).stream()
                        .collect(Collectors.toMap(Project::getId, Function.identity()));
        Map<UUID, Long> openTasks = tasks.countOpenByHackathon(userId, batch.stream().map(Hackathon::getId).toList())
                .stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));

        // Exams near any upcoming, dated hackathon in the batch
        List<Hackathon> dated = batch.stream()
                .filter(h -> h.getStartsOn() != null
                        && !HackathonRules.isPast(h.getStatus(), h.lastDay(), today))
                .toList();
        List<Exam> nearby = List.of();
        Map<UUID, Course> courseById = Map.of();
        if (!dated.isEmpty()) {
            LocalDate from = dated.stream().map(Hackathon::getStartsOn).min(Comparator.naturalOrder()).orElseThrow()
                    .minusDays(HackathonRules.CLASH_MARGIN_DAYS);
            LocalDate to = dated.stream().map(Hackathon::lastDay).max(Comparator.naturalOrder()).orElseThrow()
                    .plusDays(HackathonRules.CLASH_MARGIN_DAYS + 1L);
            nearby = exams.findByUserIdAndStartsAtGreaterThanEqualAndStartsAtLessThan(
                    userId, from.atStartOfDay(zone).toInstant(), to.atStartOfDay(zone).toInstant());
            List<UUID> courseIds = nearby.stream().map(Exam::getCourseId).distinct().toList();
            courseById = courseIds.isEmpty()
                    ? Map.of()
                    : courses.findAllById(courseIds).stream()
                            .collect(Collectors.toMap(Course::getId, Function.identity()));
        }
        List<Exam> examList = nearby;
        Map<UUID, Course> examCourses = courseById;

        return batch.stream()
                .map(h -> {
                    boolean past = HackathonRules.isPast(h.getStatus(), h.lastDay(), today);
                    DeadlineResponse deadline = past
                            ? null
                            : HackathonRules.relevantDeadline(
                                            h.getStatus(), h.getRegistrationDeadline(), h.getSubmissionDeadline())
                                    .map(d -> new DeadlineResponse(d.kind(), d.at(), d.at().isBefore(now)))
                                    .orElse(null);
                    List<ExamClash> clashes = past
                            ? List.of()
                            : examList.stream()
                                    .filter(x -> HackathonRules.clashes(
                                            h.getStartsOn(), h.getEndsOn(), LocalDate.ofInstant(x.getStartsAt(), zone)))
                                    .sorted(Comparator.comparing(Exam::getStartsAt))
                                    .map(x -> {
                                        Course c = examCourses.get(x.getCourseId());
                                        return new ExamClash(
                                                x.getId(),
                                                x.getTitle(),
                                                c == null ? null : c.getCode() != null ? c.getCode() : c.getName(),
                                                LocalDate.ofInstant(x.getStartsAt(), zone));
                                    })
                                    .toList();
                    Project project = h.getProjectId() == null ? null : projectById.get(h.getProjectId());
                    return new HackathonResponse(
                            h.getId(),
                            h.getName(),
                            h.getOrganizer(),
                            h.getMode(),
                            h.getLocation(),
                            h.getWebsiteUrl(),
                            h.getStartsOn(),
                            h.getEndsOn(),
                            h.getRegistrationDeadline(),
                            h.getSubmissionDeadline(),
                            h.getStatus(),
                            h.getTeamName(),
                            h.getTeamMembers(),
                            h.getProjectId(),
                            project == null ? null : project.getName(),
                            h.getResult(),
                            h.getRepoUrl(),
                            h.getDemoUrl(),
                            h.getCertificateUrl(),
                            h.getNotes(),
                            past,
                            HackathonRules.daysUntil(h.getStartsOn(), today),
                            deadline,
                            clashes,
                            openTasks.getOrDefault(h.getId(), 0L),
                            h.getCreatedAt());
                })
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
