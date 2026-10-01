package dev.nova.dashboard;

import java.time.LocalDate;
import java.util.Set;

/** The planner card's streak (docs/api.md §2.11). */
public final class Streaks {

    /** A streak is only shown once it means something. */
    static final int MIN_SHOWN = 3;

    private Streaks() {}

    /**
     * Consecutive days with at least one finished task, ending today, or yesterday if nothing is
     * finished yet today (the streak isn't broken until the day is over). Null when shorter than 3.
     */
    public static Integer streak(Set<LocalDate> daysWithCompletions, LocalDate today) {
        LocalDate day = daysWithCompletions.contains(today) ? today : today.minusDays(1);
        int length = 0;
        while (daysWithCompletions.contains(day)) {
            length++;
            day = day.minusDays(1);
        }
        return length >= MIN_SHOWN ? length : null;
    }
}
