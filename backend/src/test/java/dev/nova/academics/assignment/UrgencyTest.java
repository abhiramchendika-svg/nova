package dev.nova.academics.assignment;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.common.time.CalendarDays;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Urgency is about the user's calendar, not 24-hour windows, and it's evaluated in their timezone. */
class UrgencyTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    // 2026-09-30 23:30 in India
    private static final Instant LATE_EVENING_IST = Instant.parse("2026-09-30T18:00:00Z");

    @ParameterizedTest(name = "due {0} → {1}")
    @CsvSource({
        // a minute ago
        "2026-09-30T17:59:00Z, OVERDUE",
        // exactly now counts as still on time
        "2026-09-30T18:00:00Z, DUE_TODAY",
        // 23:59 IST the same day
        "2026-09-30T18:29:00Z, DUE_TODAY",
        // 00:15 IST: only 45 minutes away, but it's tomorrow on the student's calendar
        "2026-09-30T18:45:00Z, DUE_TOMORROW",
        // 23:59 IST tomorrow
        "2026-10-01T18:29:00Z, DUE_TOMORROW",
        // the day after tomorrow
        "2026-10-01T18:30:00Z, THIS_WEEK",
        // 7 days ahead (7 Oct, 23:59 IST)
        "2026-10-07T18:29:00Z, THIS_WEEK",
        // 8 days ahead
        "2026-10-08T18:30:00Z, LATER",
    })
    void classifiesInTheUsersCalendar(String dueAt, Urgency expected) {
        assertThat(Urgency.of(Instant.parse(dueAt), LATE_EVENING_IST, IST)).isEqualTo(expected);
    }

    @Test
    void theSameMomentCanBeTodayInOneZoneAndTomorrowInAnother() {
        Instant due = Instant.parse("2026-09-30T18:45:00Z");

        assertThat(Urgency.of(due, LATE_EVENING_IST, ZoneId.of("UTC"))).isEqualTo(Urgency.DUE_TODAY);
        assertThat(Urgency.of(due, LATE_EVENING_IST, IST)).isEqualTo(Urgency.DUE_TOMORROW);
    }

    @Test
    void countsCalendarDaysAcrossADaylightSavingChange() {
        // New York leaves daylight saving on 1 Nov 2026, so that day is 25 hours long
        ZoneId newYork = ZoneId.of("America/New_York");
        Instant saturdayNoon = Instant.parse("2026-10-31T16:00:00Z"); // 12:00 EDT
        Instant sundayLateEvening = Instant.parse("2026-11-02T04:30:00Z"); // 23:30 EST on Sunday 1 Nov

        assertThat(CalendarDays.between(saturdayNoon, sundayLateEvening, newYork)).isEqualTo(1);
        assertThat(Urgency.of(sundayLateEvening, saturdayNoon, newYork)).isEqualTo(Urgency.DUE_TOMORROW);
    }

    @Test
    void daysBetweenIsNegativeForThePast() {
        assertThat(CalendarDays.between(LATE_EVENING_IST, Instant.parse("2026-09-27T12:00:00Z"), IST))
                .isEqualTo(-3);
    }
}
