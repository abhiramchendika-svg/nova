package dev.nova.common.time;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/**
 * Calendar-day arithmetic in a user's timezone. "Tomorrow" and "in 3 days" are about the user's
 * calendar, not 24-hour periods: 23:30 → 00:15 is "tomorrow" even though it's 45 minutes away.
 */
public final class CalendarDays {

    private CalendarDays() {}

    /** Calendar days from {@code now}'s date to {@code target}'s date in {@code zone}; negative if earlier. */
    public static long between(Instant now, Instant target, ZoneId zone) {
        return ChronoUnit.DAYS.between(LocalDate.ofInstant(now, zone), LocalDate.ofInstant(target, zone));
    }
}
