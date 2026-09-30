package dev.nova.academics.assignment;

public enum AssignmentStatus {
    NOT_STARTED,
    IN_PROGRESS,
    SUBMITTED,
    COMPLETED;

    /** Still needs work: counts towards deadlines, overdue checks and urgency. */
    public boolean isOpen() {
        return this == NOT_STARTED || this == IN_PROGRESS;
    }
}
