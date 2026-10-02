package dev.nova.notification;

/**
 * What a notification is about. Each type can be switched off in Settings → Notifications; the
 * list mirrors the check constraints in migration V14.
 */
public enum NotificationType {
    /** An open assignment is due within 24 hours. */
    ASSIGNMENT_DUE,
    /** An open task is due within 24 hours. */
    TASK_DUE,
    /** A task is still open the morning after its deadline. */
    TASK_OVERDUE,
    /** An exam is 3 days away or closer, with how much of its prep is done. */
    EXAM_SOON,
    /** A course's attendance moved to "at risk" or below the target. */
    ATTENDANCE_AT_RISK,
    /** A hackathon's registration or submission closes within 24 hours. */
    HACKATHON_DEADLINE,
    /** A saved internship's apply-by date is within 24 hours. */
    INTERNSHIP_DEADLINE,
    /** An application's next step (usually an interview) is tomorrow. */
    INTERNSHIP_STEP
}
