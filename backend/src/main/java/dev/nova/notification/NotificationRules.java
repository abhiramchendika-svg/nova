package dev.nova.notification;

import dev.nova.academics.attendance.AttendanceCalculator.Status;
import dev.nova.dashboard.DashboardService;
import dev.nova.developer.hackathon.HackathonRules.DeadlineKind;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * When NOVA notifies, and what it says (docs/architecture.md §9.6). Pure functions of the inputs and
 * "now", so every rule is unit-tested without a database. The dedupe key decides "once": a rule
 * whose key is already stored for the user creates nothing.
 */
public final class NotificationRules {

    /** "Due soon" means within the next 24 hours. */
    public static final Duration DUE_WINDOW = Duration.ofHours(24);
    /** Exams notify once when they are this many days away or closer. */
    public static final int EXAM_DAYS = 3;
    /** Overdue tasks notify from this local time on the day after the deadline… */
    public static final LocalTime MORNING = LocalTime.of(8, 0);
    /** …and not for deadlines older than this (e.g. the first run after turning the type back on). */
    public static final Duration OVERDUE_LOOKBACK = Duration.ofDays(7);

    static final int TITLE_MAX = 160;
    static final int BODY_MAX = 500;

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private NotificationRules() {}

    /** What the generator stores. Title, body and link are never null. */
    public record Draft(NotificationType type, String title, String body, String link, String dedupeKey) {
        public Draft {
            Objects.requireNonNull(type);
            title = clip(Objects.requireNonNull(title), TITLE_MAX);
            body = clip(Objects.requireNonNull(body), BODY_MAX);
            Objects.requireNonNull(link);
            Objects.requireNonNull(dedupeKey);
        }
    }

    /** An assignment or task with a deadline; {@code context} is a course code or null. */
    public record Deadline(UUID id, String title, String context, Instant dueAt, String link) {}

    public record ExamInput(
            UUID id, String title, String course, Instant startsAt, long daysUntil, int topicsDone, int topicsTotal) {}

    public record AttendanceInput(
            UUID courseId,
            String course,
            Status status,
            BigDecimal percentage,
            BigDecimal target,
            Integer canMiss,
            Integer needToAttend) {}

    public record HackathonInput(UUID id, String name, DeadlineKind kind, Instant at, boolean missed) {}

    /** {@code deadlineMatters}: the apply-by date still counts (the application is only saved). */
    public record ApplicationInput(
            UUID id,
            String company,
            String role,
            boolean deadlineMatters,
            Instant deadlineAt,
            String nextStep,
            Instant nextStepAt) {}

    // ───────────── due within 24 hours ─────────────

    public static List<Draft> assignmentsDue(List<Deadline> open, Instant now, ZoneId zone) {
        return dueSoon(NotificationType.ASSIGNMENT_DUE, open, now, zone);
    }

    public static List<Draft> tasksDue(List<Deadline> open, Instant now, ZoneId zone) {
        return dueSoon(NotificationType.TASK_DUE, open, now, zone);
    }

    /** Once per item and due day: moving the deadline to another day notifies again. */
    private static List<Draft> dueSoon(NotificationType type, List<Deadline> open, Instant now, ZoneId zone) {
        LocalDate today = LocalDate.ofInstant(now, zone);
        List<Draft> out = new ArrayList<>();
        for (Deadline d : open) {
            if (d.dueAt() == null || d.dueAt().isBefore(now) || !d.dueAt().isBefore(now.plus(DUE_WINDOW))) {
                continue;
            }
            String when = DashboardService.deadlineReason(d.dueAt(), false, today, zone);
            out.add(new Draft(
                    type,
                    d.title(),
                    d.context() == null ? when : d.context() + " · " + when,
                    d.link(),
                    key(type, d.id(), LocalDate.ofInstant(d.dueAt(), zone))));
        }
        return out;
    }

    // ───────────── overdue tasks ─────────────

    /**
     * Once per task and deadline, from {@link #MORNING} on the day after the due day (the user's
     * time), while the task is still open and the deadline is within {@link #OVERDUE_LOOKBACK}.
     */
    public static List<Draft> tasksOverdue(List<Deadline> open, Instant now, ZoneId zone) {
        LocalDateTime local = LocalDateTime.ofInstant(now, zone);
        LocalDate today = local.toLocalDate();
        if (local.toLocalTime().isBefore(MORNING)) {
            return List.of();
        }
        Instant oldest = now.minus(OVERDUE_LOOKBACK);
        List<Draft> out = new ArrayList<>();
        for (Deadline d : open) {
            if (d.dueAt() == null || !d.dueAt().isBefore(now) || d.dueAt().isBefore(oldest)) {
                continue;
            }
            LocalDate dueDay = LocalDate.ofInstant(d.dueAt(), zone);
            if (!dueDay.isBefore(today)) {
                continue; // due earlier today: Home already shows it; the reminder comes tomorrow morning
            }
            String when = DashboardService.deadlineReason(d.dueAt(), true, today, zone) + " · still open";
            out.add(new Draft(
                    NotificationType.TASK_OVERDUE,
                    d.title(),
                    d.context() == null ? when : d.context() + " · " + when,
                    d.link(),
                    key(NotificationType.TASK_OVERDUE, d.id(), dueDay)));
        }
        return out;
    }

    // ───────────── exams ─────────────

    /** Once per exam date, when it is {@link #EXAM_DAYS} days away or closer (and not over). */
    public static List<Draft> examsSoon(List<ExamInput> upcoming, Instant now, ZoneId zone) {
        List<Draft> out = new ArrayList<>();
        for (ExamInput e : upcoming) {
            if (e.daysUntil() < 0 || e.daysUntil() > EXAM_DAYS || !e.startsAt().isAfter(now)) {
                continue;
            }
            LocalDateTime starts = LocalDateTime.ofInstant(e.startsAt(), zone);
            String when = e.daysUntil() == 0
                    ? "today"
                    : e.daysUntil() == 1 ? "tomorrow" : "in " + e.daysUntil() + " days";
            String prep = e.topicsTotal() == 0
                    ? "No topics listed yet · add them to track your prep"
                    : e.topicsDone() + " of " + e.topicsTotal() + " topics ready";
            String body = (e.course() == null ? "" : e.course() + " · ")
                    + starts.format(DAY) + " at " + starts.format(HH_MM) + " · " + prep;
            out.add(new Draft(
                    NotificationType.EXAM_SOON,
                    e.title() + " is " + when,
                    body,
                    "/app/academics/exams/" + e.id(),
                    key(NotificationType.EXAM_SOON, e.id(), starts.toLocalDate())));
        }
        return out;
    }

    // ───────────── attendance ─────────────

    /** The subject under which the last-seen attendance status is stored. */
    public static String attendanceSubject(UUID courseId) {
        return "ATTENDANCE:" + courseId;
    }

    /**
     * Notify when a course gets worse: into AT_RISK or BELOW from anything else, or from AT_RISK to
     * BELOW. Improving (BELOW → AT_RISK) or recovering (→ SAFE) only updates the stored state.
     */
    public static boolean attendanceWorsened(String previous, Status current) {
        if (current == Status.BELOW) {
            return !Status.BELOW.name().equals(previous);
        }
        if (current == Status.AT_RISK) {
            return !Status.AT_RISK.name().equals(previous) && !Status.BELOW.name().equals(previous);
        }
        return false;
    }

    /**
     * The notification for a course that just got worse. The key names the change (previous → now)
     * and its moment, so every change is its own notification.
     */
    public static Draft attendance(AttendanceInput a, String previous, Instant now) {
        String pct = a.percentage() == null ? "" : DashboardService.percent(a.percentage()) + " · ";
        String title;
        String body;
        if (a.status() == Status.BELOW) {
            int need = a.needToAttend() == null ? 0 : a.needToAttend();
            title = a.course() + " attendance is below your target";
            body = pct + "attend the next " + (need == 1 ? "class" : need + " classes") + " to get back to "
                    + target(a.target());
        } else {
            int canMiss = a.canMiss() == null ? 0 : a.canMiss();
            title = a.course() + " attendance is at risk";
            body = pct + (canMiss <= 0 ? "you can’t miss another class" : "you can miss only 1 more class")
                    + " and stay at " + target(a.target());
        }
        return new Draft(
                NotificationType.ATTENDANCE_AT_RISK,
                title,
                body,
                "/app/academics/courses/" + a.courseId(),
                "ATTENDANCE_AT_RISK:" + a.courseId() + ":" + (previous == null ? "NEW" : previous) + ">" + a.status()
                        + ":" + now.toEpochMilli());
    }

    // ───────────── hackathons and internships ─────────────

    /** Once per hackathon, deadline kind and day, when the deadline is within 24 hours. */
    public static List<Draft> hackathonDeadlines(List<HackathonInput> upcoming, Instant now, ZoneId zone) {
        LocalDate today = LocalDate.ofInstant(now, zone);
        List<Draft> out = new ArrayList<>();
        for (HackathonInput h : upcoming) {
            if (h.at() == null || h.missed() || h.at().isBefore(now) || !h.at().isBefore(now.plus(DUE_WINDOW))) {
                continue;
            }
            out.add(new Draft(
                    NotificationType.HACKATHON_DEADLINE,
                    h.name(),
                    DashboardService.hackathonDeadlineReason(h.kind(), h.at(), false, today, zone),
                    "/app/developer/hackathons/" + h.id(),
                    "HACKATHON_DEADLINE:" + h.id() + ":" + h.kind() + ":" + LocalDate.ofInstant(h.at(), zone)));
        }
        return out;
    }

    /** Once per application and day, when a saved application's apply-by date is within 24 hours. */
    public static List<Draft> applyBy(List<ApplicationInput> open, Instant now, ZoneId zone) {
        LocalDate today = LocalDate.ofInstant(now, zone);
        List<Draft> out = new ArrayList<>();
        for (ApplicationInput a : open) {
            Instant at = a.deadlineAt();
            if (!a.deadlineMatters() || at == null || at.isBefore(now) || !at.isBefore(now.plus(DUE_WINDOW))) {
                continue;
            }
            out.add(new Draft(
                    NotificationType.INTERNSHIP_DEADLINE,
                    a.role() + " at " + a.company(),
                    DashboardService.applyByReason(at, false, today, zone),
                    "/app/developer/internships/" + a.id(),
                    key(NotificationType.INTERNSHIP_DEADLINE, a.id(), LocalDate.ofInstant(at, zone))));
        }
        return out;
    }

    /** Once per application and step time, on the day before the step (the user's calendar day). */
    public static List<Draft> nextStepsTomorrow(List<ApplicationInput> open, Instant now, ZoneId zone) {
        LocalDate tomorrow = LocalDate.ofInstant(now, zone).plusDays(1);
        List<Draft> out = new ArrayList<>();
        for (ApplicationInput a : open) {
            Instant at = a.nextStepAt();
            if (at == null || !LocalDate.ofInstant(at, zone).equals(tomorrow)) {
                continue;
            }
            String time = LocalDateTime.ofInstant(at, zone).format(HH_MM);
            String step = a.nextStep() == null || a.nextStep().isBlank() ? "Next step" : a.nextStep().strip();
            out.add(new Draft(
                    NotificationType.INTERNSHIP_STEP,
                    a.role() + " at " + a.company(),
                    step + " tomorrow at " + time,
                    "/app/developer/internships/" + a.id(),
                    "INTERNSHIP_STEP:" + a.id() + ":" + at.getEpochSecond()));
        }
        return out;
    }

    // ───────────── helpers ─────────────

    private static String target(BigDecimal target) {
        return target == null ? "your target" : DashboardService.percent(target);
    }

    private static String key(NotificationType type, UUID id, LocalDate day) {
        return type.name() + ":" + id + ":" + day;
    }

    /** Shortens to {@code max} characters with an ellipsis, so long names never break an insert. */
    static String clip(String text, int max) {
        String s = text.strip();
        return s.length() <= max ? s : s.substring(0, max - 1).stripTrailing() + "…";
    }
}
