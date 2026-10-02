package dev.nova.developer.internship;

import dev.nova.developer.internship.InternshipRules.Funnel;
import dev.nova.developer.internship.InternshipRules.Rate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/internships (docs/api.md §2.12). */
public final class InternshipDtos {

    private InternshipDtos() {}

    /**
     * Create, or full replacement on update. {@code appliedOn} defaults to today once the status is
     * past "saved"; a status change here is recorded in the history like a PATCH.
     */
    public record InternshipRequest(
            @NotBlank(message = "Name the company.") @Size(max = 120, message = "Keep it under 120 characters.")
                    String company,
            @NotBlank(message = "Name the role.") @Size(max = 120, message = "Keep it under 120 characters.")
                    String role,
            @Size(max = 120, message = "Keep it under 120 characters.") String location,
            String jobUrl,
            @Size(max = 60, message = "Keep it under 60 characters.") String source,
            InternshipStatus status,
            LocalDate appliedOn,
            OffsetDateTime deadlineAt,
            @Size(max = 120, message = "Keep it under 120 characters.") String nextStep,
            OffsetDateTime nextStepAt,
            @Size(max = 60, message = "Keep it under 60 characters.") String resumeVersion,
            @Size(max = 4000, message = "Keep notes under 4000 characters.") String notes) {}

    public record StatusRequest(@NotNull(message = "Choose a status.") InternshipStatus status) {}

    public record StatusChange(InternshipStatus fromStatus, InternshipStatus toStatus, Instant changedAt) {}

    /**
     * {@code deadlineMissed}: still saved and the apply-by deadline has passed. {@code history} is
     * every status change, oldest first; {@code openTasks} counts linked tasks that aren't done.
     */
    public record InternshipResponse(
            UUID id,
            String company,
            String role,
            String location,
            String jobUrl,
            String source,
            InternshipStatus status,
            LocalDate appliedOn,
            Instant deadlineAt,
            boolean deadlineMissed,
            String nextStep,
            Instant nextStepAt,
            String resumeVersion,
            String notes,
            long openTasks,
            List<StatusChange> history,
            Instant createdAt,
            Instant updatedAt) {}

    /** One month's applications (by applied date) and how far they've got, plus the all-time funnel. */
    public record AnalyticsResponse(
            String month,
            int applied,
            int assessments,
            int interviews,
            int offers,
            int rejected,
            Rate responseRate,
            Funnel allTime) {}
}
