package dev.nova.developer.project;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/projects (docs/api.md §2.12). */
public final class ProjectDtos {

    private ProjectDtos() {}

    /** Create, or full replacement on update. Links must be http(s) web addresses. */
    public record ProjectRequest(
            @NotBlank(message = "Name the project.") @Size(max = 100, message = "Keep it under 100 characters.")
                    String name,
            @Size(max = 4000, message = "Keep the description under 4000 characters.") String description,
            List<String> techStack,
            String repoUrl,
            String demoUrl,
            ProjectStatus status,
            LocalDate startedOn,
            LocalDate targetOn) {}

    /** Add a milestone, or replace its title and due date. */
    public record MilestoneRequest(
            @NotBlank(message = "Name the milestone.") @Size(max = 160, message = "Keep it under 160 characters.")
                    String title,
            LocalDate dueOn) {}

    /** Tick or move a milestone; at least one. {@code position} renumbers the others. */
    public record MilestonePatch(Boolean done, @Min(value = 0, message = "Must be 0 or more.") Integer position) {}

    /** From milestones only; {@code percentage} rounds half-up and is null without milestones. */
    public record Progress(int done, int total, Integer percentage) {

        static Progress of(long done, long total) {
            Integer pct = total == 0 ? null : Math.toIntExact((200 * done + total) / (2 * total));
            return new Progress(Math.toIntExact(done), Math.toIntExact(total), pct);
        }
    }

    /** {@code overdue}: open and due before today in the user's timezone. */
    public record MilestoneResponse(
            UUID id, String title, LocalDate dueOn, int position, boolean done, Instant doneAt, boolean overdue) {}

    /**
     * {@code nextMilestone} is the first open milestone in checklist order; {@code openTasks} counts
     * linked tasks that aren't done.
     */
    public record ProjectResponse(
            UUID id,
            String name,
            String description,
            List<String> techStack,
            String repoUrl,
            String demoUrl,
            ProjectStatus status,
            LocalDate startedOn,
            LocalDate targetOn,
            Progress progress,
            MilestoneResponse nextMilestone,
            long openTasks,
            List<MilestoneResponse> milestones,
            Instant createdAt) {}
}
