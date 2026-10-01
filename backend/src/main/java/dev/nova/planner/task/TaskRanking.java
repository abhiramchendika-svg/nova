package dev.nova.planner.task;

import java.time.Instant;
import java.time.LocalTime;
import java.util.Comparator;

/**
 * The order of Today's open tasks ("what now?"): overdue first, then due today, then by priority,
 * then timed tasks by start time, then by deadline, then oldest first.
 */
public final class TaskRanking {

    private TaskRanking() {}

    /** @param now the current instant; @param endOfToday the end of the user's day */
    public static Comparator<Task> today(Instant now, Instant endOfToday) {
        return Comparator.<Task>comparingInt(t -> t.getDueAt() != null && t.getDueAt().isBefore(now) ? 0 : 1)
                .thenComparingInt(t -> t.getDueAt() != null && t.getDueAt().isBefore(endOfToday) ? 0 : 1)
                .thenComparingInt(t -> 2 - t.getPriority().ordinal()) // HIGH first
                .thenComparing(Task::getPlannedStart, Comparator.nullsLast(Comparator.<LocalTime>naturalOrder()))
                .thenComparing(Task::getDueAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
                .thenComparing(Task::getCreatedAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()));
    }
}
