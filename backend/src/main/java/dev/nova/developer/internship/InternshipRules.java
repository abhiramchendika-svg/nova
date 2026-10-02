package dev.nova.developer.internship;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;

/**
 * Internship rules and analytics, free of Spring so they can be unit-tested directly
 * (docs/api.md §2.12). Analytics count stages an application has ever reached (its history plus
 * its current status), so moving on from "interview" still counts the interview.
 */
public final class InternshipRules {

    /** Stages past "applied" that mean the company answered; withdrawing isn't an answer. */
    private static final Set<InternshipStatus> RESPONSES = EnumSet.of(
            InternshipStatus.ASSESSMENT, InternshipStatus.INTERVIEW, InternshipStatus.OFFER, InternshipStatus.REJECTED);

    /** Stages that mean it was sent. */
    private static final Set<InternshipStatus> SENT = EnumSet.complementOf(EnumSet.of(InternshipStatus.SAVED));

    public static final String RESPONSE_RATE_FORMULA = "responded / applied";

    private InternshipRules() {}

    /** The apply-by deadline matters only until it's sent. */
    public static boolean deadlineMatters(InternshipStatus status) {
        return status == InternshipStatus.SAVED;
    }

    /** A next step matters while the application is still in play. */
    public static boolean stepMatters(InternshipStatus status) {
        return !status.isClosed();
    }

    /** One application as analytics sees it. */
    public record Entry(LocalDate appliedOn, InternshipStatus status, Set<InternshipStatus> reached) {

        public Entry {
            EnumSet<InternshipStatus> all = EnumSet.of(status);
            all.addAll(reached);
            reached = Set.copyOf(all);
        }

        boolean sent() {
            return reached.stream().anyMatch(SENT::contains) && appliedOn != null;
        }

        boolean responded() {
            return reached.stream().anyMatch(RESPONSES::contains);
        }
    }

    public record Rate(BigDecimal value, String formula, int responded, int applied) {}

    /** Applications sent in a month (by applied date) and how far they've got since. */
    public record Month(
            YearMonth month, int applied, int assessments, int interviews, int offers, int rejected, Rate responseRate) {}

    /** Everything so far: how many reached each stage, and how many are saved, rejected or withdrawn now. */
    public record Funnel(
            int saved, int applied, int assessment, int interview, int offer, int rejected, int withdrawn) {}

    public static Month month(Collection<Entry> entries, YearMonth month) {
        var cohort = entries.stream()
                .filter(Entry::sent)
                .filter(e -> YearMonth.from(e.appliedOn()).equals(month))
                .toList();
        int applied = cohort.size();
        int responded = (int) cohort.stream().filter(Entry::responded).count();
        BigDecimal value = applied == 0
                ? null
                : BigDecimal.valueOf(responded * 100L).divide(BigDecimal.valueOf(applied), 1, RoundingMode.HALF_UP);
        return new Month(
                month,
                applied,
                reached(cohort, InternshipStatus.ASSESSMENT),
                reached(cohort, InternshipStatus.INTERVIEW),
                reached(cohort, InternshipStatus.OFFER),
                reached(cohort, InternshipStatus.REJECTED),
                new Rate(value, RESPONSE_RATE_FORMULA, responded, applied));
    }

    public static Funnel funnel(Collection<Entry> entries) {
        return new Funnel(
                (int) entries.stream().filter(e -> e.status() == InternshipStatus.SAVED).count(),
                (int) entries.stream().filter(Entry::sent).count(),
                reached(entries, InternshipStatus.ASSESSMENT),
                reached(entries, InternshipStatus.INTERVIEW),
                reached(entries, InternshipStatus.OFFER),
                (int) entries.stream().filter(e -> e.status() == InternshipStatus.REJECTED).count(),
                (int) entries.stream().filter(e -> e.status() == InternshipStatus.WITHDRAWN).count());
    }

    private static int reached(Collection<Entry> entries, InternshipStatus stage) {
        return (int) entries.stream().filter(e -> e.reached().contains(stage)).count();
    }
}
