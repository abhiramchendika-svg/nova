package dev.nova.planner.calendar;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class CalendarRulesTest {

    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 10, 7);

    @Test
    void findsEachWeekdayInTheRange() {
        assertThat(CalendarRules.classDates(1, WEDNESDAY, WEDNESDAY.plusDays(13), null, null))
                .isEqualTo(List.of(LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 19)));
        // The range's own first day counts
        assertThat(CalendarRules.classDates(3, WEDNESDAY, WEDNESDAY, null, null))
                .isEqualTo(List.of(WEDNESDAY));
    }

    @Test
    void staysInsideTheTerm() {
        LocalDate termStart = LocalDate.of(2026, 10, 13);
        LocalDate termEnd = LocalDate.of(2026, 10, 26);
        assertThat(CalendarRules.classDates(1, WEDNESDAY, WEDNESDAY.plusDays(27), termStart, termEnd))
                .isEqualTo(List.of(LocalDate.of(2026, 10, 19), LocalDate.of(2026, 10, 26)));
        assertThat(CalendarRules.classDates(1, WEDNESDAY, WEDNESDAY.plusDays(6), null, LocalDate.of(2026, 10, 1)))
                .isEqualTo(List.of());
    }

    @Test
    void aShortRangeMayMissTheWeekday() {
        assertThat(CalendarRules.classDates(1, WEDNESDAY, WEDNESDAY.plusDays(3), null, null))
                .isEqualTo(List.of());
    }

    @Test
    void blocksThatRunPastMidnightEndAtTheEndOfTheDay() {
        assertThat(CalendarRules.endOf(LocalDateTime.of(2026, 10, 7, 9, 0), 90)).isEqualTo("10:30");
        assertThat(CalendarRules.endOf(LocalDateTime.of(2026, 10, 7, 23, 0), 90)).isEqualTo("24:00");
        assertThat(CalendarRules.endOf(LocalDateTime.of(2026, 10, 7, 23, 30), 30)).isEqualTo("24:00");
    }

    @Test
    void countsMinutesWithinADay() {
        assertThat(CalendarRules.minutesBetween("09:00", "09:50")).isEqualTo(50);
        assertThat(CalendarRules.minutesBetween("23:00", "24:00")).isEqualTo(60);
    }
}
