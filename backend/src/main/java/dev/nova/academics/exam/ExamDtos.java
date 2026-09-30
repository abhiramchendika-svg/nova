package dev.nova.academics.exam;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/exams (docs/api.md §2.7). */
public final class ExamDtos {

    private ExamDtos() {}

    /**
     * Create, or full replacement on update. {@code topics} is only read on create (a quick way to
     * start the checklist); after that, topics have their own endpoints.
     */
    public record ExamRequest(
            @NotNull(message = "Choose a course.") UUID courseId,
            @NotBlank(message = "Give the exam a title.") @Size(max = 120, message = "Keep it under 120 characters.")
                    String title,
            ExamKind kind,
            @NotNull(message = "Set when it starts.") OffsetDateTime startsAt,
            @Min(value = 1, message = "Must be between 1 and 1440 minutes.")
                    @Max(value = 1440, message = "Must be between 1 and 1440 minutes.")
                    Integer durationMinutes,
            @Size(max = 60, message = "Keep it under 60 characters.") String location,
            @Size(max = ExamService.MAX_TOPICS_PER_EXAM, message = "Up to 100 topics per exam.")
                    List<@NotBlank(message = "Topics can’t be blank.")
                            @Size(max = 160, message = "Keep each topic under 160 characters.") String>
                            topics) {}

    public record TopicRequest(
            @NotBlank(message = "Name the topic.") @Size(max = 160, message = "Keep it under 160 characters.")
                    String title) {}

    /** Any combination; at least one. {@code position} moves the topic and renumbers the others. */
    public record TopicPatch(
            Boolean done,
            @Size(max = 160, message = "Keep it under 160 characters.") String title,
            @Min(value = 0, message = "Must be 0 or more.") Integer position) {}

    /** {@code percentage} is a whole number, rounded half-up; null while the checklist is empty. */
    public record Prep(int done, int total, Integer percentage) {

        static Prep of(long done, long total) {
            Integer pct = total == 0 ? null : Math.toIntExact((200 * done + total) / (2 * total));
            return new Prep(Math.toIntExact(done), Math.toIntExact(total), pct);
        }
    }

    public record TopicResponse(UUID id, String title, int position, boolean done, Instant doneAt) {

        static TopicResponse from(ExamTopic t) {
            return new TopicResponse(t.getId(), t.getTitle(), t.getDisplayOrder(), t.isDone(), t.getDoneAt());
        }
    }

    /**
     * List item. {@code daysUntil} counts calendar days in the user's timezone: 0 is today, 1 is
     * tomorrow, negative once it's past.
     */
    public record ExamSummary(
            UUID id,
            UUID courseId,
            String courseCode,
            String courseName,
            String title,
            ExamKind kind,
            Instant startsAt,
            Integer durationMinutes,
            String location,
            long daysUntil,
            Prep prep) {}

    /** The detail view: the summary plus the checklist in order. */
    public record ExamResponse(
            UUID id,
            UUID courseId,
            String courseCode,
            String courseName,
            String title,
            ExamKind kind,
            Instant startsAt,
            Integer durationMinutes,
            String location,
            long daysUntil,
            Prep prep,
            List<TopicResponse> topics) {}
}
