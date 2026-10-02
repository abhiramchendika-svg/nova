package dev.nova.developer.internship;

import static dev.nova.developer.internship.InternshipStatus.APPLIED;
import static dev.nova.developer.internship.InternshipStatus.ASSESSMENT;
import static dev.nova.developer.internship.InternshipStatus.INTERVIEW;
import static dev.nova.developer.internship.InternshipStatus.OFFER;
import static dev.nova.developer.internship.InternshipStatus.REJECTED;
import static dev.nova.developer.internship.InternshipStatus.SAVED;
import static dev.nova.developer.internship.InternshipStatus.WITHDRAWN;
import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.developer.internship.InternshipRules.Entry;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Which dates matter, and the analytics: stages ever reached, response rate by applied month. */
class InternshipRulesTest {

    private static final YearMonth SEPT = YearMonth.of(2026, 9);
    private static final LocalDate IN_SEPT = LocalDate.of(2026, 9, 10);
    private static final LocalDate IN_OCT = LocalDate.of(2026, 10, 2);

    private static Entry entry(LocalDate appliedOn, InternshipStatus now, InternshipStatus... history) {
        return new Entry(appliedOn, now, Set.of(history));
    }

    @Test
    void deadlinesMatterWhileSavedAndStepsWhileInPlay() {
        assertThat(InternshipRules.deadlineMatters(SAVED)).isTrue();
        assertThat(InternshipRules.deadlineMatters(APPLIED)).isFalse();
        assertThat(InternshipRules.stepMatters(INTERVIEW)).isTrue();
        assertThat(InternshipRules.stepMatters(REJECTED)).isFalse();
        assertThat(InternshipRules.stepMatters(WITHDRAWN)).isFalse();
    }

    @Test
    void countsAMonthsApplicationsAndHowFarTheyGot() {
        List<Entry> entries = List.of(
                entry(IN_SEPT, APPLIED, APPLIED), // no answer yet
                entry(IN_SEPT, REJECTED, APPLIED, REJECTED), // a rejection is an answer
                entry(IN_SEPT, OFFER, APPLIED, ASSESSMENT, INTERVIEW, OFFER),
                entry(IN_SEPT, WITHDRAWN, APPLIED, WITHDRAWN), // pulling out isn't an answer
                entry(IN_SEPT, INTERVIEW, APPLIED, INTERVIEW), // skipped the assessment
                entry(IN_OCT, ASSESSMENT, APPLIED, ASSESSMENT), // another month
                entry(null, SAVED, SAVED)); // never sent

        InternshipRules.Month m = InternshipRules.month(entries, SEPT);
        assertThat(m.applied()).isEqualTo(5);
        assertThat(m.assessments()).isEqualTo(1);
        assertThat(m.interviews()).isEqualTo(2);
        assertThat(m.offers()).isEqualTo(1);
        assertThat(m.rejected()).isEqualTo(1);
        assertThat(m.responseRate().responded()).isEqualTo(3);
        assertThat(m.responseRate().value()).isEqualTo(new BigDecimal("60.0"));
        assertThat(m.responseRate().formula()).isEqualTo("responded / applied");

        InternshipRules.Funnel f = InternshipRules.funnel(entries);
        assertThat(f.saved()).isEqualTo(1);
        assertThat(f.applied()).isEqualTo(6);
        assertThat(f.assessment()).isEqualTo(2);
        assertThat(f.interview()).isEqualTo(2);
        assertThat(f.offer()).isEqualTo(1);
        assertThat(f.rejected()).isEqualTo(1);
        assertThat(f.withdrawn()).isEqualTo(1);
    }

    @Test
    void anEmptyMonthHasNoRate() {
        InternshipRules.Month m = InternshipRules.month(List.of(entry(IN_OCT, APPLIED, APPLIED)), SEPT);
        assertThat(m.applied()).isEqualTo(0);
        assertThat(m.responseRate().value()).isNull();
    }

    @Test
    void roundsTheRateToOneDecimal() {
        List<Entry> entries = List.of(
                entry(IN_SEPT, REJECTED, APPLIED, REJECTED),
                entry(IN_SEPT, APPLIED, APPLIED),
                entry(IN_SEPT, APPLIED, APPLIED));
        assertThat(InternshipRules.month(entries, SEPT).responseRate().value()).isEqualTo(new BigDecimal("33.3"));
    }
}
