package dev.nova.planner.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class RecurrenceTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 28);
    private static final LocalDate FRIDAY = LocalDate.of(2026, 10, 2);
    private static final LocalDate SATURDAY = LocalDate.of(2026, 10, 3);

    @Test
    void dailyIsTheNextDay() {
        assertThat(Recurrence.DAILY.next(FRIDAY)).isEqualTo(SATURDAY);
    }

    @Test
    void weeklyIsSevenDaysLater() {
        assertThat(Recurrence.WEEKLY.next(MONDAY)).isEqualTo(MONDAY.plusWeeks(1));
    }

    @Test
    void weekdaysSkipTheWeekend() {
        assertThat(Recurrence.WEEKDAYS.next(MONDAY)).isEqualTo(MONDAY.plusDays(1));
        assertThat(Recurrence.WEEKDAYS.next(FRIDAY)).isEqualTo(FRIDAY.plusDays(3));
        // a weekday task that was moved to a Saturday continues on Monday
        assertThat(Recurrence.WEEKDAYS.next(SATURDAY)).isEqualTo(SATURDAY.plusDays(2));
    }

    @Test
    void weeklyAcrossAMonthAndYearEnd() {
        assertThat(Recurrence.WEEKLY.next(LocalDate.of(2026, 12, 29))).isEqualTo(LocalDate.of(2027, 1, 5));
    }

    @Test
    void aOneOffTaskHasNoNextInstance() {
        assertThatThrownBy(() -> Recurrence.NONE.next(MONDAY)).isInstanceOf(IllegalStateException.class);
    }
}
