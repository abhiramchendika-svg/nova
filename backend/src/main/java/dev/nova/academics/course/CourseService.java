package dev.nova.academics.course;

import dev.nova.academics.course.CourseDtos.CourseRequest;
import dev.nova.academics.course.CourseDtos.CourseResponse;
import dev.nova.academics.course.CourseDtos.GradeRequest;
import dev.nova.academics.grading.GradeDefinition;
import dev.nova.academics.grading.GradingSchemeRepository;
import dev.nova.academics.semester.Semester;
import dev.nova.academics.semester.SemesterRepository;
import dev.nova.common.web.ApiException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Courses and their grades. Invariant kept here (and relied on by GPA): a course's grade always
 * comes from its semester's grading scheme.
 */
@Service
public class CourseService {

    static final int MAX_COURSES_PER_SEMESTER = 40;

    private final CourseRepository courses;
    private final SemesterRepository semesters;
    private final GradingSchemeRepository schemes;

    public CourseService(CourseRepository courses, SemesterRepository semesters, GradingSchemeRepository schemes) {
        this.courses = courses;
        this.semesters = semesters;
        this.schemes = schemes;
    }

    /** Courses of the given semester, or of the current one when none is given (empty if there's none). */
    @Transactional(readOnly = true)
    public List<CourseResponse> list(UUID userId, UUID semesterId) {
        Semester semester = semesterId == null
                ? semesters.findByUserIdAndCurrentTrue(userId).orElse(null)
                : semesters.findByIdAndUserId(semesterId, userId).orElseThrow(ApiException::notFound);
        if (semester == null) {
            return List.of();
        }
        Map<UUID, GradeDefinition> grades = gradesOf(userId, semester);
        return courses.findBySemesterIdAndUserIdOrderByNameAsc(semester.getId(), userId).stream()
                .map(c -> toResponse(c, grades))
                .toList();
    }

    @Transactional(readOnly = true)
    public CourseResponse get(UUID userId, UUID courseId) {
        Course course = require(userId, courseId);
        return toResponse(course, gradesOf(userId, semesterOf(course)));
    }

    @Transactional
    public CourseResponse create(UUID userId, CourseRequest request) {
        Semester semester = requireSemester(userId, request);
        requireRoomIn(semester);
        Course course = new Course(userId);
        apply(course, request);
        return toResponse(courses.saveAndFlush(course), Map.of());
    }

    @Transactional
    public CourseResponse update(UUID userId, UUID courseId, CourseRequest request) {
        Course course = require(userId, courseId);
        Semester target = requireSemester(userId, request);
        if (!target.getId().equals(course.getSemesterId())) {
            requireRoomIn(target);
            Semester from = semesterOf(course);
            if (course.isGraded() && !from.getGradingSchemeId().equals(target.getGradingSchemeId())) {
                throw ApiException.ruleViolation(
                        "semesterId",
                        "This course's grade comes from another grading scheme. Clear the grade before moving it.");
            }
        }
        apply(course, request);
        courses.flush();
        return toResponse(course, gradesOf(userId, target));
    }

    @Transactional
    public void delete(UUID userId, UUID courseId) {
        courses.delete(require(userId, courseId));
    }

    /** Sets a FINAL or EXPECTED grade, which must be one of the semester's scheme's grades. */
    @Transactional
    public CourseResponse setGrade(UUID userId, UUID courseId, GradeRequest request) {
        Course course = require(userId, courseId);
        Map<UUID, GradeDefinition> grades = gradesOf(userId, semesterOf(course));
        GradeDefinition definition = grades.get(request.gradeDefinitionId());
        if (definition == null) {
            throw ApiException.invalidField(
                    "gradeDefinitionId", "Choose a grade from this semester's grading scheme.");
        }
        course.grade(definition.getId(), request.kind());
        courses.flush();
        return toResponse(course, grades);
    }

    @Transactional
    public void clearGrade(UUID userId, UUID courseId) {
        require(userId, courseId).clearGrade();
    }

    // ───────────── helpers ─────────────

    private Course require(UUID userId, UUID courseId) {
        return courses.findByIdAndUserId(courseId, userId).orElseThrow(ApiException::notFound);
    }

    /**
     * A semester referenced in a request body. Someone else's semester gets the same answer as a
     * missing one, so the response can't reveal that it exists.
     */
    private Semester requireSemester(UUID userId, CourseRequest request) {
        return semesters.findByIdAndUserId(request.semesterId(), userId)
                .orElseThrow(() -> ApiException.invalidField("semesterId", "Choose one of your semesters."));
    }

    /** The course's own semester: always exists and belongs to the same user (composite foreign key). */
    private Semester semesterOf(Course course) {
        return semesters.findById(course.getSemesterId()).orElseThrow(ApiException::notFound);
    }

    private void requireRoomIn(Semester semester) {
        if (courses.countBySemesterId(semester.getId()) >= MAX_COURSES_PER_SEMESTER) {
            throw ApiException.ruleViolation(
                    "semesterId", "A semester can have up to " + MAX_COURSES_PER_SEMESTER + " courses.");
        }
    }

    private Map<UUID, GradeDefinition> gradesOf(UUID userId, Semester semester) {
        return schemes.findVisible(semester.getGradingSchemeId(), userId)
                .map(s -> s.getGrades().stream().collect(Collectors.toMap(GradeDefinition::getId, Function.identity())))
                .orElse(Map.of());
    }

    private static CourseResponse toResponse(Course course, Map<UUID, GradeDefinition> grades) {
        GradeDefinition definition = course.isGraded() ? grades.get(course.getGradeDefinitionId()) : null;
        return CourseResponse.from(course, definition);
    }

    private static void apply(Course course, CourseRequest request) {
        course.apply(
                request.semesterId(),
                blankToNull(request.code()),
                request.name().strip(),
                request.credits(),
                blankToNull(request.faculty()),
                request.colorHue(),
                blankToNull(request.notes()),
                request.attendanceTarget());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
