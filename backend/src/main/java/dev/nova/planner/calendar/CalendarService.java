package dev.nova.planner.calendar;

import dev.nova.academics.assignment.Assignment;
import dev.nova.academics.assignment.AssignmentRepository;
import dev.nova.academics.assignment.AssignmentStatus;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.Exam;
import dev.nova.academics.exam.ExamRepository;
import dev.nova.academics.semester.Semester;
import dev.nova.academics.semester.SemesterRepository;
import dev.nova.academics.timetable.TimetableEntry;
import dev.nova.academics.timetable.TimetableRepository;
import dev.nova.common.web.ApiException;
import dev.nova.planner.calendar.CalendarDtos.CalendarItem;
import dev.nova.planner.calendar.CalendarDtos.CalendarResponse;
import dev.nova.planner.calendar.CalendarDtos.DayLoad;
import dev.nova.planner.calendar.CalendarDtos.ItemType;
import dev.nova.planner.task.Task;
import dev.nova.planner.task.TaskRepository;
import dev.nova.planner.task.TaskStatus;
import dev.nova.user.UserClock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
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
 * One read-only feed over the timetable, exams, assignments and tasks (architecture.md: the
 * calendar is a view, not a table). Everything is placed on the user's calendar days (UserClock).
 */
@Service
public class CalendarService {

    private static final Set<AssignmentStatus> OPEN_ASSIGNMENTS =
            Set.of(AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS);

    private final SemesterRepository semesters;
    private final CourseRepository courses;
    private final TimetableRepository timetable;
    private final ExamRepository exams;
    private final AssignmentRepository assignments;
    private final TaskRepository tasks;
    private final UserClock userClock;

    public CalendarService(
            SemesterRepository semesters,
            CourseRepository courses,
            TimetableRepository timetable,
            ExamRepository exams,
            AssignmentRepository assignments,
            TaskRepository tasks,
            UserClock userClock) {
        this.semesters = semesters;
        this.courses = courses;
        this.timetable = timetable;
        this.exams = exams;
        this.assignments = assignments;
        this.tasks = tasks;
        this.userClock = userClock;
    }

    @Transactional(readOnly = true)
    public CalendarResponse range(UUID userId, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw ApiException.invalidField("to", "The end date can’t be before the start date.");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > CalendarRules.MAX_DAYS) {
            throw ApiException.invalidField("to", "Show at most " + CalendarRules.MAX_DAYS + " days at once.");
        }
        ZoneId zone = userClock.zoneOf(userId);
        Instant start = from.atStartOfDay(zone).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(zone).toInstant();

        List<TimetableEntry> entries = new ArrayList<>();
        Semester term = semesters.findByUserIdAndCurrentTrue(userId).orElse(null);
        if (term != null) {
            List<UUID> termCourses = courses.findBySemesterIdAndUserIdOrderByNameAsc(term.getId(), userId).stream()
                    .map(Course::getId)
                    .toList();
            if (!termCourses.isEmpty()) {
                entries = timetable.findByUserIdAndCourseIdIn(userId, termCourses);
            }
        }
        List<Exam> examList = exams.findByUserIdAndStartsAtGreaterThanEqualAndStartsAtLessThan(userId, start, end);
        List<Assignment> due = assignments.findByUserIdAndStatusInAndDueAtGreaterThanEqualAndDueAtLessThan(
                userId, OPEN_ASSIGNMENTS, start, end);
        List<Task> planned = tasks.findByUserIdAndPlannedForBetween(userId, from, to);
        List<Task> taskDeadlines = tasks.findByUserIdAndStatusNotAndDueAtGreaterThanEqualAndDueAtLessThan(
                userId, TaskStatus.DONE, start, end);

        Set<UUID> courseIds = new HashSet<>();
        entries.forEach(e -> courseIds.add(e.getCourseId()));
        examList.forEach(e -> courseIds.add(e.getCourseId()));
        due.forEach(a -> courseIds.add(a.getCourseId()));
        planned.stream().map(Task::getCourseId).filter(Objects::nonNull).forEach(courseIds::add);
        taskDeadlines.stream().map(Task::getCourseId).filter(Objects::nonNull).forEach(courseIds::add);
        Map<UUID, Course> courseById = courseIds.isEmpty()
                ? Map.of()
                : courses.findAllById(courseIds).stream().collect(Collectors.toMap(Course::getId, Function.identity()));
        Items items = new Items(courseById);

        Map<LocalDate, int[]> load = new LinkedHashMap<>(); // deadlines, exams, class minutes, task minutes
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            load.put(d, new int[4]);
        }

        for (TimetableEntry e : entries) {
            String startTime = CalendarRules.hhmm(e.getStartsAt());
            String endTime = CalendarRules.hhmm(e.getEndsAt());
            for (LocalDate date : CalendarRules.classDates(
                    e.getDayOfWeek(), from, to, term.getStartsOn(), term.getEndsOn())) {
                items.add("class:" + e.getId() + ":" + date, ItemType.CLASS, e.getId(), null, date, startTime,
                        endTime, false, e.getCourseId(), e.getLocation(), e.getKind().name(), null);
                load.get(date)[2] += CalendarRules.minutesBetween(startTime, endTime);
            }
        }
        for (Exam x : examList) {
            LocalDateTime at = LocalDateTime.ofInstant(x.getStartsAt(), zone);
            String endTime = x.getDurationMinutes() == null ? null : CalendarRules.endOf(at, x.getDurationMinutes());
            items.add("exam:" + x.getId(), ItemType.EXAM, x.getId(), x.getTitle(), at.toLocalDate(),
                    CalendarRules.hhmm(at.toLocalTime()), endTime, false, x.getCourseId(), x.getLocation(),
                    x.getKind().name(), null);
            load.get(at.toLocalDate())[1]++;
        }
        for (Assignment a : due) {
            LocalDateTime at = LocalDateTime.ofInstant(a.getDueAt(), zone);
            items.add("assignment:" + a.getId(), ItemType.ASSIGNMENT_DUE, a.getId(), a.getTitle(), at.toLocalDate(),
                    CalendarRules.hhmm(at.toLocalTime()), null, false, a.getCourseId(), null, null,
                    a.getPriority().name());
            load.get(at.toLocalDate())[0]++;
        }
        for (Task t : planned) {
            boolean done = t.getStatus() == TaskStatus.DONE;
            String startTime = null;
            String endTime = null;
            if (t.getPlannedStart() != null) {
                startTime = CalendarRules.hhmm(t.getPlannedStart());
                int minutes = t.getEstimatedMinutes() != null
                        ? t.getEstimatedMinutes()
                        : CalendarRules.DEFAULT_TASK_MINUTES;
                endTime = CalendarRules.endOf(t.getPlannedFor().atTime(t.getPlannedStart()), minutes);
            }
            items.add("task:" + t.getId(), ItemType.TASK, t.getId(), t.getTitle(), t.getPlannedFor(), startTime,
                    endTime, done, t.getCourseId(), null, null, t.getPriority().name());
            if (!done && t.getEstimatedMinutes() != null) {
                load.get(t.getPlannedFor())[3] += t.getEstimatedMinutes();
            }
        }
        for (Task t : taskDeadlines) {
            LocalDateTime at = LocalDateTime.ofInstant(t.getDueAt(), zone);
            load.get(at.toLocalDate())[0]++;
            // A task planned for its own deadline day is already on that day; its deadline still counts
            if (at.toLocalDate().equals(t.getPlannedFor())) {
                continue;
            }
            items.add("task-due:" + t.getId(), ItemType.TASK_DUE, t.getId(), t.getTitle(), at.toLocalDate(),
                    CalendarRules.hhmm(at.toLocalTime()), null, false, t.getCourseId(), null, null,
                    t.getPriority().name());
        }

        List<CalendarItem> sorted = items.list.stream().sorted(CalendarRules.ORDER).toList();
        List<DayLoad> loads = load.entrySet().stream()
                .map(e -> new DayLoad(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2], e.getValue()[3]))
                .toList();
        return new CalendarResponse(from, to, zone.getId(), sorted, loads);
    }

    /** Builds items with their course's code, name and colour; a class takes its title from the course. */
    private static final class Items {
        final List<CalendarItem> list = new ArrayList<>();
        final Map<UUID, Course> courses;

        Items(Map<UUID, Course> courses) {
            this.courses = courses;
        }

        void add(String key, ItemType type, UUID refId, String title, LocalDate date, String startTime,
                String endTime, boolean done, UUID courseId, String location, String kind, String priority) {
            Course course = courseId == null ? null : courses.get(courseId);
            list.add(new CalendarItem(
                    key,
                    type,
                    refId,
                    title != null ? title : course != null ? course.getName() : "Class",
                    date,
                    startTime,
                    endTime,
                    done,
                    courseId,
                    course == null ? null : course.getCode(),
                    course == null ? null : course.getName(),
                    course == null ? null : course.getColorHue(),
                    location,
                    kind,
                    priority));
        }
    }
}
