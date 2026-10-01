package dev.nova.planner.calendar;

import dev.nova.planner.calendar.CalendarDtos.CalendarItem;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** The calendar's date arithmetic, kept free of Spring so it can be unit-tested directly. */
public final class CalendarRules {

    static final int MAX_DAYS = 62;
    /** A timed task without an estimate is drawn as this long. */
    static final int DEFAULT_TASK_MINUTES = 30;
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private CalendarRules() {}

    /**
     * The dates in [from, to] that fall on an ISO weekday (1 = Monday) and inside the term. A null
     * term start or end leaves that side open.
     */
    public static List<LocalDate> classDates(
            int dayOfWeek, LocalDate from, LocalDate to, LocalDate termStart, LocalDate termEnd) {
        LocalDate first = termStart != null && termStart.isAfter(from) ? termStart : from;
        LocalDate last = termEnd != null && termEnd.isBefore(to) ? termEnd : to;
        List<LocalDate> dates = new ArrayList<>();
        LocalDate d = first.plusDays(Math.floorMod(dayOfWeek - first.getDayOfWeek().getValue(), 7));
        for (; !d.isAfter(last); d = d.plusWeeks(1)) {
            dates.add(d);
        }
        return dates;
    }

    /** "HH:mm" for a wall-clock time. */
    public static String hhmm(LocalTime time) {
        return time.format(HH_MM);
    }

    /** The end of a block starting at {@code start} on its day: "24:00" if it runs past midnight. */
    public static String endOf(LocalDateTime start, int minutes) {
        LocalDateTime end = start.plusMinutes(minutes);
        return end.toLocalDate().isAfter(start.toLocalDate()) ? "24:00" : hhmm(end.toLocalTime());
    }

    /** Minutes between two wall-clock times on one day ("24:00" is the end of the day). */
    public static int minutesBetween(String start, String end) {
        LocalTime s = LocalTime.parse(start, HH_MM);
        int endMinutes = "24:00".equals(end) ? 24 * 60 : LocalTime.parse(end, HH_MM).toSecondOfDay() / 60;
        return (int) Math.max(0, endMinutes - Duration.ofSeconds(s.toSecondOfDay()).toMinutes());
    }

    /** By day; untimed items first, then by start time, then by type, then by title. */
    public static final Comparator<CalendarItem> ORDER = Comparator.comparing(CalendarItem::date)
            .thenComparing(CalendarItem::startTime, Comparator.nullsFirst(Comparator.<String>naturalOrder()))
            .thenComparing(CalendarItem::type)
            .thenComparing(CalendarItem::title)
            .thenComparing(CalendarItem::key);
}
