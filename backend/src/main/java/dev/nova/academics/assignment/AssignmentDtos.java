package dev.nova.academics.assignment;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Bodies for /api/v1/assignments (docs/api.md §2.6). */
public final class AssignmentDtos {

    private AssignmentDtos() {}

    /** Create, or full replacement on update. {@code dueAt} carries its offset, e.g. 2026-10-03T23:59:00+05:30. */
    public record AssignmentRequest(
            @NotNull(message = "Choose a course.") UUID courseId,
            @NotBlank(message = "Give the assignment a title.") @Size(max = 160, message = "Keep it under 160 characters.")
                    String title,
            @Size(max = 4000, message = "Keep the description under 4000 characters.") String description,
            @NotNull(message = "Set when it’s due.") OffsetDateTime dueAt,
            AssignmentPriority priority,
            @Min(value = 1, message = "Must be at least 1 minute.")
                    @Max(value = 10_000, message = "That’s more than a week of work.")
                    Integer estimatedMinutes) {}

    /** Either or both. See {@link Assignment#updateProgress} for how they combine. */
    public record ProgressRequest(
            AssignmentStatus status,
            @Min(value = 0, message = "Must be between 0 and 100.") @Max(value = 100, message = "Must be between 0 and 100.")
                    Integer progressPct) {}

    /** {@code urgency} is null for submitted and completed work. */
    public record AssignmentResponse(
            UUID id,
            UUID courseId,
            String courseCode,
            String courseName,
            String title,
            String description,
            Instant dueAt,
            AssignmentPriority priority,
            AssignmentStatus status,
            Integer estimatedMinutes,
            int progressPct,
            Instant submittedAt,
            Instant completedAt,
            Urgency urgency) {}
}
