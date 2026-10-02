package dev.nova.notification;

import dev.nova.academics.assignment.Assignment;
import dev.nova.academics.assignment.AssignmentRepository;
import dev.nova.academics.assignment.AssignmentStatus;
import dev.nova.academics.attendance.AttendanceCalculator.Status;
import dev.nova.academics.attendance.AttendanceDtos.CourseAttendance;
import dev.nova.academics.attendance.AttendanceService;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.ExamService;
import dev.nova.academics.semester.Semester;
import dev.nova.academics.semester.SemesterRepository;
import dev.nova.developer.hackathon.HackathonService;
import dev.nova.developer.internship.InternshipRules;
import dev.nova.developer.internship.InternshipService;
import dev.nova.notification.NotificationRules.ApplicationInput;
import dev.nova.notification.NotificationRules.AttendanceInput;
import dev.nova.notification.NotificationRules.Deadline;
import dev.nova.notification.NotificationRules.Draft;
import dev.nova.notification.NotificationRules.ExamInput;
import dev.nova.notification.NotificationRules.HackathonInput;
import dev.nova.planner.task.Task;
import dev.nova.planner.task.TaskRepository;
import dev.nova.planner.task.TaskStatus;
import dev.nova.user.UserClock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads one user's data, applies {@link NotificationRules} and stores what's new. Safe to run any
 * number of times: the unique dedupe key turns repeats into no-ops. Types the user switched off are
 * not even evaluated.
 */
@Service
public class NotificationGenerator {

    private static final Set<AssignmentStatus> OPEN =
            Set.of(AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS);
    private static final Set<Status> WATCHED = Set.of(Status.SAFE, Status.AT_RISK, Status.BELOW);

    private final NotificationStore store;
    private final AssignmentRepository assignments;
    private final TaskRepository tasks;
    private final CourseRepository courses;
    private final SemesterRepository semesters;
    private final AttendanceService attendance;
    private final ExamService exams;
    private final HackathonService hackathons;
    private final InternshipService internships;
    private final UserClock userClock;

    public NotificationGenerator(
            NotificationStore store,
            AssignmentRepository assignments,
            TaskRepository tasks,
            CourseRepository courses,
            SemesterRepository semesters,
            AttendanceService attendance,
            ExamService exams,
            HackathonService hackathons,
            InternshipService internships,
            UserClock userClock) {
        this.store = store;
        this.assignments = assignments;
        this.tasks = tasks;
        this.courses = courses;
        this.semesters = semesters;
        this.attendance = attendance;
        this.exams = exams;
        this.hackathons = hackathons;
        this.internships = internships;
        this.userClock = userClock;
    }

    /** Creates the user's new notifications as of now; returns how many were created. */
    @Transactional
    public int generateFor(UUID userId) {
        Instant now = userClock.now();
        ZoneId zone = userClock.zoneOf(userId);
        Set<NotificationType> muted = store.muted(userId);
        List<Draft> drafts = new ArrayList<>();

        boolean assignmentsOn = !muted.contains(NotificationType.ASSIGNMENT_DUE);
        boolean tasksDueOn = !muted.contains(NotificationType.TASK_DUE);
        boolean overdueOn = !muted.contains(NotificationType.TASK_OVERDUE);
        if (assignmentsOn || tasksDueOn || overdueOn) {
            addDeadlines(userId, now, zone, assignmentsOn, tasksDueOn, overdueOn, drafts);
        }
        if (!muted.contains(NotificationType.EXAM_SOON)) {
            List<ExamInput> upcoming = exams.list(userId, true, null).stream()
                    .filter(e -> e.daysUntil() <= NotificationRules.EXAM_DAYS)
                    .map(e -> new ExamInput(
                            e.id(),
                            e.title(),
                            e.courseCode() != null ? e.courseCode() : e.courseName(),
                            e.startsAt(),
                            e.daysUntil(),
                            e.prep().done(),
                            e.prep().total()))
                    .toList();
            drafts.addAll(NotificationRules.examsSoon(upcoming, now, zone));
        }
        if (!muted.contains(NotificationType.ATTENDANCE_AT_RISK)) {
            addAttendance(userId, now, drafts);
        }
        if (!muted.contains(NotificationType.HACKATHON_DEADLINE)) {
            List<HackathonInput> upcoming = hackathons.list(userId, null).stream()
                    .filter(h -> !h.past() && h.deadline() != null)
                    .map(h -> new HackathonInput(
                            h.id(), h.name(), h.deadline().kind(), h.deadline().at(), h.deadline().missed()))
                    .toList();
            drafts.addAll(NotificationRules.hackathonDeadlines(upcoming, now, zone));
        }
        boolean applyByOn = !muted.contains(NotificationType.INTERNSHIP_DEADLINE);
        boolean stepsOn = !muted.contains(NotificationType.INTERNSHIP_STEP);
        if (applyByOn || stepsOn) {
            List<ApplicationInput> open = internships.open(userId).stream()
                    .map(a -> new ApplicationInput(
                            a.getId(),
                            a.getCompany(),
                            a.getRole(),
                            InternshipRules.deadlineMatters(a.getStatus()),
                            a.getDeadlineAt(),
                            a.getNextStep(),
                            a.getNextStepAt()))
                    .toList();
            if (applyByOn) {
                drafts.addAll(NotificationRules.applyBy(open, now, zone));
            }
            if (stepsOn) {
                drafts.addAll(NotificationRules.nextStepsTomorrow(open, now, zone));
            }
        }

        int created = 0;
        for (Draft d : drafts) {
            if (store.insertIfNew(userId, d, now)) {
                created++;
            }
        }
        return created;
    }

    private void addDeadlines(
            UUID userId,
            Instant now,
            ZoneId zone,
            boolean assignmentsOn,
            boolean tasksDueOn,
            boolean overdueOn,
            List<Draft> out) {
        Instant horizon = now.plus(NotificationRules.DUE_WINDOW);
        List<Assignment> due = assignmentsOn
                ? assignments.findByUserIdAndStatusInAndDueAtGreaterThanEqualAndDueAtLessThan(userId, OPEN, now, horizon)
                : List.of();
        Instant from = overdueOn ? now.minus(NotificationRules.OVERDUE_LOOKBACK) : now;
        List<Task> taskDeadlines = tasksDueOn || overdueOn
                ? tasks.findByUserIdAndStatusNotAndDueAtGreaterThanEqualAndDueAtLessThan(
                        userId, TaskStatus.DONE, from, horizon)
                : List.of();

        Set<UUID> courseIds = new HashSet<>();
        due.forEach(a -> courseIds.add(a.getCourseId()));
        taskDeadlines.stream().map(Task::getCourseId).filter(Objects::nonNull).forEach(courseIds::add);
        Map<UUID, Course> byId = courseIds.isEmpty()
                ? Map.of()
                : courses.findAllById(courseIds).stream().collect(Collectors.toMap(Course::getId, Function.identity()));
        Function<UUID, String> code = id -> {
            Course c = id == null ? null : byId.get(id);
            return c == null ? null : c.getCode() != null ? c.getCode() : c.getName();
        };

        if (assignmentsOn) {
            List<Deadline> inputs = due.stream()
                    .map(a -> new Deadline(
                            a.getId(),
                            a.getTitle(),
                            code.apply(a.getCourseId()),
                            a.getDueAt(),
                            "/app/academics/assignments?course=" + a.getCourseId()))
                    .toList();
            out.addAll(NotificationRules.assignmentsDue(inputs, now, zone));
        }
        List<Deadline> taskInputs = taskDeadlines.stream()
                .map(t -> new Deadline(
                        t.getId(),
                        t.getTitle(),
                        code.apply(t.getCourseId()),
                        t.getDueAt(),
                        "/app/planner/tasks?task=" + t.getId()))
                .toList();
        if (tasksDueOn) {
            out.addAll(NotificationRules.tasksDue(taskInputs, now, zone));
        }
        if (overdueOn) {
            out.addAll(NotificationRules.tasksOverdue(taskInputs, now, zone));
        }
    }

    /**
     * Compares each current-semester course's status with the one last seen and notifies only when
     * it got worse. Courses without a target or classes aren't tracked.
     */
    private void addAttendance(UUID userId, Instant now, List<Draft> out) {
        Semester current = semesters.findByUserIdAndCurrentTrue(userId).orElse(null);
        if (current == null) {
            return;
        }
        for (CourseAttendance a : attendance.forSemester(userId, current.getId())) {
            if (!WATCHED.contains(a.status())) {
                continue;
            }
            String subject = NotificationRules.attendanceSubject(a.courseId());
            String previous = store.state(userId, subject);
            if (a.status().name().equals(previous)) {
                continue;
            }
            // Only the run that wins the state change notifies, even with two app instances
            if (store.compareAndSetState(userId, subject, previous, a.status().name(), now)
                    && NotificationRules.attendanceWorsened(previous, a.status())) {
                out.add(NotificationRules.attendance(
                        new AttendanceInput(
                                a.courseId(),
                                a.courseCode() != null ? a.courseCode() : a.courseName(),
                                a.status(),
                                a.percentage(),
                                a.target(),
                                a.canMiss(),
                                a.needToAttend()),
                        previous,
                        now));
            }
        }
    }
}
