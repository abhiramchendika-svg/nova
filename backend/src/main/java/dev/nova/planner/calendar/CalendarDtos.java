package dev.nova.planner.calendar;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Bodies for GET /api/v1/calendar (docs/api.md §2.10). */
public final class CalendarDtos {

    private CalendarDtos() {}

    public enum ItemType {
        CLASS,
        EXAM,
        ASSIGNMENT_DUE,
        TASK,
        TASK_DUE
    }

    /**
     * One thing on one day. Times are "HH:mm" on the user's wall clock. A block (class, exam, timed
     * task) has both times, with {@code endTime} "24:00" if it runs past midnight; a deadline has
     * only {@code startTime}; an untimed task has neither. {@code key} is unique within a response
     * (a weekly class appears once per date); {@code refId} is the class entry, exam, assignment or
     * task it comes from.
     */
    public record CalendarItem(
            String key,
            ItemType type,
            UUID refId,
            String title,
            LocalDate date,
            String startTime,
            String endTime,
            boolean done,
            UUID courseId,
            String courseCode,
            String courseName,
            Integer colorHue,
            String location,
            String kind,
            String priority) {}

    /** How full a day is: deadlines (assignments and tasks), exams, class time and planned task time. */
    public record DayLoad(LocalDate date, int deadlines, int exams, int classMinutes, int plannedTaskMinutes) {}

    public record CalendarResponse(
            LocalDate from, LocalDate to, String timezone, List<CalendarItem> items, List<DayLoad> load) {}
}
