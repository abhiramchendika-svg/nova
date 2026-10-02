package dev.nova.developer.github;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.developer.github.GitHubClient.RepoData;
import dev.nova.developer.github.GitHubMetrics.Contributions;
import dev.nova.developer.github.GitHubMetrics.Day;
import dev.nova.developer.github.GitHubMetrics.LanguageShare;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** NOVA's own GitHub numbers: months, streaks, active weeks and language shares. */
class GitHubMetricsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 10);

    private static Day day(LocalDate date, int count) {
        return new Day(date, count);
    }

    @Test
    void comparesThisMonthSoFarWithLastMonth() {
        List<Day> days = List.of(
                day(LocalDate.of(2026, 9, 1), 4),
                day(LocalDate.of(2026, 9, 30), 6), // last month: 10
                day(LocalDate.of(2026, 10, 1), 3),
                day(LocalDate.of(2026, 10, 10), 12), // this month: 15
                day(LocalDate.of(2026, 8, 31), 50)); // two months ago: ignored
        Contributions c = GitHubMetrics.contributions(days, TODAY);
        assertThat(c.thisMonth().value()).isEqualTo(BigDecimal.valueOf(15));
        assertThat(c.lastMonth().value()).isEqualTo(BigDecimal.valueOf(10));
        assertThat(c.change().value()).isEqualTo(new BigDecimal("50.0"));
        assertThat(c.change().formula()).isEqualTo(
                "(this month so far − last month) ÷ last month × 100; none when last month is 0");
    }

    @Test
    void hasNoChangeWhenLastMonthWasEmpty() {
        Contributions c = GitHubMetrics.contributions(List.of(day(TODAY, 2)), TODAY);
        assertThat(c.change().value()).isNull();
        assertThat(c.thisMonth().value()).isEqualTo(BigDecimal.valueOf(2));
    }

    @Test
    void countsStreaksEndingTodayOrYesterday() {
        List<Day> days = new ArrayList<>();
        // a 4-day run ending yesterday, a gap, then an older 6-day run
        for (int i = 1; i <= 4; i++) {
            days.add(day(TODAY.minusDays(i), 1));
        }
        for (int i = 10; i <= 15; i++) {
            days.add(day(TODAY.minusDays(i), 2));
        }
        days.add(day(TODAY, 0));
        Contributions c = GitHubMetrics.contributions(days, TODAY);
        assertThat(c.currentStreak().value()).isEqualTo(BigDecimal.valueOf(4));
        assertThat(c.longestStreak().value()).isEqualTo(BigDecimal.valueOf(6));

        // Nothing yesterday or today: no current streak
        assertThat(GitHubMetrics.contributions(List.of(day(TODAY.minusDays(2), 5)), TODAY).currentStreak().value())
                .isEqualTo(BigDecimal.ZERO);
    }

    @Test
    void countsActiveWeeksInTheLastTwelve() {
        List<Day> days = List.of(
                day(TODAY, 1), // week 0
                day(TODAY.minusDays(6), 1), // still week 0
                day(TODAY.minusDays(7), 1), // week 1
                day(TODAY.minusDays(7 * 11), 1), // week 11
                day(TODAY.minusDays(7 * 12), 1)); // outside the window
        assertThat(GitHubMetrics.contributions(days, TODAY).activeWeeks().value()).isEqualTo(BigDecimal.valueOf(3));
    }

    private static RepoData repo(String language, boolean fork) {
        return new RepoData("r", "u/r", "https://github.com/u/r", null, language, 0, 0, fork, false, null);
    }

    @Test
    void sharesLanguagesByRepositoryLeavingOutForks() {
        List<LanguageShare> shares = GitHubMetrics.languages(List.of(
                repo("Java", false),
                repo("Java", false),
                repo("TypeScript", false),
                repo("Rust", true), // a fork: not yours
                repo(null, false))); // no primary language
        assertThat(shares.stream().map(LanguageShare::language).toList()).containsExactly("Java", "TypeScript");
        assertThat(shares.get(0).repos()).isEqualTo(2);
        assertThat(shares.get(0).share()).isEqualTo(new BigDecimal("66.7"));
        assertThat(shares.get(1).share()).isEqualTo(new BigDecimal("33.3"));
        assertThat(GitHubMetrics.languages(List.of(repo("Go", true)))).isEqualTo(List.of());
    }
}
