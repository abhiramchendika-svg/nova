package dev.nova.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import org.junit.jupiter.api.Test;

/** The documented weights, so a change to the ranking is a deliberate change to these numbers. */
class PriorityScorerTest {

    @Test
    void overdueWorkGrowsWithEachDayLate() {
        assertThat(PriorityScorer.overdue("LOW", Duration.ofHours(3))).isEqualTo(60);
        assertThat(PriorityScorer.overdue("HIGH", Duration.ofHours(50))).isEqualTo(85); // 60 + 15 + 2 days
        assertThat(PriorityScorer.overdue("MEDIUM", Duration.ofDays(30))).isEqualTo(93); // lateness caps at 25
    }

    @Test
    void closeDeadlinesRankByTimeLeft() {
        assertThat(PriorityScorer.dueSoon("MEDIUM", Duration.ofHours(5))).isEqualTo(73);
        assertThat(PriorityScorer.dueSoon("LOW", Duration.ofHours(20))).isEqualTo(55);
        assertThat(PriorityScorer.dueSoon("HIGH", Duration.ofHours(40))).isEqualTo(60);
    }

    @Test
    void attendanceBelowTargetGrowsWithTheShortfall() {
        assertThat(PriorityScorer.belowTarget(new BigDecimal("74.9"), new BigDecimal("75"))).isEqualTo(60);
        assertThat(PriorityScorer.belowTarget(new BigDecimal("72.5"), new BigDecimal("75"))).isEqualTo(70);
        assertThat(PriorityScorer.belowTarget(new BigDecimal("40"), new BigDecimal("75"))).isEqualTo(80);
        assertThat(PriorityScorer.atRisk(0)).isEqualTo(45);
        assertThat(PriorityScorer.atRisk(1)).isEqualTo(35);
    }

    @Test
    void onlyCloseUnderPreparedExamsCount() {
        assertThat(PriorityScorer.examNeedsPrep(3, 25)).isTrue();
        assertThat(PriorityScorer.examNeedsPrep(0, 49)).isTrue();
        assertThat(PriorityScorer.examNeedsPrep(3, 50)).isFalse();
        assertThat(PriorityScorer.examNeedsPrep(8, 0)).isFalse();
        assertThat(PriorityScorer.examNeedsPrep(-1, 0)).isFalse();
        assertThat(PriorityScorer.examNeedsPrep(3, null)).isFalse(); // no checklist: nothing to measure
        assertThat(PriorityScorer.exam(3, 25)).isEqualTo(51);
        assertThat(PriorityScorer.exam(0, 0)).isEqualTo(68);
    }
}
