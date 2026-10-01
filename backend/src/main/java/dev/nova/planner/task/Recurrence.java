package dev.nova.planner.task;

import java.time.DayOfWeek;
import java.time.LocalDate;

/** Simple repeats (architecture.md: no full RRULE). The next instance is created when one is completed. */
public enum Recurrence {
    NONE,
    DAILY,
    /** Monday to Friday: Friday's next is Monday. */
    WEEKDAYS,
    WEEKLY;

    /** The day of the instance after one planned for {@code from}; throws for NONE. */
    public LocalDate next(LocalDate from) {
        return switch (this) {
            case DAILY -> from.plusDays(1);
            case WEEKLY -> from.plusWeeks(1);
            case WEEKDAYS -> {
                LocalDate d = from.plusDays(1);
                while (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    d = d.plusDays(1);
                }
                yield d;
            }
            case NONE -> throw new IllegalStateException("A one-off task has no next instance");
        };
    }
}
