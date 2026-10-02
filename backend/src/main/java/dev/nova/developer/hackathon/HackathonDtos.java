package dev.nova.developer.hackathon;

import dev.nova.developer.hackathon.HackathonRules.DeadlineKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/hackathons (docs/api.md §2.12). */
public final class HackathonDtos {

    private HackathonDtos() {}

    /** Create, or full replacement on update. Links must be http(s) web addresses; empty means none. */
    public record HackathonRequest(
            @NotBlank(message = "Name the hackathon.") @Size(max = 120, message = "Keep it under 120 characters.")
                    String name,
            @Size(max = 120, message = "Keep it under 120 characters.") String organizer,
            HackathonMode mode,
            @Size(max = 120, message = "Keep it under 120 characters.") String location,
            String websiteUrl,
            LocalDate startsOn,
            LocalDate endsOn,
            OffsetDateTime registrationDeadline,
            OffsetDateTime submissionDeadline,
            HackathonStatus status,
            @Size(max = 80, message = "Keep it under 80 characters.") String teamName,
            @Size(max = 500, message = "Keep it under 500 characters.") String teamMembers,
            UUID projectId,
            @Size(max = 160, message = "Keep it under 160 characters.") String result,
            String repoUrl,
            String demoUrl,
            String certificateUrl,
            @Size(max = 4000, message = "Keep notes under 4000 characters.") String notes) {}

    /** The deadline that matters for the status; {@code missed} once it has passed. */
    public record DeadlineResponse(DeadlineKind kind, Instant at, boolean missed) {}

    /** An exam within the event's days or two days either side, on the user's calendar day. */
    public record ExamClash(UUID examId, String title, String courseCode, LocalDate on) {}

    /**
     * {@code past}: finished, skipped or over. {@code daysUntil} counts to the start (null when
     * undated). {@code deadline} and {@code examClashes} are only filled while it isn't past.
     */
    public record HackathonResponse(
            UUID id,
            String name,
            String organizer,
            HackathonMode mode,
            String location,
            String websiteUrl,
            LocalDate startsOn,
            LocalDate endsOn,
            Instant registrationDeadline,
            Instant submissionDeadline,
            HackathonStatus status,
            String teamName,
            String teamMembers,
            UUID projectId,
            String projectName,
            String result,
            String repoUrl,
            String demoUrl,
            String certificateUrl,
            String notes,
            boolean past,
            Long daysUntil,
            DeadlineResponse deadline,
            List<ExamClash> examClashes,
            long openTasks,
            Instant createdAt) {}
}
