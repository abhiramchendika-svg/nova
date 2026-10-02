package dev.nova.developer.internship;

import dev.nova.academics.resource.WebLinks;
import dev.nova.common.web.ApiException;
import dev.nova.common.web.PageResponse;
import dev.nova.developer.internship.InternshipDtos.AnalyticsResponse;
import dev.nova.developer.internship.InternshipDtos.InternshipRequest;
import dev.nova.developer.internship.InternshipDtos.InternshipResponse;
import dev.nova.developer.internship.InternshipDtos.StatusChange;
import dev.nova.developer.internship.InternshipRules.Entry;
import dev.nova.planner.task.TaskRepository;
import dev.nova.user.UserClock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Internship applications, their status history, and the analytics derived from it. */
@Service
public class InternshipService {

    static final int MAX_APPLICATIONS = 1000;
    /** Most recently applied first; saved ones (no applied date) after them; then newest first. */
    private static final Sort ORDER = Sort.by(
            Sort.Order.desc("appliedOn").nullsLast(), Sort.Order.desc("createdAt"), Sort.Order.asc("id"));

    private final InternshipRepository internships;
    private final InternshipEventRepository events;
    private final TaskRepository tasks;
    private final UserClock userClock;

    public InternshipService(
            InternshipRepository internships,
            InternshipEventRepository events,
            TaskRepository tasks,
            UserClock userClock) {
        this.internships = internships;
        this.events = events;
        this.tasks = tasks;
        this.userClock = userClock;
    }

    /** A page in list order; {@code statuses} empty means all. */
    @Transactional(readOnly = true)
    public PageResponse<InternshipResponse> list(
            UUID userId, Collection<InternshipStatus> statuses, int page, int size) {
        PageResponse.validate(page, size);
        PageRequest request = PageRequest.of(page, size, ORDER);
        Page<Internship> found = statuses == null || statuses.isEmpty()
                ? internships.findByUserId(userId, request)
                : internships.findByUserIdAndStatusIn(userId, statuses, request);
        Map<UUID, InternshipResponse> byId = responses(userId, found.getContent()).stream()
                .collect(Collectors.toMap(InternshipResponse::id, r -> r));
        return PageResponse.of(found, i -> byId.get(i.getId()));
    }

    @Transactional(readOnly = true)
    public InternshipResponse get(UUID userId, UUID id) {
        return responses(userId, List.of(require(userId, id))).getFirst();
    }

    /** Every application still in play (not rejected or withdrawn), for Home and the calendar. */
    @Transactional(readOnly = true)
    public List<Internship> open(UUID userId) {
        return internships.findByUserIdAndStatusIn(userId, EnumSet.complementOf(
                EnumSet.of(InternshipStatus.REJECTED, InternshipStatus.WITHDRAWN)));
    }

    @Transactional
    public InternshipResponse create(UUID userId, InternshipRequest request) {
        if (internships.countByUserId(userId) >= MAX_APPLICATIONS) {
            throw ApiException.ruleViolation(
                    "company", "You can have up to " + MAX_APPLICATIONS + " applications.");
        }
        InternshipStatus status = request.status() == null ? InternshipStatus.APPLIED : request.status();
        Internship internship = new Internship(userId, status);
        internship.edit(details(request), userClock.today(userId));
        internships.saveAndFlush(internship);
        events.saveAndFlush(new InternshipEvent(userId, internship.getId(), null, status, userClock.now()));
        return get(userId, internship.getId());
    }

    @Transactional
    public InternshipResponse update(UUID userId, UUID id, InternshipRequest request) {
        Internship internship = require(userId, id);
        LocalDate today = userClock.today(userId);
        internship.edit(details(request), today);
        if (request.status() != null) {
            move(userId, internship, request.status(), today);
        }
        internships.flush();
        return get(userId, id);
    }

    /** Moves an application to another stage and records it; the same status changes nothing. */
    @Transactional
    public InternshipResponse changeStatus(UUID userId, UUID id, InternshipStatus status) {
        Internship internship = require(userId, id);
        move(userId, internship, status, userClock.today(userId));
        internships.flush();
        return get(userId, id);
    }

    /** History goes with it (cascade); linked tasks stay and lose the link. */
    @Transactional
    public void delete(UUID userId, UUID id) {
        internships.delete(require(userId, id));
    }

    /** {@code month} is "YYYY-MM"; null means this month in the user's timezone. */
    @Transactional(readOnly = true)
    public AnalyticsResponse analytics(UUID userId, String month) {
        YearMonth ym;
        try {
            ym = month == null || month.isBlank() ? YearMonth.from(userClock.today(userId)) : YearMonth.parse(month);
        } catch (DateTimeParseException e) {
            throw ApiException.invalidField("month", "Use a month like 2026-09.");
        }
        Map<UUID, Set<InternshipStatus>> reached = events.findByUserId(userId).stream()
                .collect(Collectors.groupingBy(
                        InternshipEvent::getApplicationId,
                        Collectors.mapping(InternshipEvent::getToStatus, Collectors.toSet())));
        List<Entry> entries = internships.findByUserId(userId).stream()
                .map(i -> new Entry(i.getAppliedOn(), i.getStatus(), reached.getOrDefault(i.getId(), Set.of())))
                .toList();
        InternshipRules.Month m = InternshipRules.month(entries, ym);
        return new AnalyticsResponse(
                ym.toString(),
                m.applied(),
                m.assessments(),
                m.interviews(),
                m.offers(),
                m.rejected(),
                m.responseRate(),
                InternshipRules.funnel(entries));
    }

    // ───────────── helpers ─────────────

    private void move(UUID userId, Internship internship, InternshipStatus status, LocalDate today) {
        InternshipStatus previous = internship.moveTo(status, today);
        if (previous != status) {
            events.save(new InternshipEvent(userId, internship.getId(), previous, status, userClock.now()));
        }
    }

    private static Internship.Details details(InternshipRequest r) {
        return new Internship.Details(
                r.company().strip(),
                r.role().strip(),
                blankToNull(r.location()),
                link(r.jobUrl()),
                blankToNull(r.source()),
                r.appliedOn(),
                instant(r.deadlineAt()),
                blankToNull(r.nextStep()),
                instant(r.nextStepAt()),
                blankToNull(r.resumeVersion()),
                blankToNull(r.notes()));
    }

    private static Instant instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }

    private static String link(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return WebLinks.normalize(raw)
                .orElseThrow(() -> ApiException.invalidField(
                        "jobUrl", "Use a full web address starting with http:// or https://."));
    }

    private Internship require(UUID userId, UUID id) {
        return internships.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
    }

    /** One history query and one task count for the batch, in the batch's order. */
    private List<InternshipResponse> responses(UUID userId, List<Internship> batch) {
        if (batch.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = batch.stream().map(Internship::getId).toList();
        Map<UUID, List<StatusChange>> history =
                events.findByUserIdAndApplicationIdInOrderByChangedAtAscIdAsc(userId, ids).stream()
                        .collect(Collectors.groupingBy(
                                InternshipEvent::getApplicationId,
                                Collectors.mapping(
                                        e -> new StatusChange(e.getFromStatus(), e.getToStatus(), e.getChangedAt()),
                                        Collectors.toList())));
        Map<UUID, Long> openTasks = tasks.countOpenByInternship(userId, ids).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
        Instant now = userClock.now();
        return batch.stream()
                .map(i -> new InternshipResponse(
                        i.getId(),
                        i.getCompany(),
                        i.getRole(),
                        i.getLocation(),
                        i.getJobUrl(),
                        i.getSource(),
                        i.getStatus(),
                        i.getAppliedOn(),
                        i.getDeadlineAt(),
                        InternshipRules.deadlineMatters(i.getStatus())
                                && i.getDeadlineAt() != null
                                && i.getDeadlineAt().isBefore(now),
                        i.getNextStep(),
                        i.getNextStepAt(),
                        i.getResumeVersion(),
                        i.getNotes(),
                        openTasks.getOrDefault(i.getId(), 0L),
                        history.getOrDefault(i.getId(), List.of()),
                        i.getCreatedAt(),
                        i.getUpdatedAt()))
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
