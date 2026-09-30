package dev.nova.academics.assignment;

import dev.nova.academics.assignment.AssignmentDtos.AssignmentRequest;
import dev.nova.academics.assignment.AssignmentDtos.AssignmentResponse;
import dev.nova.academics.assignment.AssignmentDtos.ProgressRequest;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.common.web.ApiException;
import dev.nova.common.web.PageResponse;
import dev.nova.user.UserClock;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssignmentService {

    static final Set<AssignmentStatus> OPEN = Set.of(AssignmentStatus.NOT_STARTED, AssignmentStatus.IN_PROGRESS);
    private static final Set<String> SORTABLE = Set.of("dueAt", "createdAt");

    private final AssignmentRepository assignments;
    private final CourseRepository courses;
    private final UserClock userClock;

    public AssignmentService(AssignmentRepository assignments, CourseRepository courses, UserClock userClock) {
        this.assignments = assignments;
        this.courses = courses;
        this.userClock = userClock;
    }

    /** Optional filters for the list endpoint; null means "don't filter on this". */
    public record Filter(
            Collection<AssignmentStatus> statuses,
            UUID courseId,
            AssignmentPriority priority,
            OffsetDateTime dueFrom,
            OffsetDateTime dueTo) {}

    @Transactional(readOnly = true)
    public PageResponse<AssignmentResponse> list(UUID userId, Filter filter, String sort, int page, int size) {
        PageResponse.validate(page, size);
        Specification<Assignment> spec = (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(cb.equal(root.get("userId"), userId));
            if (filter.courseId() != null) {
                where.add(cb.equal(root.get("courseId"), filter.courseId()));
            }
            if (filter.statuses() != null && !filter.statuses().isEmpty()) {
                where.add(root.get("status").in(filter.statuses()));
            }
            if (filter.priority() != null) {
                where.add(cb.equal(root.get("priority"), filter.priority()));
            }
            if (filter.dueFrom() != null) {
                where.add(cb.greaterThanOrEqualTo(root.<Instant>get("dueAt"), filter.dueFrom().toInstant()));
            }
            if (filter.dueTo() != null) {
                where.add(cb.lessThan(root.<Instant>get("dueAt"), filter.dueTo().toInstant()));
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
        Page<Assignment> result = assignments.findAll(spec, PageRequest.of(page, size, parseSort(sort)));
        Responses responses = responsesFor(userId, result.getContent());
        return PageResponse.of(result, responses::of);
    }

    @Transactional(readOnly = true)
    public AssignmentResponse get(UUID userId, UUID assignmentId) {
        Assignment assignment = require(userId, assignmentId);
        return responsesFor(userId, List.of(assignment)).of(assignment);
    }

    @Transactional
    public AssignmentResponse create(UUID userId, AssignmentRequest request) {
        Assignment assignment = new Assignment(userId);
        apply(userId, assignment, request);
        assignments.saveAndFlush(assignment);
        return responsesFor(userId, List.of(assignment)).of(assignment);
    }

    @Transactional
    public AssignmentResponse update(UUID userId, UUID assignmentId, AssignmentRequest request) {
        Assignment assignment = require(userId, assignmentId);
        apply(userId, assignment, request);
        assignments.flush();
        return responsesFor(userId, List.of(assignment)).of(assignment);
    }

    @Transactional
    public AssignmentResponse updateProgress(UUID userId, UUID assignmentId, ProgressRequest request) {
        if (request.status() == null && request.progressPct() == null) {
            throw ApiException.invalidField("status", "Send a status, a progress value, or both.");
        }
        Assignment assignment = require(userId, assignmentId);
        assignment.updateProgress(request.status(), request.progressPct(), userClock.now());
        assignments.flush();
        return responsesFor(userId, List.of(assignment)).of(assignment);
    }

    @Transactional
    public void delete(UUID userId, UUID assignmentId) {
        assignments.delete(require(userId, assignmentId));
    }

    /** Open work for a course, soonest first (the course overview shows the first few). */
    @Transactional(readOnly = true)
    public List<AssignmentResponse> openForCourse(UUID userId, UUID courseId, int limit) {
        List<Assignment> open = assignments.findByCourseIdAndUserIdAndStatusInOrderByDueAtAsc(
                courseId, userId, OPEN, PageRequest.of(0, limit));
        Responses responses = responsesFor(userId, open);
        return open.stream().map(responses::of).toList();
    }

    @Transactional(readOnly = true)
    public long countOpen(UUID userId, UUID courseId) {
        return assignments.countByCourseIdAndUserIdAndStatusIn(courseId, userId, OPEN);
    }

    @Transactional(readOnly = true)
    public long countOverdue(UUID userId, UUID courseId) {
        return assignments.countByCourseIdAndUserIdAndStatusInAndDueAtBefore(courseId, userId, OPEN, userClock.now());
    }

    // ───────────── helpers ─────────────

    /** "dueAt,asc" style, allow-listed fields only (docs/api.md §1). Ties break on id for stable paging. */
    static Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Order.asc("dueAt"), Sort.Order.asc("id"));
        }
        String[] parts = sort.split(",", -1);
        String field = parts[0].strip();
        String direction = parts.length > 1 ? parts[1].strip().toLowerCase(Locale.ROOT) : "asc";
        if (parts.length > 2 || !SORTABLE.contains(field) || !(direction.equals("asc") || direction.equals("desc"))) {
            throw ApiException.invalidField("sort", "Sort by dueAt or createdAt, e.g. dueAt,asc.");
        }
        Sort.Order order = direction.equals("asc") ? Sort.Order.asc(field) : Sort.Order.desc(field);
        return Sort.by(order, Sort.Order.asc("id"));
    }

    private void apply(UUID userId, Assignment assignment, AssignmentRequest request) {
        Course course = courses.findByIdAndUserId(request.courseId(), userId)
                .orElseThrow(() -> ApiException.invalidField("courseId", "Choose one of your courses."));
        assignment.edit(
                course.getId(),
                request.title().strip(),
                blankToNull(request.description()),
                request.dueAt().toInstant(),
                request.priority() == null ? AssignmentPriority.MEDIUM : request.priority(),
                request.estimatedMinutes());
    }

    private Assignment require(UUID userId, UUID assignmentId) {
        return assignments.findByIdAndUserId(assignmentId, userId).orElseThrow(ApiException::notFound);
    }

    /** Builds responses for a batch: one course lookup and one timezone lookup for all of them. */
    private Responses responsesFor(UUID userId, List<Assignment> batch) {
        Set<UUID> courseIds = batch.stream().map(Assignment::getCourseId).collect(Collectors.toSet());
        Map<UUID, Course> coursesById = courses.findAllById(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));
        return new Responses(coursesById, userClock.now(), userClock.zoneOf(userId));
    }

    private record Responses(Map<UUID, Course> courses, Instant now, ZoneId zone) {

        AssignmentResponse of(Assignment a) {
            Course course = courses.get(a.getCourseId());
            return new AssignmentResponse(
                    a.getId(),
                    a.getCourseId(),
                    course == null ? null : course.getCode(),
                    course == null ? null : course.getName(),
                    a.getTitle(),
                    a.getDescription(),
                    a.getDueAt(),
                    a.getPriority(),
                    a.getStatus(),
                    a.getEstimatedMinutes(),
                    a.getProgressPct(),
                    a.getSubmittedAt(),
                    a.getCompletedAt(),
                    a.getStatus().isOpen() ? Urgency.of(a.getDueAt(), now, zone) : null);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
