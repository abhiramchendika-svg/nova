package dev.nova.academics.exam;

import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.ExamDtos.ExamRequest;
import dev.nova.academics.exam.ExamDtos.ExamResponse;
import dev.nova.academics.exam.ExamDtos.ExamSummary;
import dev.nova.academics.exam.ExamDtos.Prep;
import dev.nova.academics.exam.ExamDtos.TopicPatch;
import dev.nova.academics.exam.ExamDtos.TopicRequest;
import dev.nova.academics.exam.ExamDtos.TopicResponse;
import dev.nova.common.time.CalendarDays;
import dev.nova.common.web.ApiException;
import dev.nova.user.UserClock;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exams and their prep checklists. Topic positions are kept contiguous from 0 (the service
 * renumbers on move and delete), so the UI can treat them as list indexes.
 */
@Service
public class ExamService {

    static final int MAX_EXAMS_PER_COURSE = 50;
    static final int MAX_TOPICS_PER_EXAM = 100;
    private static final Sort SOONEST_FIRST = Sort.by(Sort.Order.asc("startsAt"), Sort.Order.asc("id"));

    private final ExamRepository exams;
    private final ExamTopicRepository topics;
    private final CourseRepository courses;
    private final UserClock userClock;

    public ExamService(
            ExamRepository exams, ExamTopicRepository topics, CourseRepository courses, UserClock userClock) {
        this.exams = exams;
        this.topics = topics;
        this.courses = courses;
        this.userClock = userClock;
    }

    /**
     * Exams soonest first. {@code upcoming} keeps those starting today or later in the user's
     * timezone, so this morning's exam still shows until the day ends.
     */
    @Transactional(readOnly = true)
    public List<ExamSummary> list(UUID userId, boolean upcoming, UUID courseId) {
        Instant startOfToday = upcoming ? startOfToday(userId) : null;
        Specification<Exam> spec = (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(cb.equal(root.get("userId"), userId));
            if (courseId != null) {
                where.add(cb.equal(root.get("courseId"), courseId));
            }
            if (startOfToday != null) {
                where.add(cb.greaterThanOrEqualTo(root.<Instant>get("startsAt"), startOfToday));
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
        return summaries(userId, exams.findAll(spec, SOONEST_FIRST));
    }

    /** The next few exams for a course (the course overview). */
    @Transactional(readOnly = true)
    public List<ExamSummary> upcomingForCourse(UUID userId, UUID courseId, int limit) {
        Instant startOfToday = startOfToday(userId);
        Specification<Exam> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("userId"), userId),
                cb.equal(root.get("courseId"), courseId),
                cb.greaterThanOrEqualTo(root.<Instant>get("startsAt"), startOfToday));
        return summaries(userId, exams.findAll(spec, PageRequest.of(0, limit, SOONEST_FIRST)).getContent());
    }

    @Transactional(readOnly = true)
    public ExamResponse get(UUID userId, UUID examId) {
        return detail(userId, require(userId, examId));
    }

    @Transactional
    public ExamResponse create(UUID userId, ExamRequest request) {
        Course course = requireCourse(userId, request);
        requireRoomIn(course);
        Exam exam = new Exam(userId);
        apply(exam, course, request);
        exams.saveAndFlush(exam);
        List<String> initial = request.topics() == null ? List.of() : request.topics();
        for (int i = 0; i < initial.size(); i++) {
            topics.save(new ExamTopic(userId, exam.getId(), initial.get(i).strip(), i));
        }
        topics.flush();
        return detail(userId, exam);
    }

    /** Replaces the exam's details. Topics are left alone (they have their own endpoints). */
    @Transactional
    public ExamResponse update(UUID userId, UUID examId, ExamRequest request) {
        Exam exam = require(userId, examId);
        Course course = requireCourse(userId, request);
        if (!course.getId().equals(exam.getCourseId())) {
            requireRoomIn(course);
        }
        apply(exam, course, request);
        exams.flush();
        return detail(userId, exam);
    }

    @Transactional
    public void delete(UUID userId, UUID examId) {
        exams.delete(require(userId, examId)); // topics go with it (on delete cascade)
    }

    /** Adds a topic at the end of the checklist; returns the updated exam. */
    @Transactional
    public ExamResponse addTopic(UUID userId, UUID examId, TopicRequest request) {
        Exam exam = require(userId, examId);
        long count = topics.countByExamId(exam.getId());
        if (count >= MAX_TOPICS_PER_EXAM) {
            throw ApiException.ruleViolation("title", "An exam can have up to " + MAX_TOPICS_PER_EXAM + " topics.");
        }
        topics.saveAndFlush(new ExamTopic(userId, exam.getId(), request.title().strip(), Math.toIntExact(count)));
        return detail(userId, exam);
    }

    /** Ticks, renames or moves a topic; returns the updated exam. */
    @Transactional
    public ExamResponse patchTopic(UUID userId, UUID examId, UUID topicId, TopicPatch patch) {
        if (patch.done() == null && patch.title() == null && patch.position() == null) {
            throw ApiException.invalidField("done", "Send done, title or position.");
        }
        if (patch.title() != null && patch.title().isBlank()) {
            throw ApiException.invalidField("title", "Name the topic.");
        }
        Exam exam = require(userId, examId);
        ExamTopic topic = topics.findByIdAndExamIdAndUserId(topicId, exam.getId(), userId)
                .orElseThrow(ApiException::notFound);
        if (patch.done() != null) {
            topic.markDone(patch.done(), userClock.now());
        }
        if (patch.title() != null) {
            topic.rename(patch.title().strip());
        }
        if (patch.position() != null) {
            List<ExamTopic> ordered = new ArrayList<>(ordered(userId, exam));
            if (patch.position() >= ordered.size()) {
                throw ApiException.invalidField(
                        "position", "Must be between 0 and " + (ordered.size() - 1) + ".");
            }
            ordered.removeIf(t -> t.getId().equals(topic.getId()));
            ordered.add(patch.position(), topic);
            renumber(ordered);
        }
        topics.flush();
        return detail(userId, exam);
    }

    @Transactional
    public void deleteTopic(UUID userId, UUID examId, UUID topicId) {
        Exam exam = require(userId, examId);
        ExamTopic topic = topics.findByIdAndExamIdAndUserId(topicId, exam.getId(), userId)
                .orElseThrow(ApiException::notFound);
        topics.delete(topic);
        List<ExamTopic> rest = new ArrayList<>(ordered(userId, exam));
        rest.removeIf(t -> t.getId().equals(topic.getId()));
        renumber(rest);
    }

    // ───────────── helpers ─────────────

    private static void renumber(List<ExamTopic> inOrder) {
        for (int i = 0; i < inOrder.size(); i++) {
            if (inOrder.get(i).getDisplayOrder() != i) {
                inOrder.get(i).moveTo(i);
            }
        }
    }

    private List<ExamTopic> ordered(UUID userId, Exam exam) {
        return topics.findByExamIdAndUserIdOrderByDisplayOrderAscCreatedAtAsc(exam.getId(), userId);
    }

    private Instant startOfToday(UUID userId) {
        ZoneId zone = userClock.zoneOf(userId);
        return LocalDate.ofInstant(userClock.now(), zone).atStartOfDay(zone).toInstant();
    }

    private Exam require(UUID userId, UUID examId) {
        return exams.findByIdAndUserId(examId, userId).orElseThrow(ApiException::notFound);
    }

    /** Someone else's course gets the same answer as a missing one. */
    private Course requireCourse(UUID userId, ExamRequest request) {
        return courses.findByIdAndUserId(request.courseId(), userId)
                .orElseThrow(() -> ApiException.invalidField("courseId", "Choose one of your courses."));
    }

    private void requireRoomIn(Course course) {
        if (exams.countByCourseId(course.getId()) >= MAX_EXAMS_PER_COURSE) {
            throw ApiException.ruleViolation(
                    "courseId", "A course can have up to " + MAX_EXAMS_PER_COURSE + " exams.");
        }
    }

    private static void apply(Exam exam, Course course, ExamRequest request) {
        exam.edit(
                course.getId(),
                request.title().strip(),
                request.kind() == null ? ExamKind.OTHER : request.kind(),
                request.startsAt().toInstant(),
                request.durationMinutes(),
                blankToNull(request.location()));
    }

    private ExamResponse detail(UUID userId, Exam exam) {
        List<ExamTopic> list = ordered(userId, exam);
        long done = list.stream().filter(ExamTopic::isDone).count();
        Course course = courses.findById(exam.getCourseId()).orElse(null);
        Instant now = userClock.now();
        ZoneId zone = userClock.zoneOf(userId);
        return new ExamResponse(
                exam.getId(),
                exam.getCourseId(),
                course == null ? null : course.getCode(),
                course == null ? null : course.getName(),
                exam.getTitle(),
                exam.getKind(),
                exam.getStartsAt(),
                exam.getDurationMinutes(),
                exam.getLocation(),
                CalendarDays.between(now, exam.getStartsAt(), zone),
                Prep.of(done, list.size()),
                list.stream().map(TopicResponse::from).toList());
    }

    /** One course lookup, one prep-count query and one timezone lookup for the whole batch. */
    private List<ExamSummary> summaries(UUID userId, List<Exam> batch) {
        if (batch.isEmpty()) {
            return List.of();
        }
        Set<UUID> courseIds = batch.stream().map(Exam::getCourseId).collect(Collectors.toSet());
        Map<UUID, Course> coursesById = courses.findAllById(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));
        Map<UUID, PrepCount> prep = topics.prepCounts(userId, batch.stream().map(Exam::getId).toList()).stream()
                .collect(Collectors.toMap(PrepCount::examId, Function.identity()));
        Instant now = userClock.now();
        ZoneId zone = userClock.zoneOf(userId);
        return batch.stream()
                .map(e -> {
                    Course course = coursesById.get(e.getCourseId());
                    PrepCount counts = prep.get(e.getId());
                    return new ExamSummary(
                            e.getId(),
                            e.getCourseId(),
                            course == null ? null : course.getCode(),
                            course == null ? null : course.getName(),
                            e.getTitle(),
                            e.getKind(),
                            e.getStartsAt(),
                            e.getDurationMinutes(),
                            e.getLocation(),
                            CalendarDays.between(now, e.getStartsAt(), zone),
                            counts == null ? Prep.of(0, 0) : Prep.of(counts.done(), counts.total()));
                })
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
