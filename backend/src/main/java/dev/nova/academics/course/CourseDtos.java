package dev.nova.academics.course;

import dev.nova.academics.grading.GradeDefinition;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

/** Bodies for /api/v1/courses (docs/api.md §2.4). */
public final class CourseDtos {

    private CourseDtos() {}

    /** Create, or full replacement on update. Attendance baselines arrive with Phase 2.2. */
    public record CourseRequest(
            @NotNull(message = "Choose a semester.") UUID semesterId,
            @Size(max = 20, message = "Keep it under 20 characters.") String code,
            @NotBlank(message = "Give the course a name.") @Size(max = 120, message = "Keep it under 120 characters.")
                    String name,
            @NotNull(message = "Set the credits.")
                    @DecimalMin(value = "0", message = "Can't be negative.")
                    @DecimalMax(value = "99.9", message = "Must be less than 100.")
                    @Digits(integer = 2, fraction = 1, message = "Use at most 1 decimal place.")
                    BigDecimal credits,
            @Size(max = 120, message = "Keep it under 120 characters.") String faculty,
            @Min(value = 0, message = "Must be between 0 and 359.") @Max(value = 359, message = "Must be between 0 and 359.")
                    Integer colorHue,
            @Size(max = 2000, message = "Keep notes under 2000 characters.") String notes,
            @DecimalMin(value = "0", inclusive = false, message = "Must be more than 0.")
                    @DecimalMax(value = "100", inclusive = false, message = "Must be less than 100.")
                    @Digits(integer = 3, fraction = 2, message = "Use at most 2 decimal places.")
                    BigDecimal attendanceTarget) {}

    public record GradeRequest(
            @NotNull(message = "Choose a grade.") UUID gradeDefinitionId,
            @NotNull(message = "Say whether the grade is final or expected.") GradeKind kind) {}

    public record CourseGrade(
            UUID gradeDefinitionId, String label, BigDecimal points, boolean passing, boolean countsInGpa, GradeKind kind) {

        static CourseGrade of(GradeDefinition definition, GradeKind kind) {
            return new CourseGrade(
                    definition.getId(),
                    definition.getLabel(),
                    definition.getPoints(),
                    definition.isPassing(),
                    definition.isCountsInGpa(),
                    kind);
        }
    }

    /** {@code grade} is null when the course isn't graded. */
    public record CourseResponse(
            UUID id,
            UUID semesterId,
            String code,
            String name,
            BigDecimal credits,
            String faculty,
            Integer colorHue,
            String notes,
            BigDecimal attendanceTarget,
            CourseGrade grade) {

        static CourseResponse from(Course c, GradeDefinition definition) {
            return new CourseResponse(
                    c.getId(),
                    c.getSemesterId(),
                    c.getCode(),
                    c.getName(),
                    c.getCredits(),
                    c.getFaculty(),
                    c.getColorHue(),
                    c.getNotes(),
                    c.getAttendanceTarget(),
                    definition == null ? null : CourseGrade.of(definition, c.getGradeKind()));
        }
    }
}
