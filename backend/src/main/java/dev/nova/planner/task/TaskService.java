package dev.nova.planner.task;

import dev.nova.academics.assignment.Urgency;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.Exam;
import dev.nova.academics.exam.ExamRepository;
import dev.nova.common.web.ApiException;
import dev.nova.common.web.PageResponse;
import dev.nova.planner.task.TaskDtos.StatusResponse;
import dev.nova.planner.task.TaskDtos.TaskRequest;
import dev.nova.planner.task.TaskDtos.TaskResponse;
import dev.nova.planner.task.TaskDtos.TodayResponse;
import dev.nova.planner.task.TaskDtos.UpcomingDay;
import dev.nova.planner.task.TaskDtos.UpcomingResponse;
import dev.nova.user.UserClock;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tasks and their views. "Today" and "upcoming" are the user's calendar days (UserClock), so a
 * task due at 23:30 in India is due today there even though it's still the previous day in UTC.
 */
@Service
public class TaskService {

    static final int MAX_UPCOMING_DAYS = 62;
    static final int MAX_BATCH = 30;
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final Set<String> SORTABLE = Set.of("plannedFor", "dueAt", "createdAt");

    private final TaskRepository tasks;
    private final CourseRepository courses;
    private final ExamRepository exams;
    private final UserClock userClock;

    public TaskService(TaskRepository tasks, CourseRepository courses, ExamRepository exams, UserClock userClock) {
        this.tasks = tasks;
        this.courses = courses;
        this.exams = exams;
        this.userClock = userClock;
    }

    /** Filters for the generic list; null means "don't filter on this". */
    public record Filter(TaskCategory category, Collection<TaskStatus> statuses, UUID courseId, UUID examId) {}

    // ───────────── views ─────────────

    @Transactional(readOnly = true)
    public TodayResponse today(UUID userId, LocalDate requested) {
        ZoneId zone = userClock.zoneOf(userId);
        LocalDate day = requested != null ? requested : userClock.today(userId);
        Instant dayStart = day.atStartOfDay(zone).toInstant();
        Instant dayEnd = day.plusDays(1).atStartOfDay(zone).toInstant();
        Instant now = userClock.now();
        List<Task> open = new ArrayList<>(tasks.openForDay(userId, day, dayEnd));
        open.sort(TaskRanking.today(now, dayEnd));
        List<Task> done = tasks.findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThanOrderByCompletedAtDesc(
                userId, TaskStatus.DONE, dayStart, dayEnd);
        Responses r = responsesFor(userId, concat(open, done));
        return new TodayResponse(day, open.stream().map(r::of).toList(), done.stream().map(r::of).toList());
    }

    @Transactional(readOnly = true)
    public UpcomingResponse upcoming(UUID userId, int days) {
        if (days < 1 || days > MAX_UPCOMING_DAYS) {
            throw ApiException.invalidField("days", "Use 1 to " + MAX_UPCOMING_DAYS + " days.");
        }
        ZoneId zone = userClock.zoneOf(userId);
        LocalDate today = userClock.today(userId);
        LocalDate last = today.plusDays(days);
        Instant dayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();
        Instant windowEnd = last.plusDays(1).atStartOfDay(zone).toInstant();
        List<Task> window = tasks.openUpcoming(userId, today, last, dayEnd, windowEnd);
        List<Task> someday = tasks.openUnscheduled(userId);
        Responses r = responsesFor(userId, concat(window, someday));

        Map<LocalDate, List<Task>> byDay = new TreeMap<>();
        for (Task t : window) {
            LocalDate key = t.getPlannedFor() != null ? t.getPlannedFor() : LocalDate.ofInstant(t.getDueAt(), zone);
            byDay.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
        }
        Comparator<Task> withinDay = Comparator.comparing(Task::getPlannedStart, Comparator.nullsLast(Comparator.<LocalTime>naturalOrder()))
                .thenComparingInt(t -> 2 - t.getPriority().ordinal())
                .thenComparing(Task::getDueAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
                .thenComparing(Task::getCreatedAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()));
        List<UpcomingDay> grouped = byDay.entrySet().stream()
                .map(e -> new UpcomingDay(e.getKey(), e.getValue().stream().sorted(withinDay).map(r::of).toList()))
                .toList();
        return new UpcomingResponse(today.plusDays(1), last, grouped, someday.stream().map(r::of).toList());
    }

    @Transactional(readOnly = true)
    public PageResponse<TaskResponse> completed(UUID userId, int page, int size) {
        PageResponse.validate(page, size);
        Page<Task> result = tasks.findByUserIdAndStatus(
                userId,
                TaskStatus.DONE,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("completedAt"), Sort.Order.asc("id"))));
        Responses r = responsesFor(userId, result.getContent());
        return PageResponse.of(result, r::of);
    }

    @Transactional(readOnly = true)
    public PageResponse<TaskResponse> list(UUID userId, Filter filter, String sort, int page, int size) {
        PageResponse.validate(page, size);
        Specification<Task> spec = (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(cb.equal(root.get("userId"), userId));
            if (filter.category() != null) {
                where.add(cb.equal(root.get("category"), filter.category()));
            }
            if (filter.statuses() != null && !filter.statuses().isEmpty()) {
                where.add(root.get("status").in(filter.statuses()));
            }
            if (filter.courseId() != null) {
                where.add(cb.equal(root.get("courseId"), filter.courseId()));
            }
            if (filter.examId() != null) {
                where.add(cb.equal(root.get("examId"), filter.examId()));
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
        Page<Task> result = tasks.findAll(spec, PageRequest.of(page, size, parseSort(sort)));
        Responses r = responsesFor(userId, result.getContent());
        return PageResponse.of(result, r::of);
    }

    @Transactional(readOnly = true)
    public TaskResponse get(UUID userId, UUID taskId) {
        Task task = require(userId, taskId);
        return responsesFor(userId, List.of(task)).of(task);
    }

    // ───────────── writes ─────────────

    @Transactional
    public TaskResponse create(UUID userId, TaskRequest request) {
        Task task = new Task(userId);
        apply(userId, task, request);
        tasks.saveAndFlush(task);
        return responsesFor(userId, List.of(task)).of(task);
    }

    /**
     * Creates every task or none. A problem with one task is reported on {@code tasks[i].field}, the
     * same path bean validation uses for the list.
     */
    @Transactional
    public List<TaskResponse> createAll(UUID userId, List<TaskRequest> requests) {
        List<Task> created = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            Task task = new Task(userId);
            try {
                apply(userId, task, requests.get(i));
            } catch (ApiException e) {
                if (e.getFieldProblems().size() != 1) {
                    throw e;
                }
                ApiException.FieldProblem problem = e.getFieldProblems().getFirst();
                throw ApiException.invalidField("tasks[" + i + "]." + problem.field(), problem.message());
            }
            created.add(task);
        }
        tasks.saveAllAndFlush(created);
        Responses r = responsesFor(userId, created);
        return created.stream().map(r::of).toList();
    }

    @Transactional
    public TaskResponse update(UUID userId, UUID taskId, TaskRequest request) {
        Task task = require(userId, taskId);
        // Check before editing: the query would otherwise auto-flush the edit into the unique index first
        if (task.getSeriesId() != null
                && request.plannedFor() != null
                && tasks.existsBySeriesIdAndPlannedForAndIdNot(task.getSeriesId(), request.plannedFor(), task.getId())) {
            throw ApiException.conflict("Another repeat of this task is already planned for that day.");
        }
        apply(userId, task, request);
        tasks.flush();
        return responsesFor(userId, List.of(task)).of(task);
    }

    /**
     * Changes status. Completing a repeating task creates its next instance, unless that day's
     * instance already exists (e.g. completed, reopened and completed again). Reopening never
     * deletes a generated instance.
     */
    @Transactional
    public StatusResponse changeStatus(UUID userId, UUID taskId, TaskStatus status) {
        Task task = require(userId, taskId);
        boolean completing = status == TaskStatus.DONE && task.getStatus() != TaskStatus.DONE;
        task.changeStatus(status, userClock.now());
        Task next = null;
        if (completing && task.getRecurrence() != Recurrence.NONE) {
            LocalDate nextDay = task.getRecurrence().next(task.getPlannedFor());
            if (!tasks.existsBySeriesIdAndPlannedFor(task.getSeriesId(), nextDay)) {
                Instant nextDue = task.getDueAt() == null
                        ? null
                        : task.getDueAt()
                                .atZone(userClock.zoneOf(userId))
                                .plusDays(ChronoUnit.DAYS.between(task.getPlannedFor(), nextDay))
                                .toInstant();
                next = tasks.save(task.nextInstance(nextDay, nextDue));
            }
        }
        tasks.flush();
        Responses r = responsesFor(userId, next == null ? List.of(task) : List.of(task, next));
        return new StatusResponse(r.of(task), next == null ? null : r.of(next));
    }

    /** Deletes a task; with {@code series}, also the open repeats planned on or after it. */
    @Transactional
    public void delete(UUID userId, UUID taskId, boolean series) {
        Task task = require(userId, taskId);
        if (series && task.getSeriesId() != null && task.getPlannedFor() != null) {
            // the task itself may be in that list; remove it only once, below
            tasks.deleteAll(tasks.openInSeriesFrom(userId, task.getSeriesId(), task.getPlannedFor()).stream()
                    .filter(t -> !t.getId().equals(task.getId()))
                    .toList());
        }
        tasks.delete(task);
    }

    // ───────────── helpers ─────────────

    private void apply(UUID userId, Task task, TaskRequest request) {
        Course course = request.courseId() == null
                ? null
                : courses.findByIdAndUserId(request.courseId(), userId)
                        .orElseThrow(() -> ApiException.invalidField("courseId", "Choose one of your courses."));
        Exam exam = request.examId() == null
                ? null
                : exams.findByIdAndUserId(request.examId(), userId)
                        .orElseThrow(() -> ApiException.invalidField("examId", "Choose one of your exams."));
        if (exam != null && course != null && !exam.getCourseId().equals(course.getId())) {
            throw ApiException.invalidField("examId", "That exam belongs to another course.");
        }
        UUID courseId = course != null ? course.getId() : exam != null ? exam.getCourseId() : null;

        Recurrence recurrence = request.recurrence() == null ? Recurrence.NONE : request.recurrence();
        if (request.plannedStart() != null && request.plannedFor() == null) {
            throw ApiException.invalidField("plannedStart", "Pick a day before a start time.");
        }
        if (recurrence != Recurrence.NONE && request.plannedFor() == null) {
            throw ApiException.invalidField("plannedFor", "A repeating task needs a day to start from.");
        }
        TaskCategory category = request.category() != null
                ? request.category()
                : courseId != null ? TaskCategory.ACADEMIC : TaskCategory.PERSONAL;

        task.edit(
                request.title().strip(),
                blankToNull(request.description()),
                category,
                request.priority() == null ? TaskPriority.MEDIUM : request.priority(),
                request.plannedFor(),
                request.plannedStart() == null ? null : LocalTime.parse(request.plannedStart(), HH_MM),
                request.dueAt() == null ? null : request.dueAt().toInstant(),
                request.estimatedMinutes(),
                recurrence,
                courseId,
                exam == null ? null : exam.getId());
    }

    /** "plannedFor,asc" style, allow-listed; default newest first. Ties break on id for stable paging. */
    static Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"));
        }
        String[] parts = sort.split(",", -1);
        String field = parts[0].strip();
        String direction = parts.length > 1 ? parts[1].strip().toLowerCase(Locale.ROOT) : "asc";
        if (parts.length > 2 || !SORTABLE.contains(field) || !(direction.equals("asc") || direction.equals("desc"))) {
            throw ApiException.invalidField("sort", "Sort by plannedFor, dueAt or createdAt, e.g. plannedFor,asc.");
        }
        Sort.Order order = direction.equals("asc") ? Sort.Order.asc(field).nullsLast() : Sort.Order.desc(field).nullsLast();
        return Sort.by(order, Sort.Order.asc("id"));
    }

    private Task require(UUID userId, UUID taskId) {
        return tasks.findByIdAndUserId(taskId, userId).orElseThrow(ApiException::notFound);
    }

    private static List<Task> concat(List<Task> a, List<Task> b) {
        List<Task> all = new ArrayList<>(a);
        all.addAll(b);
        return all;
    }

    /** One course lookup, one exam lookup and one timezone lookup for a batch. */
    private Responses responsesFor(UUID userId, List<Task> batch) {
        Set<UUID> courseIds = batch.stream().map(Task::getCourseId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<UUID> examIds = batch.stream().map(Task::getExamId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Course> courseById = courseIds.isEmpty()
                ? Map.of()
                : courses.findAllById(courseIds).stream().collect(Collectors.toMap(Course::getId, Function.identity()));
        Map<UUID, Exam> examById = examIds.isEmpty()
                ? Map.of()
                : exams.findAllById(examIds).stream().collect(Collectors.toMap(Exam::getId, Function.identity()));
        return new Responses(courseById, examById, userClock.now(), userClock.zoneOf(userId));
    }

    private record Responses(Map<UUID, Course> courses, Map<UUID, Exam> exams, Instant now, ZoneId zone) {

        TaskResponse of(Task t) {
            Course course = t.getCourseId() == null ? null : courses.get(t.getCourseId());
            Exam exam = t.getExamId() == null ? null : exams.get(t.getExamId());
            boolean open = t.getStatus().isOpen();
            return new TaskResponse(
                    t.getId(),
                    t.getTitle(),
                    t.getDescription(),
                    t.getCategory(),
                    t.getPriority(),
                    t.getStatus(),
                    t.getPlannedFor(),
                    t.getPlannedStart() == null ? null : t.getPlannedStart().format(HH_MM),
                    t.getDueAt(),
                    t.getEstimatedMinutes(),
                    t.getCompletedAt(),
                    t.getRecurrence(),
                    t.getSeriesId(),
                    t.getCourseId(),
                    course == null ? null : course.getCode(),
                    course == null ? null : course.getName(),
                    t.getExamId(),
                    exam == null ? null : exam.getTitle(),
                    open && t.getDueAt() != null && t.getDueAt().isBefore(now),
                    open && t.getDueAt() != null ? Urgency.of(t.getDueAt(), now, zone) : null);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
