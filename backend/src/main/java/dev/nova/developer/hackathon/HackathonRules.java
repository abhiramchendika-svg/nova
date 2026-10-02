package dev.nova.developer.hackathon;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.Optional;
import java.util.Set;

/**
 * Hackathon date rules, free of Spring so they can be unit-tested directly (docs/api.md §2.12):
 * when one is "past", which deadline still matters for its status, and which exam days clash.
 */
public final class HackathonRules {

    /** An exam this many days before the start or after the end of a hackathon clashes with it. */
    public static final int CLASH_MARGIN_DAYS = 2;

    private static final Set<HackathonStatus> CLOSED = Set.of(HackathonStatus.FINISHED, HackathonStatus.SKIPPED);
    private static final Set<HackathonStatus> BUILDING =
            Set.of(HackathonStatus.INTERESTED, HackathonStatus.REGISTERED, HackathonStatus.PARTICIPATING);

    public enum DeadlineKind {
        REGISTRATION,
        SUBMISSION
    }

    public record Deadline(DeadlineKind kind, Instant at) {}

    private HackathonRules() {}

    /** Finished or skipped, or its last day is before today. Undated and open is never past. */
    public static boolean isPast(HackathonStatus status, LocalDate lastDay, LocalDate today) {
        return CLOSED.contains(status) || (lastDay != null && lastDay.isBefore(today));
    }

    /**
     * The one deadline that matters for the status: registration while only interested (else
     * submission), submission while registered or participating, none after submitting.
     */
    public static Optional<Deadline> relevantDeadline(
            HackathonStatus status, Instant registration, Instant submission) {
        if (status == HackathonStatus.INTERESTED && registration != null) {
            return Optional.of(new Deadline(DeadlineKind.REGISTRATION, registration));
        }
        if (BUILDING.contains(status) && submission != null) {
            return Optional.of(new Deadline(DeadlineKind.SUBMISSION, submission));
        }
        return Optional.empty();
    }

    /** True when an exam on {@code examDay} falls within the event's days plus the margin either side. */
    public static boolean clashes(LocalDate startsOn, LocalDate endsOn, LocalDate examDay) {
        if (startsOn == null) {
            return false;
        }
        LocalDate last = endsOn != null ? endsOn : startsOn;
        return !examDay.isBefore(startsOn.minusDays(CLASH_MARGIN_DAYS))
                && !examDay.isAfter(last.plusDays(CLASH_MARGIN_DAYS));
    }

    /** Days from today to the start (0 while it's on; negative once started), null when undated. */
    public static Long daysUntil(LocalDate startsOn, LocalDate today) {
        return startsOn == null ? null : ChronoUnit.DAYS.between(today, startsOn);
    }

    /**
     * List order: upcoming before past; upcoming by start date (undated last), past by last day
     * (most recent first, undated last); then newest first.
     */
    public static <T> Comparator<T> listOrder(
            java.util.function.Predicate<T> past,
            java.util.function.Function<T, LocalDate> startsOn,
            java.util.function.Function<T, LocalDate> lastDay,
            java.util.function.Function<T, Instant> createdAt) {
        Comparator<T> upcoming = Comparator.comparing(startsOn, Comparator.nullsLast(Comparator.naturalOrder()));
        Comparator<T> done = Comparator.comparing(lastDay, Comparator.nullsLast(Comparator.reverseOrder()));
        return Comparator.<T, Boolean>comparing(past::test)
                .thenComparing((a, b) -> past.test(a) ? done.compare(a, b) : upcoming.compare(a, b))
                .thenComparing(createdAt, Comparator.nullsLast(Comparator.reverseOrder()));
    }
}
