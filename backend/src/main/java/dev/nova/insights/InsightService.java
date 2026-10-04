package dev.nova.insights;

import dev.nova.academics.assignment.Assignment;
import dev.nova.academics.assignment.AssignmentRepository;
import dev.nova.academics.assignment.AssignmentStatus;
import dev.nova.academics.attendance.AttendanceCalculator.Status;
import dev.nova.academics.attendance.AttendanceDtos.CourseAttendance;
import dev.nova.academics.attendance.AttendanceRecordRepository;
import dev.nova.academics.attendance.AttendanceService;
import dev.nova.academics.attendance.AttendanceStatus;
import dev.nova.academics.attendance.StatusCount;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.ExamService;
import dev.nova.common.web.ApiException;
import dev.nova.developer.github.GitHubAccount;
import dev.nova.developer.github.GitHubAccountRepository;
import dev.nova.developer.github.ContributionDayRepository;
import dev.nova.developer.hackathon.HackathonService;
import dev.nova.developer.internship.InternshipRules;
import dev.nova.developer.internship.InternshipService;
import dev.nova.developer.project.Milestone;
import dev.nova.developer.project.MilestoneRepository;
import dev.nova.developer.project.Project;
import dev.nova.developer.project.ProjectRepository;
import dev.nova.developer.project.ProjectStatus;
import dev.nova.insights.InsightDtos.Charts;
import dev.nova.insights.InsightDtos.InsightsResponse;
import dev.nova.insights.InsightRules.AssignmentIn;
import dev.nova.insights.InsightRules.AttendanceIn;
import dev.nova.insights.InsightRules.Context;
import dev.nova.insights.InsightRules.ExamIn;
import dev.nova.insights.InsightRules.Findings;
import dev.nova.insights.InsightRules.HackathonIn;
import dev.nova.insights.InsightRules.MonthRate;
import dev.nova.insights.InsightRules.ProjectIn;
import dev.nova.insights.InsightRules.TaskIn;
import dev.nova.insights.InsightRules.Window;
import dev.nova.planner.task.Task;
import dev.nova.planner.task.TaskRepository;
import dev.nova.planner.task.TaskStatus;
import dev.nova.user.UserClock;
import dev.nova.user.UserSettings;
import dev.nova.user.UserSettingsRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gathers the user's data for {@link InsightRules} and runs them for a window (this week, from the
 * user's week start, or this month), always ending today in the user's timezone. Read-only; nothing
 * is stored, so insights always match the data they cite.
 */
@Service
public class InsightService {

    private static final Set<AssignmentStatus> OPEN = Set.of(AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS);
    /** How far ahead the deadlines chart looks. */
    static final int CHART_DAYS = 14;

    private final TaskRepository tasks;
    private final AssignmentRepository assignments;
    private final CourseRepository courses;
    private final ExamService exams;
    private final AttendanceService attendance;
    private final AttendanceRecordRepository records;
    private final HackathonService hackathons;
    private final ProjectRepository projects;
    private final MilestoneRepository milestones;
    private final InternshipService internships;
    private final GitHubAccountRepository githubAccounts;
    private final ContributionDayRepository contributionDays;
    private final UserSettingsRepository settings;
    private final UserClock userClock;

    public InsightService(
            TaskRepository tasks,
            AssignmentRepository assignments,
            CourseRepository courses,
            ExamService exams,
            AttendanceService attendance,
            AttendanceRecordRepository records,
            HackathonService hackathons,
            ProjectRepository projects,
            MilestoneRepository milestones,
            InternshipService internships,
            GitHubAccountRepository githubAccounts,
            ContributionDayRepository contributionDays,
            UserSettingsRepository settings,
            UserClock userClock) {
        this.tasks = tasks;
        this.assignments = assignments;
        this.courses = courses;
        this.exams = exams;
        this.attendance = attendance;
        this.records = records;
        this.hackathons = hackathons;
        this.projects = projects;
        this.milestones = milestones;
        this.internships = internships;
        this.githubAccounts = githubAccounts;
        this.contributionDays = contributionDays;
        this.settings = settings;
        this.userClock = userClock;
    }

    /** {@code window}: WEEK or MONTH (case-insensitive); anything else is a 400 on {@code window}. */
    public static Window parseWindow(String raw) {
        try {
            return Window.valueOf((raw == null ? "WEEK" : raw.strip()).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.invalidField("window", "Use WEEK or MONTH.");
        }
    }

    @Transactional(readOnly = true)
    public InsightsResponse insights(UUID userId, Window window) {
        ZoneId zone = userClock.zoneOf(userId);
        Instant now = userClock.now();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate from = window == Window.WEEK ? weekStart(userId, today) : today.withDayOfMonth(1);
        Context c = new Context(window, from, today, now, zone);
        Instant fromStart = from.atStartOfDay(zone).toInstant();
        Instant tomorrowStart = today.plusDays(1).atStartOfDay(zone).toInstant();
        Instant horizon = today.plusDays(CHART_DAYS).atStartOfDay(zone).toInstant();

        // Tasks: planned in the window, planned ahead (study before exams), and with deadlines ahead
        List<Task> plannedInWindow = tasks.findByUserIdAndPlannedForBetween(userId, from, today);
        List<Task> plannedAhead =
                tasks.findByUserIdAndPlannedForBetween(userId, today, today.plusDays(InsightRules.STUDY_DAYS));
        List<Task> dueAhead =
                tasks.findByUserIdAndStatusNotAndDueAtGreaterThanEqualAndDueAtLessThan(userId, TaskStatus.DONE, now, horizon);
        List<Instant> completedAt = tasks
                .findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThanOrderByCompletedAtDesc(
                        userId, TaskStatus.DONE, fromStart, tomorrowStart)
                .stream()
                .map(Task::getCompletedAt)
                .toList();
        List<TaskIn> windowTasks = plannedInWindow.stream().map(InsightService::taskIn).toList();
        List<TaskIn> deadlineTasks = dueAhead.stream().map(InsightService::taskIn).toList();
        List<TaskIn> studyTasks = plannedAhead.stream().map(InsightService::taskIn).toList();

        // Assignments: open ones due ahead, and every one due in the window so far
        List<Assignment> openAhead =
                assignments.findByUserIdAndStatusInAndDueAtGreaterThanEqualAndDueAtLessThan(userId, OPEN, now, horizon);
        List<Assignment> dueInWindow = assignments.findByUserIdAndStatusInAndDueAtGreaterThanEqualAndDueAtLessThan(
                userId, EnumSet.allOf(AssignmentStatus.class), fromStart, now);
        Map<UUID, String> courseLabel = courseLabels(
                Stream.concat(openAhead.stream(), dueInWindow.stream()).map(Assignment::getCourseId).collect(Collectors.toSet()));
        List<AssignmentIn> ahead = openAhead.stream().map(a -> assignmentIn(a, courseLabel)).toList();
        List<AssignmentIn> windowAssignments = dueInWindow.stream().map(a -> assignmentIn(a, courseLabel)).toList();

        List<ExamIn> upcomingExams = exams.list(userId, true, null).stream()
                .map(e -> new ExamIn(
                        e.id(),
                        e.title(),
                        e.courseCode() != null ? e.courseCode() : e.courseName(),
                        e.startsAt(),
                        e.prep().done(),
                        e.prep().total()))
                .toList();
        List<HackathonIn> upcomingHackathons = hackathons.list(userId, null).stream()
                .filter(h -> !h.past())
                .map(h -> new HackathonIn(h.id(), h.name(), h.startsOn(), h.endsOn()))
                .toList();

        Findings out = new Findings();
        InsightRules.busyDayClash(c, deadlineTasks, ahead, upcomingExams, upcomingHackathons, out);
        InsightRules.examPrepGap(c, upcomingExams, out);
        InsightRules.examStudyTime(c, upcomingExams, studyTasks, out);
        InsightRules.attendanceDrop(c, attendanceInputs(userId, from), out);
        InsightRules.deadlineCluster(c, deadlineTasks, ahead, out);
        InsightRules.carriedOver(c, windowTasks, out);
        InsightRules.taskCompletion(c, windowTasks, out);
        InsightRules.onTimeSubmissions(c, windowAssignments, out);
        InsightRules.stalledProjects(c, projectInputs(userId), out);
        addInternships(userId, c, out);
        addGitHub(userId, c, out);

        Charts charts = new Charts(
                InsightRules.tasksPerDay(
                        from,
                        today,
                        windowTasks,
                        completedAt.stream().map(t -> LocalDate.ofInstant(t, zone)).toList()),
                InsightRules.deadlinesPerDay(c, CHART_DAYS, deadlineTasks, ahead, upcomingExams));
        return new InsightsResponse(window.name(), from, today, out.ranked(), out.quiet(), charts);
    }

    private LocalDate weekStart(UUID userId, LocalDate today) {
        UserSettings.WeekStart start = settings.findById(userId)
                .map(UserSettings::getWeekStart)
                .orElse(UserSettings.WeekStart.MON);
        DayOfWeek first = start == UserSettings.WeekStart.SUN ? DayOfWeek.SUNDAY : DayOfWeek.MONDAY;
        return today.with(TemporalAdjusters.previousOrSame(first));
    }

    private Map<UUID, String> courseLabels(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return courses.findAllById(ids).stream()
                .collect(Collectors.toMap(Course::getId, co -> co.getCode() != null ? co.getCode() : co.getName()));
    }

    /** Current-semester courses: counts at the start of the window (baseline + earlier records) and now. */
    private List<AttendanceIn> attendanceInputs(UUID userId, LocalDate from) {
        List<CourseAttendance> now = attendance.forSemester(userId, null);
        if (now.isEmpty()) {
            return List.of();
        }
        Map<UUID, Map<AttendanceStatus, Long>> before = new HashMap<>();
        for (StatusCount sc : records.countByStatusBefore(
                userId, now.stream().map(CourseAttendance::courseId).toList(), from)) {
            before.computeIfAbsent(sc.courseId(), k -> new HashMap<>()).put(sc.status(), sc.total());
        }
        return now.stream()
                .map(a -> {
                    Map<AttendanceStatus, Long> b = before.getOrDefault(a.courseId(), Map.of());
                    int present = b.getOrDefault(AttendanceStatus.PRESENT, 0L).intValue();
                    int absent = b.getOrDefault(AttendanceStatus.ABSENT, 0L).intValue();
                    return new AttendanceIn(
                            a.courseId(),
                            a.courseCode() != null ? a.courseCode() : a.courseName(),
                            a.baselineConducted() + present + absent,
                            a.baselineAttended() + present,
                            a.conducted(),
                            a.attended(),
                            a.status() == Status.BELOW || a.status() == Status.AT_RISK);
                })
                .toList();
    }

    private List<ProjectIn> projectInputs(UUID userId) {
        Map<UUID, Project> building = projects
                .findByUserIdAndStatusInOrderByCreatedAtDesc(userId, Set.of(ProjectStatus.DEVELOPMENT))
                .stream()
                .collect(Collectors.toMap(Project::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        if (building.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<Milestone>> byProject = milestones
                .findByUserIdAndProjectIdInOrderByDisplayOrderAsc(userId, building.keySet())
                .stream()
                .collect(Collectors.groupingBy(Milestone::getProjectId));
        return building.values().stream()
                .map(p -> {
                    List<Milestone> ms = byProject.getOrDefault(p.getId(), List.of());
                    Instant lastDone = ms.stream()
                            .map(Milestone::getDoneAt)
                            .filter(Objects::nonNull)
                            .max(Comparator.naturalOrder())
                            .orElse(null);
                    int open = (int) ms.stream().filter(m -> m.getDoneAt() == null).count();
                    return new ProjectIn(
                            p.getId(), p.getName(), open, lastDone != null ? lastDone : p.getCreatedAt(), lastDone != null);
                })
                .toList();
    }

    private void addInternships(UUID userId, Context c, Findings out) {
        List<InternshipRules.Entry> entries = internships.entries(userId);
        YearMonth thisMonth = YearMonth.from(c.today());
        InternshipRules.Rate now = InternshipRules.month(entries, thisMonth).responseRate();
        InternshipRules.Rate before = InternshipRules.month(entries, thisMonth.minusMonths(1)).responseRate();
        InsightRules.internshipResponse(
                c,
                new MonthRate(thisMonth, now.applied(), now.responded()),
                new MonthRate(thisMonth.minusMonths(1), before.applied(), before.responded()),
                !entries.isEmpty(),
                out);
    }

    /** Saved GitHub data only: insights never call GitHub. Silent when GitHub isn't connected. */
    private void addGitHub(UUID userId, Context c, Findings out) {
        GitHubAccount account = githubAccounts.findById(userId).orElse(null);
        if (account == null) {
            return;
        }
        LocalDate lastMonthStart = c.today().withDayOfMonth(1).minusMonths(1);
        List<InsightRules.ContributionDay> days = account.getContributionsFetchedAt() == null
                ? List.of()
                : contributionDays.findByUserIdAndDayBetween(userId, lastMonthStart, c.today()).stream()
                        .map(d -> new InsightRules.ContributionDay(d.getDay(), d.getCount()))
                        .toList();
        InsightRules.gitHubTrend(c, account.getContributionsFetchedAt(), days, out);
    }

    private static TaskIn taskIn(Task t) {
        return new TaskIn(
                t.getId(),
                t.getTitle(),
                t.getPlannedFor(),
                t.getDueAt(),
                t.getStatus() == TaskStatus.DONE,
                t.getEstimatedMinutes(),
                t.getExamId());
    }

    private static AssignmentIn assignmentIn(Assignment a, Map<UUID, String> courseLabel) {
        Instant handedIn = a.getSubmittedAt() != null ? a.getSubmittedAt() : a.getCompletedAt();
        return new AssignmentIn(
                a.getId(),
                a.getTitle(),
                courseLabel.get(a.getCourseId()),
                a.getCourseId(),
                a.getDueAt(),
                a.getStatus().isOpen(),
                a.getStatus().isOpen() ? null : handedIn);
    }
}
