package dev.nova.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Body for GET /api/v1/dashboard (docs/api.md §2.11). */
public final class DashboardDtos {

    private DashboardDtos() {}

    public enum AttentionKind {
        ASSIGNMENT_OVERDUE,
        TASK_OVERDUE,
        ASSIGNMENT_DUE_SOON,
        TASK_DUE_SOON,
        ATTENDANCE_AT_RISK,
        EXAM_PREP
    }

    /** One thing that needs the user, with a plain reason and where to deal with it. */
    public record AttentionItem(
            AttentionKind kind, UUID refId, String title, String courseCode, String reason, int score, String link) {}

    public record LowestAttendance(UUID courseId, String courseName, BigDecimal percentage, BigDecimal target) {}

    /** The current semester at a glance; null on Home when there's no current semester. */
    public record AcademicsSummary(
            UUID semesterId,
            String semesterName,
            BigDecimal gpa,
            BigDecimal cgpa,
            BigDecimal credits,
            LowestAttendance lowestAttendance) {}

    /**
     * Today's tasks, this week's (planned that week: how many are done), and the streak of days
     * with a finished task (null until it reaches 3).
     */
    public record PlannerSummary(int openToday, int doneToday, int weekDone, int weekPlanned, Integer streakDays) {}

    public record NextMilestone(UUID projectId, String projectName, String title, LocalDate dueOn, boolean overdue) {}

    /** The active learning goal to work on next: its progress and next topic. */
    public record FocusGoal(UUID goalId, String title, Integer percentage, String nextTopic, LocalDate targetOn) {}

    /**
     * Projects in development, projects that aren't completed or archived, and the soonest open
     * milestone with a due date among those; active learning goals and the one to focus on (the
     * nearest target date, then the newest). GitHub activity joins in slice 4e.
     */
    public record DeveloperSummary(
            int inDevelopment, int activeProjects, NextMilestone nextMilestone, int activeGoals, FocusGoal focusGoal) {}

    public record DashboardResponse(
            LocalDate date,
            List<AttentionItem> needsAttention,
            AcademicsSummary academics,
            PlannerSummary planner,
            DeveloperSummary developer) {}
}
