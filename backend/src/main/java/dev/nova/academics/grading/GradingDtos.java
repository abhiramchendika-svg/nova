package dev.nova.academics.grading;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/grading-schemes (docs/api.md §2.2). */
public final class GradingDtos {

    private GradingDtos() {}

    /**
     * Create or fully replace a scheme. The order of {@code grades} is the display order (best first).
     * On update, a grade with an {@code id} is edited in place (so courses graded with it keep their
     * grade); a grade without one is new; an existing grade left out is removed.
     */
    public record SchemeRequest(
            @NotBlank(message = "Give the scheme a name.") @Size(max = 60, message = "Keep it under 60 characters.")
                    String name,
            @NotNull(message = "Set the maximum grade point.")
                    @DecimalMin(value = "0", inclusive = false, message = "Must be more than 0.")
                    @DecimalMax(value = "99.99", message = "Must be less than 100.")
                    @Digits(integer = 2, fraction = 2, message = "Use at most 2 decimal places.")
                    BigDecimal maxPoints,
            @NotNull(message = "Add at least one grade.")
                    @Size(min = 1, max = 20, message = "Use between 1 and 20 grades.")
                    List<@Valid @NotNull GradeRequest> grades) {}

    public record GradeRequest(
            UUID id,
            @NotBlank(message = "Give the grade a label.") @Size(max = 8, message = "Use at most 8 characters.")
                    String label,
            @NotNull(message = "Set the grade point.")
                    @DecimalMin(value = "0", message = "Can't be negative.")
                    @Digits(integer = 2, fraction = 2, message = "Use at most 2 decimal places.")
                    BigDecimal points,
            @NotNull(message = "Say whether this grade is a pass.") Boolean passing,
            @NotNull(message = "Say whether this grade counts towards GPA.") Boolean countsInGpa) {}

    public record SchemeResponse(
            UUID id, String name, BigDecimal maxPoints, boolean builtIn, List<GradeResponse> grades) {

        static SchemeResponse from(GradingScheme s) {
            return new SchemeResponse(
                    s.getId(),
                    s.getName(),
                    s.getMaxPoints(),
                    s.isBuiltIn(),
                    s.getGrades().stream()
                            .sorted(Comparator.comparingInt(GradeDefinition::getPosition))
                            .map(GradeResponse::from)
                            .toList());
        }
    }

    public record GradeResponse(UUID id, String label, BigDecimal points, boolean passing, boolean countsInGpa) {

        static GradeResponse from(GradeDefinition g) {
            return new GradeResponse(g.getId(), g.getLabel(), g.getPoints(), g.isPassing(), g.isCountsInGpa());
        }
    }
}
