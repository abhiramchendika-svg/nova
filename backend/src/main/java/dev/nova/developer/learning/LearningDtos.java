package dev.nova.developer.learning;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/learning-goals (docs/api.md §2.12). */
public final class LearningDtos {

    private LearningDtos() {}

    /** Create, or full replacement on update. {@code topics} is a starter checklist, read on create only. */
    public record GoalRequest(
            @NotBlank(message = "Name what you’re learning.") @Size(max = 100, message = "Keep it under 100 characters.")
                    String title,
            @Size(max = 4000, message = "Keep the description under 4000 characters.") String description,
            GoalStatus status,
            LocalDate targetOn,
            @Size(max = 100, message = "Up to 100 topics.") List<@NotBlank(message = "Name each topic.") @Size(
                            max = 160,
                            message = "Keep each topic under 160 characters.") String> topics) {}

    public record TopicRequest(
            @NotBlank(message = "Name the topic.") @Size(max = 160, message = "Keep it under 160 characters.")
                    String title) {}

    /** Any combination; at least one. {@code position} moves the topic and renumbers the others. */
    public record TopicPatch(
            Boolean done,
            @Size(max = 160, message = "Keep it under 160 characters.") String title,
            @Min(value = 0, message = "Must be 0 or more.") Integer position) {}

    public record ResourceRequest(
            @NotBlank(message = "Give the link a title.") @Size(max = 120, message = "Keep it under 120 characters.")
                    String title,
            @NotBlank(message = "Paste the web address.") String url) {}

    /** From topics only; {@code percentage} rounds half-up and is null without topics. */
    public record Progress(int done, int total, Integer percentage) {

        static Progress of(long done, long total) {
            Integer pct = total == 0 ? null : Math.toIntExact((200 * done + total) / (2 * total));
            return new Progress(Math.toIntExact(done), Math.toIntExact(total), pct);
        }
    }

    public record TopicResponse(UUID id, String title, int position, boolean done, Instant doneAt) {}

    public record ResourceResponse(UUID id, String title, String url) {}

    /**
     * {@code nextTopic} is the first open topic in checklist order; {@code openTasks} counts linked
     * study tasks that aren't done.
     */
    public record GoalResponse(
            UUID id,
            String title,
            String description,
            GoalStatus status,
            LocalDate targetOn,
            Progress progress,
            TopicResponse nextTopic,
            long openTasks,
            List<TopicResponse> topics,
            List<ResourceResponse> resources,
            Instant createdAt) {}
}
