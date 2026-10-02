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
        TASK_DUE,
        MILESTONE,
        HACKATHON,
        HACKATHON_DEADLINE,
        INTERNSHIP_DEADLINE,
        INTERNSHIP_STEP
    }

    /**
     * One thing on one day. Times are "HH:mm" on the user's wall clock. A block (class, exam, timed
     * task) has both times, with {@code endTime} "24:00" if it runs past midnight; a deadline has
     * only {@code startTime}; an untimed task has neither. {@code key} is unique within a response
     * (a weekly class appears once per date); {@code refId} is the class entry, exam, assignment or
     * task it comes from, for a milestone its project (the milestone itself is in {@code key}), and
     * for a hackathon day or deadline the hackathon. A hackathon deadline's {@code kind} is
     * REGISTRATION or SUBMISSION. An internship's apply-by deadline or next step points at the
     * application; a step's {@code kind} is the application's status.
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
            String priority,
            UUID projectId,
            String projectName) {}

    /**
     * How full a day is: deadlines (assignments, tasks, project milestones, hackathon deadlines and
     * internship apply-by dates), exams, hackathons on that day, internship steps (interviews,
     * assessments), class time and planned task time.
     */
    public record DayLoad(
            LocalDate date,
            int deadlines,
            int exams,
            int hackathons,
            int internshipSteps,
            int classMinutes,
            int plannedTaskMinutes) {}

    public record CalendarResponse(
            LocalDate from, LocalDate to, String timezone, List<CalendarItem> items, List<DayLoad> load) {}
}
