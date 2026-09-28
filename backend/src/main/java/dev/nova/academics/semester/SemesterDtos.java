package dev.nova.academics.semester;

import dev.nova.academics.grading.GradingScheme;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Bodies for /api/v1/semesters (docs/api.md §2.3). */
public final class SemesterDtos {

    private SemesterDtos() {}

    /** Create, or full replacement on update. {@code current: true} moves the "current" flag here. */
    public record SemesterRequest(
            @NotBlank(message = "Give the semester a name.") @Size(max = 40, message = "Keep it under 40 characters.")
                    String name,
            @NotNull(message = "Set the semester number.")
                    @Min(value = 1, message = "Must be 1 or more.")
                    @Max(value = SemesterService.MAX_SEMESTERS, message = "Must be 20 or less.")
                    Integer ordinal,
            LocalDate startsOn,
            LocalDate endsOn,
            @NotNull(message = "Choose a grading scheme.") UUID gradingSchemeId,
            @NotNull(message = "Say whether this is your current semester.") Boolean current,
            @DecimalMin(value = "0", inclusive = false, message = "Must be more than 0.")
                    @DecimalMax(value = "100", inclusive = false, message = "Must be less than 100.")
                    @Digits(integer = 3, fraction = 2, message = "Use at most 2 decimal places.")
                    BigDecimal attendanceTarget) {}

    public record SchemeSummary(UUID id, String name, BigDecimal maxPoints) {

        static SchemeSummary from(GradingScheme s) {
            return new SchemeSummary(s.getId(), s.getName(), s.getMaxPoints());
        }
    }

    public record SemesterResponse(
            UUID id,
            String name,
            int ordinal,
            LocalDate startsOn,
            LocalDate endsOn,
            boolean current,
            BigDecimal attendanceTarget,
            SchemeSummary gradingScheme) {

        static SemesterResponse from(Semester s, GradingScheme scheme) {
            return new SemesterResponse(
                    s.getId(),
                    s.getName(),
                    s.getOrdinal(),
                    s.getStartsOn(),
                    s.getEndsOn(),
                    s.isCurrent(),
                    s.getAttendanceTarget(),
                    SchemeSummary.from(scheme));
        }
    }
}
