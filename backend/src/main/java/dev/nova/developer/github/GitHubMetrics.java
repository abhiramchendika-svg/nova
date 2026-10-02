package dev.nova.developer.github;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * NOVA's own numbers from what GitHub returned, free of Spring so they can be unit-tested directly
 * (docs/api.md §2.13). Every one carries the formula it was computed with; raw GitHub values are
 * never rewritten.
 */
public final class GitHubMetrics {

    /** Rolling seven-day weeks looked back over for "active weeks". */
    public static final int ACTIVE_WEEKS_WINDOW = 12;

    private GitHubMetrics() {}

    public record Metric(BigDecimal value, String formula) {

        static Metric of(long value, String formula) {
            return new Metric(BigDecimal.valueOf(value), formula);
        }
    }

    public record Day(LocalDate date, int count) {}

    public record Contributions(
            Metric thisMonth, Metric lastMonth, Metric change, Metric currentStreak, Metric longestStreak,
            Metric activeWeeks) {}

    public record LanguageShare(String language, int repos, BigDecimal share) {}

    public static Contributions contributions(Collection<Day> days, LocalDate today) {
        Map<LocalDate, Integer> byDay = days.stream()
                .collect(Collectors.toMap(Day::date, Day::count, Integer::sum, TreeMap::new));
        YearMonth month = YearMonth.from(today);
        long thisMonth = sum(byDay, month.atDay(1), today);
        YearMonth previous = month.minusMonths(1);
        long lastMonth = sum(byDay, previous.atDay(1), previous.atEndOfMonth());
        BigDecimal change = lastMonth == 0
                ? null
                : BigDecimal.valueOf((thisMonth - lastMonth) * 100L)
                        .divide(BigDecimal.valueOf(lastMonth), 1, RoundingMode.HALF_UP);
        return new Contributions(
                Metric.of(thisMonth, "contributions from the 1st of this month to today"),
                Metric.of(lastMonth, "contributions in all of last month"),
                new Metric(change, "(this month so far − last month) ÷ last month × 100; none when last month is 0"),
                Metric.of(currentStreak(byDay, today),
                        "days in a row with at least one contribution, ending today (or yesterday if none yet today)"),
                Metric.of(longestStreak(byDay), "most days in a row with at least one contribution in the calendar"),
                Metric.of(activeWeeks(byDay, today),
                        "of the last " + ACTIVE_WEEKS_WINDOW + " seven-day weeks ending today, those with a contribution"));
    }

    /**
     * Each language's share of the user's own repositories (forks left out) that have a primary
     * language: by number of repositories, not lines of code.
     */
    public static List<LanguageShare> languages(Collection<GitHubClient.RepoData> repos) {
        List<String> languages = repos.stream()
                .filter(r -> !r.fork() && r.language() != null && !r.language().isBlank())
                .map(GitHubClient.RepoData::language)
                .toList();
        if (languages.isEmpty()) {
            return List.of();
        }
        Map<String, Long> counts = languages.stream().collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        BigDecimal total = BigDecimal.valueOf(languages.size());
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder())
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(e -> new LanguageShare(
                        e.getKey(),
                        Math.toIntExact(e.getValue()),
                        BigDecimal.valueOf(e.getValue() * 100L).divide(total, 1, RoundingMode.HALF_UP)))
                .toList();
    }

    public static final String LANGUAGE_FORMULA =
            "repositories with this primary language ÷ your own (non-fork) repositories with a primary language";

    private static long sum(Map<LocalDate, Integer> byDay, LocalDate from, LocalDate to) {
        return byDay.entrySet().stream()
                .filter(e -> !e.getKey().isBefore(from) && !e.getKey().isAfter(to))
                .mapToLong(Map.Entry::getValue)
                .sum();
    }

    static int currentStreak(Map<LocalDate, Integer> byDay, LocalDate today) {
        LocalDate day = byDay.getOrDefault(today, 0) > 0 ? today : today.minusDays(1);
        int length = 0;
        while (byDay.getOrDefault(day, 0) > 0) {
            length++;
            day = day.minusDays(1);
        }
        return length;
    }

    static int longestStreak(Map<LocalDate, Integer> byDay) {
        Set<LocalDate> active = byDay.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
        int best = 0;
        for (LocalDate start : active) {
            if (active.contains(start.minusDays(1))) {
                continue; // not the start of a run
            }
            int length = 0;
            for (LocalDate d = start; active.contains(d); d = d.plusDays(1)) {
                length++;
            }
            best = Math.max(best, length);
        }
        return best;
    }

    static int activeWeeks(Map<LocalDate, Integer> byDay, LocalDate today) {
        int weeks = 0;
        for (int w = 0; w < ACTIVE_WEEKS_WINDOW; w++) {
            LocalDate end = today.minusDays(7L * w);
            if (sum(byDay, end.minusDays(6), end) > 0) {
                weeks++;
            }
        }
        return weeks;
    }
}
