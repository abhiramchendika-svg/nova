package dev.nova.dashboard;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;

/**
 * Scores for Home's "Needs attention" list (docs/api.md §2.11): 0–100, higher first. Every score is
 * a small sum of named constants, so the order can always be explained:
 *
 * <ul>
 *   <li>Overdue work: 60 + priority + 5 per full day overdue (up to 25).
 *   <li>Due within 48 hours: 40 + priority + 25 (≤ 6 h left), 15 (≤ 24 h) or 5.
 *   <li>Attendance below target: 55 + 5 per percentage point short (up to 25). At target but able
 *       to miss no more classes: 45; only one more: 35.
 *   <li>An exam within 7 days with under half its checklist done: 30 + 4 per day closer than 7 +
 *       1 per 5 points of prep missing below 50%.
 *   <li>A hackathon deadline that matters for its status: within 48 hours, scored like medium-priority
 *       work due soon; already missed (while the event isn't over): 45.
 *   <li>A hackathon starting within 21 days that clashes with an exam: 30 + 2 per day closer than 21.
 * </ul>
 *
 * Priority adds 15 (high), 8 (medium) or 0 (low).
 */
public final class PriorityScorer {

    static final int OVERDUE_BASE = 60;
    static final int OVERDUE_PER_DAY = 5;
    static final int OVERDUE_DAYS_CAP = 25;
    static final int DUE_SOON_BASE = 40;
    static final Duration DUE_SOON_WINDOW = Duration.ofHours(48);
    static final int BELOW_TARGET_BASE = 55;
    static final int BELOW_TARGET_PER_POINT = 5;
    static final int BELOW_TARGET_CAP = 25;
    static final int CANT_MISS_ANY = 45;
    static final int CAN_MISS_ONE = 35;
    static final int EXAM_BASE = 30;
    static final int EXAM_WINDOW_DAYS = 7;
    static final int EXAM_PER_DAY = 4;
    static final int EXAM_PREP_THRESHOLD = 50;
    static final int HACKATHON_MISSED = 45;
    static final int CLASH_BASE = 30;
    static final int CLASH_WINDOW_DAYS = 21;
    static final int CLASH_PER_DAY = 2;

    private PriorityScorer() {}

    /** HIGH, MEDIUM or LOW, by name, so assignments and tasks share it. */
    static int priorityWeight(String priority) {
        return switch (priority) {
            case "HIGH" -> 15;
            case "MEDIUM" -> 8;
            default -> 0;
        };
    }

    public static int overdue(String priority, Duration overdueBy) {
        long days = Math.max(0, overdueBy.toDays());
        int lateness = (int) Math.min(OVERDUE_DAYS_CAP, days * OVERDUE_PER_DAY);
        return clamp(OVERDUE_BASE + priorityWeight(priority) + lateness);
    }

    public static int dueSoon(String priority, Duration left) {
        int urgency;
        if (left.compareTo(Duration.ofHours(6)) <= 0) {
            urgency = 25;
        } else if (left.compareTo(Duration.ofHours(24)) <= 0) {
            urgency = 15;
        } else {
            urgency = 5;
        }
        return clamp(DUE_SOON_BASE + priorityWeight(priority) + urgency);
    }

    /** Percentage points short of the target, rounded up: 74.2% against 75% is 1 point. */
    public static int belowTarget(BigDecimal percentage, BigDecimal target) {
        int points = target.subtract(percentage).setScale(0, RoundingMode.CEILING).max(BigDecimal.ONE).intValue();
        return clamp(BELOW_TARGET_BASE + Math.min(BELOW_TARGET_CAP, points * BELOW_TARGET_PER_POINT));
    }

    public static int atRisk(int canMiss) {
        return canMiss <= 0 ? CANT_MISS_ANY : CAN_MISS_ONE;
    }

    /** True when an exam belongs on the list at all. */
    public static boolean examNeedsPrep(long daysUntil, Integer prepPercentage) {
        return daysUntil >= 0
                && daysUntil <= EXAM_WINDOW_DAYS
                && prepPercentage != null
                && prepPercentage < EXAM_PREP_THRESHOLD;
    }

    public static int exam(long daysUntil, int prepPercentage) {
        return clamp(EXAM_BASE
                + EXAM_PER_DAY * (int) (EXAM_WINDOW_DAYS - daysUntil)
                + (EXAM_PREP_THRESHOLD - prepPercentage) / 5);
    }

    public static int hackathonDeadlineSoon(Duration left) {
        return dueSoon("MEDIUM", left);
    }

    public static int hackathonDeadlineMissed() {
        return HACKATHON_MISSED;
    }

    /** True when a clash belongs on the list: the hackathon starts within the window (or is on). */
    public static boolean clashNeedsAttention(long daysUntil) {
        return daysUntil <= CLASH_WINDOW_DAYS;
    }

    public static int clash(long daysUntil) {
        long days = Math.max(0, daysUntil);
        return clamp(CLASH_BASE + CLASH_PER_DAY * (int) (CLASH_WINDOW_DAYS - days));
    }

    private static int clamp(int score) {
        return Math.max(0, Math.min(100, score));
    }
}
