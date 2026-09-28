package dev.nova.academics.grades;

import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.course.GradeKind;
import dev.nova.academics.grades.GpaCalculator.CourseInput;
import dev.nova.academics.grades.GpaCalculator.GradeInput;
import dev.nova.academics.grades.GpaCalculator.Result;
import dev.nova.academics.grades.GpaCalculator.SemesterInput;
import dev.nova.academics.grades.GpaCalculator.SemesterResult;
import dev.nova.academics.grades.GradesDtos.ExcludedCourse;
import dev.nova.academics.grades.GradesDtos.GradeOverride;
import dev.nova.academics.grades.GradesDtos.GradesSummaryResponse;
import dev.nova.academics.grades.GradesDtos.SemesterGrades;
import dev.nova.academics.grades.GradesDtos.WhatIfRequest;
import dev.nova.academics.grading.GradeDefinition;
import dev.nova.academics.grading.GradingScheme;
import dev.nova.academics.grading.GradingSchemeRepository;
import dev.nova.academics.semester.Semester;
import dev.nova.academics.semester.SemesterRepository;
import dev.nova.common.web.ApiException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loads a user's academic record in three queries (semesters, courses, grading schemes) and hands it
 * to {@link GpaCalculator}. GPA is never stored, so it can't go stale.
 */
@Service
public class GradesService {

    private final SemesterRepository semesters;
    private final CourseRepository courses;
    private final GradingSchemeRepository schemes;

    public GradesService(SemesterRepository semesters, CourseRepository courses, GradingSchemeRepository schemes) {
        this.semesters = semesters;
        this.courses = courses;
        this.schemes = schemes;
    }

    @Transactional(readOnly = true)
    public GradesSummaryResponse summary(UUID userId) {
        AcademicRecord record = load(userId);
        return calculate(record, Map.of());
    }

    /**
     * Stateless: each override is used in place of the course's grade for the projected figures only.
     * The official figures still use the stored grades. Nothing is saved.
     */
    @Transactional(readOnly = true)
    public GradesSummaryResponse whatIf(UUID userId, WhatIfRequest request) {
        AcademicRecord record = load(userId);
        Map<UUID, GradeDefinition> overrides = new HashMap<>();
        for (int i = 0; i < request.overrides().size(); i++) {
            GradeOverride override = request.overrides().get(i);
            String field = "overrides[" + i + "]";
            Course course = record.courses().get(override.courseId());
            if (course == null) {
                throw ApiException.invalidField(field + ".courseId", "Choose one of your courses.");
            }
            if (overrides.containsKey(course.getId())) {
                throw ApiException.invalidField(field + ".courseId", "Each course can only appear once.");
            }
            GradeDefinition grade = record.grades().get(override.gradeDefinitionId());
            UUID courseScheme = record.semesters().get(course.getSemesterId()).getGradingSchemeId();
            if (grade == null || !courseScheme.equals(record.schemeOfGrade().get(grade.getId()))) {
                throw ApiException.invalidField(
                        field + ".gradeDefinitionId", "Choose a grade from that course's grading scheme.");
            }
            overrides.put(course.getId(), grade);
        }
        return calculate(record, overrides);
    }

    // ───────────── helpers ─────────────

    /** Everything GPA depends on, indexed by id. Semesters are kept in chronological order. */
    private record AcademicRecord(
            Map<UUID, Semester> semesters,
            Map<UUID, Course> courses,
            Map<UUID, GradingScheme> schemes,
            Map<UUID, GradeDefinition> grades,
            Map<UUID, UUID> schemeOfGrade) {}

    private AcademicRecord load(UUID userId) {
        Map<UUID, Semester> semestersById = new LinkedHashMap<>();
        semesters.findByUserIdOrderByOrdinalAsc(userId).forEach(s -> semestersById.put(s.getId(), s));
        Map<UUID, Course> coursesById = courses.findByUserId(userId).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));
        Map<UUID, GradingScheme> schemesById = new HashMap<>();
        Map<UUID, GradeDefinition> grades = new HashMap<>();
        Map<UUID, UUID> schemeOfGrade = new HashMap<>();
        for (GradingScheme scheme : schemes.findVisibleTo(userId)) {
            schemesById.put(scheme.getId(), scheme);
            for (GradeDefinition grade : scheme.getGrades()) {
                grades.put(grade.getId(), grade);
                schemeOfGrade.put(grade.getId(), scheme.getId());
            }
        }
        return new AcademicRecord(semestersById, coursesById, schemesById, grades, schemeOfGrade);
    }

    private static GradesSummaryResponse calculate(AcademicRecord record, Map<UUID, GradeDefinition> overrides) {
        Map<UUID, List<Course>> bySemester = record.courses().values().stream()
                .sorted(Comparator.comparing(Course::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.groupingBy(Course::getSemesterId));

        List<SemesterInput> inputs = new ArrayList<>();
        for (Semester semester : record.semesters().values()) {
            List<CourseInput> courseInputs = bySemester.getOrDefault(semester.getId(), List.of()).stream()
                    .map(c -> toCourseInput(c, record, overrides))
                    .toList();
            GradingScheme scheme = record.schemes().get(semester.getGradingSchemeId());
            inputs.add(new SemesterInput(semester.getId(), scheme.getMaxPoints(), courseInputs));
        }

        Result result = GpaCalculator.calculate(inputs);

        List<SemesterGrades> semesterGrades = new ArrayList<>();
        for (SemesterResult r : result.semesters()) {
            Semester s = record.semesters().get(r.semesterId());
            semesterGrades.add(new SemesterGrades(
                    s.getId(),
                    s.getName(),
                    s.getOrdinal(),
                    s.isCurrent(),
                    record.schemes().get(s.getGradingSchemeId()).getMaxPoints(),
                    r.gpa(),
                    r.projectedGpa(),
                    r.credits(),
                    r.completedCredits(),
                    r.hasExpectedGrades()));
        }
        List<ExcludedCourse> excluded = result.excluded().stream()
                .map(e -> new ExcludedCourse(e.courseId(), e.courseName(), e.semesterId(), e.reason()))
                .toList();
        return new GradesSummaryResponse(
                result.cgpa(),
                result.projectedCgpa(),
                result.scale(),
                result.cgpaUnavailableReason(),
                result.totalCredits(),
                result.completedCredits(),
                semesterGrades,
                excluded);
    }

    /** Stored grade for official figures, plus a what-if override (as EXPECTED) for projected ones. */
    private static CourseInput toCourseInput(Course course, AcademicRecord record, Map<UUID, GradeDefinition> overrides) {
        GradeInput stored = null;
        if (course.isGraded()) {
            GradeDefinition definition = record.grades().get(course.getGradeDefinitionId());
            stored = definition == null ? null : toInput(definition, course.getGradeKind());
        }
        GradeDefinition override = overrides.get(course.getId());
        GradeInput whatIf = override == null ? null : toInput(override, GradeKind.EXPECTED);
        return new CourseInput(course.getId(), course.getName(), course.getCredits(), stored, whatIf);
    }

    private static GradeInput toInput(GradeDefinition grade, GradeKind kind) {
        return new GradeInput(grade.getPoints(), grade.isPassing(), grade.isCountsInGpa(), kind);
    }
}
