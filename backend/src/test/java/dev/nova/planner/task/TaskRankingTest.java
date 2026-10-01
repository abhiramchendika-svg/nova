package dev.nova.planner.task;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TaskRankingTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 1);
    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");
    private static final Instant END_OF_TODAY = Instant.parse("2026-10-02T00:00:00Z");

    private static Task task(String title, TaskPriority priority, LocalTime start, Instant dueAt) {
        Task task = new Task(UUID.randomUUID());
        task.edit(
                title, null, TaskCategory.PERSONAL, priority, TODAY, start, dueAt, null, Recurrence.NONE, null, null, null);
        return task;
    }

    private static List<String> ranked(Task... tasks) {
        List<Task> list = new ArrayList<>(List.of(tasks));
        list.sort(TaskRanking.today(NOW, END_OF_TODAY));
        return list.stream().map(Task::getTitle).toList();
    }

    /** Priority outranks a deadline that is not today. */
    @Test
    void overdueComesFirstThenDueTodayThenTheRest() {
        Task later = task("later", TaskPriority.HIGH, null, null);
        Task dueTonight = task("due tonight", TaskPriority.LOW, null, Instant.parse("2026-10-01T20:00:00Z"));
        Task overdue = task("overdue", TaskPriority.LOW, null, Instant.parse("2026-09-30T20:00:00Z"));
        Task dueTomorrow = task("due tomorrow", TaskPriority.LOW, null, Instant.parse("2026-10-02T09:00:00Z"));

        assertThat(ranked(later, dueTonight, dueTomorrow, overdue))
                .containsExactly("overdue", "due tonight", "later", "due tomorrow");
    }

    @Test
    void thenHigherPriorityFirst() {
        assertThat(ranked(
                        task("low", TaskPriority.LOW, null, null),
                        task("high", TaskPriority.HIGH, null, null),
                        task("medium", TaskPriority.MEDIUM, null, null)))
                .containsExactly("high", "medium", "low");
    }

    @Test
    void thenTimedTasksByStartWithUntimedLast() {
        assertThat(ranked(
                        task("untimed", TaskPriority.MEDIUM, null, null),
                        task("evening", TaskPriority.MEDIUM, LocalTime.of(18, 0), null),
                        task("morning", TaskPriority.MEDIUM, LocalTime.of(7, 30), null)))
                .containsExactly("morning", "evening", "untimed");
    }

    @Test
    void thenEarlierDeadlineFirst() {
        assertThat(ranked(
                        task("no deadline", TaskPriority.MEDIUM, null, null),
                        task("in two days", TaskPriority.MEDIUM, null, Instant.parse("2026-10-03T09:00:00Z")),
                        task("tomorrow", TaskPriority.MEDIUM, null, Instant.parse("2026-10-02T09:00:00Z"))))
                .containsExactly("tomorrow", "in two days", "no deadline");
    }
}
