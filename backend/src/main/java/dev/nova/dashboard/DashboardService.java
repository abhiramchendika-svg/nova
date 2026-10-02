package dev.nova.dashboard;

import dev.nova.academics.assignment.Assignment;
import dev.nova.academics.assignment.AssignmentRepository;
import dev.nova.academics.assignment.AssignmentStatus;
import dev.nova.academics.attendance.AttendanceCalculator.Status;
import dev.nova.academics.attendance.AttendanceDtos.CourseAttendance;
import dev.nova.academics.attendance.AttendanceService;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.ExamDtos.ExamSummary;
import dev.nova.academics.exam.ExamService;
import dev.nova.academics.grades.GradesDtos.GradesSummaryResponse;
import dev.nova.academics.grades.GradesDtos.SemesterGrades;
import dev.nova.academics.grades.GradesService;
import dev.nova.dashboard.DashboardDtos.AcademicsSummary;
import dev.nova.dashboard.DashboardDtos.AttentionItem;
import dev.nova.dashboard.DashboardDtos.AttentionKind;
import dev.nova.dashboard.DashboardDtos.DashboardResponse;
import dev.nova.dashboard.DashboardDtos.DeveloperSummary;
import dev.nova.dashboard.DashboardDtos.FocusGoal;
import dev.nova.dashboard.DashboardDtos.NextMilestone;
import dev.nova.dashboard.DashboardDtos.LowestAttendance;
import dev.nova.dashboard.DashboardDtos.PlannerSummary;
import dev.nova.dashboard.DashboardDtos.NextHackathon;
import dev.nova.developer.hackathon.HackathonDtos.ExamClash;
import dev.nova.developer.hackathon.HackathonDtos.HackathonResponse;
import dev.nova.developer.hackathon.HackathonRules.DeadlineKind;
import dev.nova.developer.hackathon.HackathonService;
import dev.nova.dashboard.DashboardDtos.GitHubSummary;
import dev.nova.dashboard.DashboardDtos.NextInternshipStep;
import dev.nova.developer.github.GitHubService;
import dev.nova.developer.internship.Internship;
import dev.nova.developer.internship.InternshipRules;
import dev.nova.developer.internship.InternshipService;
import dev.nova.developer.internship.InternshipStatus;
import dev.nova.developer.learning.GoalStatus;
import dev.nova.developer.learning.LearningDtos.GoalResponse;
import dev.nova.developer.learning.LearningService;
import dev.nova.developer.project.Milestone;
import dev.nova.developer.project.MilestoneRepository;
import dev.nova.developer.project.Project;
import dev.nova.developer.project.ProjectRepository;
import dev.nova.developer.project.ProjectStatus;
import dev.nova.planner.task.Task;
import dev.nova.planner.task.TaskDtos.TodayResponse;
import dev.nova.planner.task.TaskRepository;
import dev.nova.planner.task.TaskService;
import dev.nova.planner.task.TaskStatus;
import dev.nova.user.UserClock;
import dev.nova.user.UserSettings;
import dev.nova.user.UserSettingsRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Home's aggregate (docs/api.md §2.11): what needs the user, ranked by {@link PriorityScorer}, and
 * the academics and planner summary cards. Today's classes, tasks and the next 7 days come from
 * their own endpoints.
 */
@Service
public class DashboardService {

    static final int MAX_ATTENTION = 8;
    /** How far back the streak looks. */
    static final int STREAK_LOOKBACK_DAYS = 60;

    private static final Set<AssignmentStatus> OPEN =
            Set.of(AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS);
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private final AssignmentRepository assignments;
    private final TaskRepository tasks;
    private final CourseRepository courses;
    private final ExamService exams;
    private final AttendanceService attendance;
    private final GradesService grades;
    private final TaskService taskService;
    private final UserSettingsRepository settings;
    private final ProjectRepository projects;
    private final MilestoneRepository milestones;
    private final LearningService learning;
    private final HackathonService hackathons;
    private final InternshipService internships;
    private final GitHubService github;
    private final UserClock userClock;

    public DashboardService(
            AssignmentRepository assignments,
            TaskRepository tasks,
            CourseRepository courses,
            ExamService exams,
            AttendanceService attendance,
            GradesService grades,
            TaskService taskService,
            UserSettingsRepository settings,
            ProjectRepository projects,
            MilestoneRepository milestones,
            LearningService learning,
            HackathonService hackathons,
            InternshipService internships,
            GitHubService github,
            UserClock userClock) {
        this.assignments = assignments;
        this.tasks = tasks;
        this.courses = courses;
        this.exams = exams;
        this.attendance = attendance;
        this.grades = grades;
        this.taskService = taskService;
        this.settings = settings;
        this.projects = projects;
        this.milestones = milestones;
        this.learning = learning;
        this.hackathons = hackathons;
        this.internships = internships;
        this.github = github;
        this.userClock = userClock;
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(UUID userId) {
        ZoneId zone = userClock.zoneOf(userId);
        LocalDate today = userClock.today(userId);
        Instant now = userClock.now();

        GradesSummaryResponse gradeSummary = grades.summary(userId);
        SemesterGrades current = gradeSummary.semesters().stream()
                .filter(SemesterGrades::current)
                .findFirst()
                .orElse(null);
        List<CourseAttendance> attendanceRows =
                current == null ? List.of() : attendance.forSemester(userId, current.id());

        List<HackathonResponse> upcomingHackathons = hackathons.list(userId, null).stream()
                .filter(h -> !h.past())
                .toList();

        List<AttentionItem> attention = new ArrayList<>();
        addDeadlines(userId, attention, now, today, zone);
        addAttendance(attention, attendanceRows);
        addExams(userId, attention);
        addHackathons(upcomingHackathons, attention, now, today, zone);
        List<Internship> openApplications = internships.open(userId);
        addApplyBy(openApplications, attention, now, today, zone);
        List<AttentionItem> ranked = attention.stream()
                .sorted(Comparator.comparingInt(AttentionItem::score).reversed().thenComparing(AttentionItem::title))
                .limit(MAX_ATTENTION)
                .toList();

        AcademicsSummary academics = current == null
                ? null
                : new AcademicsSummary(
                        current.id(),
                        current.name(),
                        current.gpa(),
                        gradeSummary.cgpa(),
                        current.credits(),
                        attendanceRows.stream()
                                .filter(a -> a.percentage() != null && a.conducted() > 0)
                                .min(Comparator.comparing(CourseAttendance::percentage))
                                .map(a -> new LowestAttendance(
                                        a.courseId(), a.courseName(), a.percentage(), a.target()))
                                .orElse(null));

        return new DashboardResponse(
                today, ranked, academics, planner(userId, today, zone), developer(userId, today, upcomingHackathons, openApplications, now));
    }

    // ───────────── developer card ─────────────

    private DeveloperSummary developer(
            UUID userId,
            LocalDate today,
            List<HackathonResponse> upcoming,
            List<Internship> applications,
            Instant now) {
        Map<UUID, Project> active = projects
                .findByUserIdAndStatusInOrderByCreatedAtDesc(
                        userId, Set.of(ProjectStatus.IDEA, ProjectStatus.PLANNING, ProjectStatus.DEVELOPMENT))
                .stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        int inDevelopment = (int) active.values().stream()
                .filter(p -> p.getStatus() == ProjectStatus.DEVELOPMENT)
                .count();
        NextMilestone next = milestones.findByUserIdAndDoneAtIsNullAndDueOnIsNotNullOrderByDueOnAsc(userId).stream()
                .filter(m -> active.containsKey(m.getProjectId()))
                .findFirst()
                .map(m -> nextMilestone(m, active.get(m.getProjectId()), today))
                .orElse(null);
        List<GoalResponse> goals = learning.list(userId, Set.of(GoalStatus.ACTIVE));
        FocusGoal focus = goals.stream()
                .min(Comparator.comparing(
                                GoalResponse::targetOn, Comparator.nullsLast(Comparator.<LocalDate>naturalOrder()))
                        .thenComparing(GoalResponse::createdAt, Comparator.reverseOrder()))
                .map(g -> new FocusGoal(
                        g.id(),
                        g.title(),
                        g.progress().percentage(),
                        g.nextTopic() == null ? null : g.nextTopic().title(),
                        g.targetOn()))
                .orElse(null);
        NextHackathon nextHackathon = upcoming.stream()
                .filter(h -> h.startsOn() != null)
                .min(Comparator.comparing(HackathonResponse::startsOn))
                .map(h -> new NextHackathon(
                        h.id(), h.name(), h.startsOn(), h.endsOn(), h.daysUntil(), h.status().name()))
                .orElse(null);
        int activeApplications = (int) applications.stream()
                .filter(a -> a.getStatus() != InternshipStatus.SAVED)
                .count();
        NextInternshipStep nextStep = applications.stream()
                .filter(a -> a.getNextStepAt() != null && !a.getNextStepAt().isBefore(now))
                .min(Comparator.comparing(Internship::getNextStepAt))
                .map(a -> new NextInternshipStep(
                        a.getId(), a.getCompany(), a.getRole(), a.getNextStep(), a.getNextStepAt()))
                .orElse(null);
        return new DeveloperSummary(
                inDevelopment,
                active.size(),
                next,
                goals.size(),
                focus,
                upcoming.size(),
                nextHackathon,
                activeApplications,
                nextStep,
                githubSummary(userId));
    }

    private GitHubSummary githubSummary(UUID userId) {
        GitHubService.Summary s = github.summary(userId);
        return s == null
                ? null
                : new GitHubSummary(
                        s.username(), s.contributionsThisMonth(), s.lastPushRepo(), s.lastPushAt(), s.fetchedAt());
    }

    private static NextMilestone nextMilestone(Milestone m, Project project, LocalDate today) {
        return new NextMilestone(
                project.getId(), project.getName(), m.getTitle(), m.getDueOn(), m.getDueOn().isBefore(today));
    }

    // ───────────── needs attention ─────────────

    private void addDeadlines(UUID userId, List<AttentionItem> out, Instant now, LocalDate today, ZoneId zone) {
        Instant horizon = now.plus(PriorityScorer.DUE_SOON_WINDOW);
        List<Assignment> due = assignments.findByUserIdAndStatusInAndDueAtLessThan(userId, OPEN, horizon);
        List<Task> taskDue = tasks.findByUserIdAndStatusNotAndDueAtLessThan(userId, TaskStatus.DONE, horizon);

        Set<UUID> courseIds = new HashSet<>();
        due.forEach(a -> courseIds.add(a.getCourseId()));
        taskDue.stream().map(Task::getCourseId).filter(Objects::nonNull).forEach(courseIds::add);
        Map<UUID, Course> courseById = courseIds.isEmpty()
                ? Map.of()
                : courses.findAllById(courseIds).stream()
                        .collect(Collectors.toMap(Course::getId, Function.identity()));
        Function<UUID, String> code = id -> {
            Course c = id == null ? null : courseById.get(id);
            return c == null ? null : c.getCode() != null ? c.getCode() : c.getName();
        };

        for (Assignment a : due) {
            boolean overdue = a.getDueAt().isBefore(now);
            String priority = a.getPriority().name();
            out.add(new AttentionItem(
                    overdue ? AttentionKind.ASSIGNMENT_OVERDUE : AttentionKind.ASSIGNMENT_DUE_SOON,
                    a.getId(),
                    a.getTitle(),
                    code.apply(a.getCourseId()),
                    deadlineReason(a.getDueAt(), overdue, today, zone),
                    overdue
                            ? PriorityScorer.overdue(priority, Duration.between(a.getDueAt(), now))
                            : PriorityScorer.dueSoon(priority, Duration.between(now, a.getDueAt())),
                    "/app/academics/assignments?course=" + a.getCourseId()));
        }
        for (Task t : taskDue) {
            boolean overdue = t.getDueAt().isBefore(now);
            String priority = t.getPriority().name();
            out.add(new AttentionItem(
                    overdue ? AttentionKind.TASK_OVERDUE : AttentionKind.TASK_DUE_SOON,
                    t.getId(),
                    t.getTitle(),
                    code.apply(t.getCourseId()),
                    deadlineReason(t.getDueAt(), overdue, today, zone),
                    overdue
                            ? PriorityScorer.overdue(priority, Duration.between(t.getDueAt(), now))
                            : PriorityScorer.dueSoon(priority, Duration.between(now, t.getDueAt())),
                    "/app/planner/tasks"));
        }
    }

    /** "Was due today at 18:00", "Was due yesterday", "Overdue by 3 days"; "Due tomorrow at 09:00". */
    static String deadlineReason(Instant dueAt, boolean overdue, LocalDate today, ZoneId zone) {
        LocalDateTime local = LocalDateTime.ofInstant(dueAt, zone);
        LocalDate day = local.toLocalDate();
        String time = local.format(HH_MM);
        if (overdue) {
            long late = ChronoUnit.DAYS.between(day, today);
            if (late <= 0) {
                return "Was due today at " + time;
            }
            return late == 1 ? "Was due yesterday" : "Overdue by " + late + " days";
        }
        if (day.equals(today)) {
            return "Due today at " + time;
        }
        if (day.equals(today.plusDays(1))) {
            return "Due tomorrow at " + time;
        }
        return "Due " + day.format(DAY) + " at " + time;
    }

    private void addAttendance(List<AttentionItem> out, List<CourseAttendance> rows) {
        for (CourseAttendance a : rows) {
            if (a.status() != Status.BELOW && a.status() != Status.AT_RISK) {
                continue;
            }
            String pct = percent(a.percentage());
            int score;
            String reason;
            if (a.status() == Status.BELOW) {
                score = PriorityScorer.belowTarget(a.percentage(), a.target());
                int need = a.needToAttend() == null ? 0 : a.needToAttend();
                reason = pct + " · below your " + percent(a.target()) + " target; attend the next "
                        + (need == 1 ? "class" : need + " classes");
            } else {
                int canMiss = a.canMiss() == null ? 0 : a.canMiss();
                score = PriorityScorer.atRisk(canMiss);
                reason = pct + (canMiss <= 0 ? " · can’t miss another class" : " · can miss only 1 more");
            }
            out.add(new AttentionItem(
                    AttentionKind.ATTENDANCE_AT_RISK,
                    a.courseId(),
                    a.courseName(),
                    a.courseCode(),
                    reason,
                    score,
                    "/app/academics/courses/" + a.courseId()));
        }
    }

    private void addExams(UUID userId, List<AttentionItem> out) {
        for (ExamSummary e : exams.list(userId, true, null)) {
            Integer pct = e.prep().percentage();
            if (!PriorityScorer.examNeedsPrep(e.daysUntil(), pct)) {
                continue;
            }
            String when = e.daysUntil() == 0
                    ? "Today"
                    : e.daysUntil() == 1 ? "Tomorrow" : "In " + e.daysUntil() + " days";
            out.add(new AttentionItem(
                    AttentionKind.EXAM_PREP,
                    e.id(),
                    e.title(),
                    e.courseCode() != null ? e.courseCode() : e.courseName(),
                    when + " · " + e.prep().done() + " of " + e.prep().total() + " topics ready",
                    PriorityScorer.exam(e.daysUntil(), pct),
                    "/app/academics/exams/" + e.id()));
        }
    }

    private void addHackathons(
            List<HackathonResponse> upcoming, List<AttentionItem> out, Instant now, LocalDate today, ZoneId zone) {
        Instant horizon = now.plus(PriorityScorer.DUE_SOON_WINDOW);
        for (HackathonResponse h : upcoming) {
            String link = "/app/developer/hackathons/" + h.id();
            if (h.deadline() != null && h.deadline().at().isBefore(horizon)) {
                boolean missed = h.deadline().missed();
                out.add(new AttentionItem(
                        AttentionKind.HACKATHON_DEADLINE,
                        h.id(),
                        h.name(),
                        null,
                        hackathonDeadlineReason(h.deadline().kind(), h.deadline().at(), missed, today, zone),
                        missed
                                ? PriorityScorer.hackathonDeadlineMissed()
                                : PriorityScorer.hackathonDeadlineSoon(Duration.between(now, h.deadline().at())),
                        link));
            }
            if (!h.examClashes().isEmpty()
                    && h.daysUntil() != null
                    && PriorityScorer.clashNeedsAttention(h.daysUntil())) {
                ExamClash first = h.examClashes().getFirst();
                int more = h.examClashes().size() - 1;
                out.add(new AttentionItem(
                        AttentionKind.HACKATHON_EXAM_CLASH,
                        h.id(),
                        h.name(),
                        first.courseCode(),
                        clashReason(first, h.startsOn(), h.endsOn()) + (more > 0 ? " (+" + more + " more)" : ""),
                        PriorityScorer.clash(h.daysUntil()),
                        link));
            }
        }
    }

    private void addApplyBy(
            List<Internship> applications, List<AttentionItem> out, Instant now, LocalDate today, ZoneId zone) {
        Instant horizon = now.plus(PriorityScorer.DUE_SOON_WINDOW);
        Instant oldest = now.minus(PriorityScorer.APPLY_BY_MISSED_WINDOW);
        for (Internship a : applications) {
            Instant at = a.getDeadlineAt();
            if (!InternshipRules.deadlineMatters(a.getStatus()) || at == null || !at.isBefore(horizon)
                    || at.isBefore(oldest)) {
                continue;
            }
            boolean missed = at.isBefore(now);
            out.add(new AttentionItem(
                    AttentionKind.INTERNSHIP_DEADLINE,
                    a.getId(),
                    a.getRole() + " at " + a.getCompany(),
                    null,
                    applyByReason(at, missed, today, zone),
                    missed
                            ? PriorityScorer.applyByMissed()
                            : PriorityScorer.applyBySoon(Duration.between(now, at)),
                    "/app/developer/internships/" + a.getId()));
        }
    }

    /** "Apply by today at 23:59", "Apply-by date passed yesterday · apply or update it". */
    static String applyByReason(Instant at, boolean missed, LocalDate today, ZoneId zone) {
        if (missed) {
            long ago = ChronoUnit.DAYS.between(LocalDate.ofInstant(at, zone), today);
            String when = ago <= 0 ? "today" : ago == 1 ? "yesterday" : ago + " days ago";
            return "Apply-by date passed " + when + " · apply or update it";
        }
        // "Due today at 18:00" → "Apply by today at 18:00"
        return "Apply by" + deadlineReason(at, false, today, zone).substring("Due".length());
    }

    /** "Registration closes today at 18:00", "Submissions closed yesterday · update its status". */
    static String hackathonDeadlineReason(
            DeadlineKind kind, Instant at, boolean missed, LocalDate today, ZoneId zone) {
        String what = kind == DeadlineKind.REGISTRATION ? "Registration" : "Submissions";
        if (missed) {
            long ago = ChronoUnit.DAYS.between(LocalDate.ofInstant(at, zone), today);
            String when = ago <= 0 ? "today" : ago == 1 ? "yesterday" : ago + " days ago";
            return what + " closed " + when + " · update its status";
        }
        // "Due today at 18:00" → "Registration closes today at 18:00"
        return what + " close" + (kind == DeadlineKind.REGISTRATION ? "s" : "")
                + deadlineReason(at, false, today, zone).substring("Due".length());
    }

    /** "DBMS midsem on Mon 3 Nov · during it", "… · 2 days before it". */
    static String clashReason(ExamClash exam, LocalDate startsOn, LocalDate endsOn) {
        LocalDate last = endsOn != null ? endsOn : startsOn;
        String where;
        if (exam.on().isBefore(startsOn)) {
            long d = ChronoUnit.DAYS.between(exam.on(), startsOn);
            where = d + (d == 1 ? " day" : " days") + " before it";
        } else if (exam.on().isAfter(last)) {
            long d = ChronoUnit.DAYS.between(last, exam.on());
            where = d + (d == 1 ? " day" : " days") + " after it";
        } else {
            where = "during it";
        }
        return exam.title() + " on " + exam.on().format(DAY) + " · " + where;
    }

    /** 72.5 → "72.5%", 75.00 → "75%". */
    static String percent(BigDecimal value) {
        BigDecimal rounded = value.setScale(1, RoundingMode.HALF_UP).stripTrailingZeros();
        return rounded.toPlainString() + "%";
    }

    // ───────────── planner card ─────────────

    private PlannerSummary planner(UUID userId, LocalDate today, ZoneId zone) {
        TodayResponse todayTasks = taskService.today(userId, today);

        UserSettings.WeekStart weekStart = settings.findById(userId)
                .map(UserSettings::getWeekStart)
                .orElse(UserSettings.WeekStart.MON);
        DayOfWeek first = weekStart == UserSettings.WeekStart.SUN ? DayOfWeek.SUNDAY : DayOfWeek.MONDAY;
        LocalDate weekFrom = today.with(TemporalAdjusters.previousOrSame(first));
        List<Task> week = tasks.findByUserIdAndPlannedForBetween(userId, weekFrom, weekFrom.plusDays(6));
        int weekDone = (int) week.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();

        Instant since = today.minusDays(STREAK_LOOKBACK_DAYS - 1L).atStartOfDay(zone).toInstant();
        Instant until = today.plusDays(1).atStartOfDay(zone).toInstant();
        Set<LocalDate> doneDays = tasks
                .findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThanOrderByCompletedAtDesc(
                        userId, TaskStatus.DONE, since, until)
                .stream()
                .map(t -> LocalDate.ofInstant(t.getCompletedAt(), zone))
                .collect(Collectors.toSet());

        return new PlannerSummary(
                todayTasks.tasks().size(),
                todayTasks.completed().size(),
                weekDone,
                week.size(),
                Streaks.streak(doneDays, today));
    }
}
