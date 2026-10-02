package dev.nova.planner.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TaskTest {

    private static final UUID USER = UUID.randomUUID();
    private static final LocalDate DAY = LocalDate.of(2026, 10, 1);
    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    private static Task task(LocalDate plannedFor, LocalTime start, Recurrence recurrence) {
        Task task = new Task(USER);
        task.edit("Revise joins", null, TaskCategory.ACADEMIC, TaskPriority.HIGH, plannedFor, start, null, 30,
                recurrence, null, null, null, null, null, null);
        return task;
    }

    @Test
    void aStartTimeNeedsADay() {
        assertThatThrownBy(() -> task(null, LocalTime.of(18, 0), Recurrence.NONE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aRepeatNeedsADay() {
        assertThatThrownBy(() -> task(null, null, Recurrence.DAILY)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aOneOffTaskHasNoSeries() {
        assertThat(task(DAY, null, Recurrence.NONE).getSeriesId()).isNull();
    }

    @Test
    void aRepeatingTaskGetsASeriesThatSurvivesEdits() {
        Task task = task(DAY, null, Recurrence.DAILY);
        UUID series = task.getSeriesId();
        assertThat(series).isNotNull();

        task.edit("Renamed", null, TaskCategory.ACADEMIC, TaskPriority.LOW, DAY.plusDays(1), null, null, null,
                Recurrence.WEEKLY, null, null, null, null, null, null);
        assertThat(task.getSeriesId()).isEqualTo(series);
    }

    @Test
    void doneRecordsTheFirstCompletionAndReopeningClearsIt() {
        Task task = task(DAY, null, Recurrence.NONE);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.TODO);

        task.changeStatus(TaskStatus.DONE, NOW);
        task.changeStatus(TaskStatus.DONE, NOW.plusSeconds(60));
        assertThat(task.getCompletedAt()).isEqualTo(NOW);

        task.changeStatus(TaskStatus.IN_PROGRESS, NOW.plusSeconds(120));
        assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(task.getCompletedAt()).isNull();
    }

    @Test
    void theNextInstanceCopiesTheDetailsIntoTheSameSeries() {
        Task task = task(DAY, LocalTime.of(7, 30), Recurrence.DAILY);
        Instant due = Instant.parse("2026-10-02T09:00:00Z");

        Task next = task.nextInstance(DAY.plusDays(1), due);

        assertThat(next.getSeriesId()).isEqualTo(task.getSeriesId());
        assertThat(next.getPlannedFor()).isEqualTo(DAY.plusDays(1));
        assertThat(next.getPlannedStart()).isEqualTo(LocalTime.of(7, 30));
        assertThat(next.getDueAt()).isEqualTo(due);
        assertThat(next.getTitle()).isEqualTo("Revise joins");
        assertThat(next.getPriority()).isEqualTo(TaskPriority.HIGH);
        assertThat(next.getEstimatedMinutes()).isEqualTo(30);
        assertThat(next.getRecurrence()).isEqualTo(Recurrence.DAILY);
        assertThat(next.getStatus()).isEqualTo(TaskStatus.TODO);
        assertThat(next.getCompletedAt()).isNull();
    }
}
