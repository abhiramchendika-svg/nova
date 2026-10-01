package dev.nova.planner.task;

import dev.nova.academics.assignment.Urgency;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/tasks (docs/api.md §2.9). */
public final class TaskDtos {

    private TaskDtos() {}

    /**
     * Create, or full replacement on update (status is changed separately). {@code plannedStart} is
     * "HH:mm" on the user's wall clock and needs {@code plannedFor}; a repeating task needs
     * {@code plannedFor} too. Category defaults to ACADEMIC when a course or exam is linked,
     * PERSONAL otherwise.
     */
    public record TaskRequest(
            @NotBlank(message = "Give the task a title.") @Size(max = 160, message = "Keep it under 160 characters.")
                    String title,
            @Size(max = 4000, message = "Keep notes under 4000 characters.") String description,
            TaskCategory category,
            TaskPriority priority,
            LocalDate plannedFor,
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "Use a time like 18:30.") String plannedStart,
            OffsetDateTime dueAt,
            @Min(value = 1, message = "Use 1 to 1440 minutes.") @Max(value = 1440, message = "Use 1 to 1440 minutes.")
                    Integer estimatedMinutes,
            Recurrence recurrence,
            UUID courseId,
            UUID examId) {}

    public record StatusRequest(@NotNull(message = "Choose a status.") TaskStatus status) {}

    /**
     * {@code overdue}: open and past its deadline. {@code urgency} is the deadline's urgency in the
     * user's timezone (null without a deadline, or once done).
     */
    public record TaskResponse(
            UUID id,
            String title,
            String description,
            TaskCategory category,
            TaskPriority priority,
            TaskStatus status,
            LocalDate plannedFor,
            String plannedStart,
            Instant dueAt,
            Integer estimatedMinutes,
            Instant completedAt,
            Recurrence recurrence,
            UUID seriesId,
            UUID courseId,
            String courseCode,
            String courseName,
            UUID examId,
            String examTitle,
            boolean overdue,
            Urgency urgency) {}

    /** Completing a repeating task creates its next instance (null if it already exists). */
    public record StatusResponse(TaskResponse task, TaskResponse nextInstance) {}

    /** Open tasks in "what now?" order, and what was finished that day. */
    public record TodayResponse(LocalDate date, List<TaskResponse> tasks, List<TaskResponse> completed) {}

    public record UpcomingDay(LocalDate date, List<TaskResponse> tasks) {}

    /** Days after today that have tasks, in order; {@code unscheduled} has neither a day nor a deadline. */
    public record UpcomingResponse(LocalDate from, LocalDate to, List<UpcomingDay> days, List<TaskResponse> unscheduled) {}
}
