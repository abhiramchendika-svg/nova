package dev.nova.academics.grades;

import dev.nova.academics.grades.GpaCalculator.ExclusionReason;
import dev.nova.academics.grades.GpaCalculator.Unavailable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/grades (docs/api.md §2.3). */
public final class GradesDtos {

    private GradesDtos() {}

    /**
     * "What if I got an A+ in Compilers?" Each override is treated as an EXPECTED grade for that
     * course, so it moves the projected figures and never the official CGPA. Nothing is saved.
     */
    public record WhatIfRequest(
            @NotNull(message = "Add at least an empty list of overrides.")
                    @Size(max = 800, message = "Too many overrides.")
                    List<@Valid @NotNull GradeOverride> overrides) {}

    public record GradeOverride(
            @NotNull(message = "Choose a course.") UUID courseId,
            @NotNull(message = "Choose a grade.") UUID gradeDefinitionId) {}

    /**
     * All numbers are rounded half-up to 2 decimals. GPA fields are null when nothing counts yet;
     * {@code cgpaUnavailableReason} explains a null CGPA that isn't simply "no grades yet".
     */
    public record GradesSummaryResponse(
            BigDecimal cgpa,
            BigDecimal projectedCgpa,
            BigDecimal scale,
            Unavailable cgpaUnavailableReason,
            BigDecimal totalCredits,
            BigDecimal completedCredits,
            List<SemesterGrades> semesters,
            List<ExcludedCourse> excluded) {}

    public record SemesterGrades(
            UUID id,
            String name,
            int ordinal,
            boolean current,
            BigDecimal scale,
            BigDecimal gpa,
            BigDecimal projectedGpa,
            BigDecimal credits,
            BigDecimal completedCredits,
            boolean hasExpectedGrades) {}

    public record ExcludedCourse(UUID courseId, String courseName, UUID semesterId, ExclusionReason reason) {}
}
