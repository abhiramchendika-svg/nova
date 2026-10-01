package dev.nova.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class StreaksTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 1);

    private static Set<LocalDate> daysAgo(int... offsets) {
        return Arrays.stream(offsets).mapToObj(TODAY::minusDays).collect(Collectors.toSet());
    }

    @Test
    void countsBackFromToday() {
        assertThat(Streaks.streak(daysAgo(0, 1, 2, 3), TODAY)).isEqualTo(4);
    }

    @Test
    void aDayNotYetFinishedDoesNotBreakIt() {
        assertThat(Streaks.streak(daysAgo(1, 2, 3), TODAY)).isEqualTo(3);
    }

    @Test
    void aGapEndsIt() {
        assertThat(Streaks.streak(daysAgo(0, 1, 3, 4, 5), TODAY)).isNull();
        assertThat(Streaks.streak(daysAgo(2, 3, 4, 5), TODAY)).isNull();
    }

    @Test
    void shortStreaksAreNotShown() {
        assertThat(Streaks.streak(daysAgo(0, 1), TODAY)).isNull();
        assertThat(Streaks.streak(Set.of(), TODAY)).isNull();
    }
}
