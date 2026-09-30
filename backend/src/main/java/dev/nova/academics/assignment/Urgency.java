package dev.nova.academics.assignment;

import dev.nova.common.time.CalendarDays;
import java.time.Instant;
import java.time.ZoneId;

/**
 * How soon open work is due, in the user's calendar (docs/api.md §2.6). Drives deadline indicators.
 * Finished work (submitted or completed) has no urgency.
 */
public enum Urgency {
    OVERDUE,
    DUE_TODAY,
    DUE_TOMORROW,
    /** Due within the next 7 days (after tomorrow). */
    THIS_WEEK,
    LATER;

    public static Urgency of(Instant dueAt, Instant now, ZoneId zone) {
        if (dueAt.isBefore(now)) {
            return OVERDUE;
        }
        long days = CalendarDays.between(now, dueAt, zone);
        if (days == 0) {
            return DUE_TODAY;
        }
        if (days == 1) {
            return DUE_TOMORROW;
        }
        return days <= 7 ? THIS_WEEK : LATER;
    }
}
