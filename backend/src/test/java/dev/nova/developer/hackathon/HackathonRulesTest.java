package dev.nova.developer.hackathon;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.developer.hackathon.HackathonRules.DeadlineKind;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Which hackathons are past, which deadline matters, and which exam days clash. */
class HackathonRulesTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 2);
    private static final Instant REG = Instant.parse("2026-10-05T18:30:00Z");
    private static final Instant SUB = Instant.parse("2026-10-12T12:00:00Z");

    @Test
    void pastMeansClosedOrOver() {
        assertThat(HackathonRules.isPast(HackathonStatus.FINISHED, TODAY.plusDays(5), TODAY)).isTrue();
        assertThat(HackathonRules.isPast(HackathonStatus.SKIPPED, null, TODAY)).isTrue();
        assertThat(HackathonRules.isPast(HackathonStatus.SUBMITTED, TODAY.minusDays(1), TODAY)).isTrue();
        assertThat(HackathonRules.isPast(HackathonStatus.PARTICIPATING, TODAY, TODAY)).isFalse();
        assertThat(HackathonRules.isPast(HackathonStatus.INTERESTED, null, TODAY)).isFalse();
    }

    @Test
    void theDeadlineFollowsTheStatus() {
        assertThat(HackathonRules.relevantDeadline(HackathonStatus.INTERESTED, REG, SUB).orElseThrow().kind())
                .isEqualTo(DeadlineKind.REGISTRATION);
        // Interested with no registration deadline: submissions still matter
        assertThat(HackathonRules.relevantDeadline(HackathonStatus.INTERESTED, null, SUB).orElseThrow().kind())
                .isEqualTo(DeadlineKind.SUBMISSION);
        assertThat(HackathonRules.relevantDeadline(HackathonStatus.REGISTERED, REG, SUB).orElseThrow().at())
                .isEqualTo(SUB);
        assertThat(HackathonRules.relevantDeadline(HackathonStatus.PARTICIPATING, REG, SUB).orElseThrow().kind())
                .isEqualTo(DeadlineKind.SUBMISSION);
        assertThat(HackathonRules.relevantDeadline(HackathonStatus.SUBMITTED, REG, SUB).isPresent()).isFalse();
        assertThat(HackathonRules.relevantDeadline(HackathonStatus.REGISTERED, REG, null).isPresent()).isFalse();
    }

    @Test
    void examsWithinTwoDaysEitherSideClash() {
        LocalDate start = LocalDate.of(2026, 10, 10);
        LocalDate end = LocalDate.of(2026, 10, 11);
        assertThat(HackathonRules.clashes(start, end, start.minusDays(2))).isTrue();
        assertThat(HackathonRules.clashes(start, end, start.minusDays(3))).isFalse();
        assertThat(HackathonRules.clashes(start, end, end)).isTrue();
        assertThat(HackathonRules.clashes(start, end, end.plusDays(2))).isTrue();
        assertThat(HackathonRules.clashes(start, end, end.plusDays(3))).isFalse();
        // One-day event, and undated
        assertThat(HackathonRules.clashes(start, null, start.plusDays(2))).isTrue();
        assertThat(HackathonRules.clashes(null, null, start)).isFalse();
    }

    @Test
    void countsDaysToTheStart() {
        assertThat(HackathonRules.daysUntil(TODAY.plusDays(3), TODAY)).isEqualTo(3L);
        assertThat(HackathonRules.daysUntil(TODAY.minusDays(1), TODAY)).isEqualTo(-1L);
        assertThat(HackathonRules.daysUntil(null, TODAY)).isNull();
    }

    private record Row(String name, boolean past, LocalDate start, LocalDate last, Instant created) {}

    @Test
    void listsUpcomingBySoonestThenPastByMostRecent() {
        Instant old = Instant.parse("2026-01-01T00:00:00Z");
        Instant newer = Instant.parse("2026-02-01T00:00:00Z");
        List<Row> rows = new ArrayList<>(List.of(
                new Row("past old", true, TODAY.minusDays(30), TODAY.minusDays(29), old),
                new Row("undated", false, null, null, newer),
                new Row("later", false, TODAY.plusDays(20), TODAY.plusDays(21), old),
                new Row("past recent", true, TODAY.minusDays(3), TODAY.minusDays(2), old),
                new Row("soon", false, TODAY.plusDays(2), TODAY.plusDays(2), old)));
        rows.sort(HackathonRules.listOrder(Row::past, Row::start, Row::last, Row::created));
        assertThat(rows.stream().map(Row::name).toList())
                .containsExactly("soon", "later", "undated", "past recent", "past old");
    }
}
