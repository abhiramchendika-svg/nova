package dev.nova.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** The reasons Home shows, in the user's timezone. */
class DashboardWordingTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 1);

    @Test
    void saysHowLateOrHowSoon() {
        // 23:30 in India on 1 Oct is still 18:00 UTC
        assertThat(DashboardService.deadlineReason(Instant.parse("2026-10-01T18:00:00Z"), false, TODAY, IST))
                .isEqualTo("Due today at 23:30");
        assertThat(DashboardService.deadlineReason(Instant.parse("2026-10-02T03:30:00Z"), false, TODAY, IST))
                .isEqualTo("Due tomorrow at 09:00");
        assertThat(DashboardService.deadlineReason(Instant.parse("2026-10-03T03:30:00Z"), false, TODAY, IST))
                .isEqualTo("Due Sat 3 Oct at 09:00");
        assertThat(DashboardService.deadlineReason(Instant.parse("2026-10-01T03:30:00Z"), true, TODAY, IST))
                .isEqualTo("Was due today at 09:00");
        assertThat(DashboardService.deadlineReason(Instant.parse("2026-09-30T03:30:00Z"), true, TODAY, IST))
                .isEqualTo("Was due yesterday");
        assertThat(DashboardService.deadlineReason(Instant.parse("2026-09-27T03:30:00Z"), true, TODAY, IST))
                .isEqualTo("Overdue by 4 days");
    }

    @Test
    void writesPercentagesPlainly() {
        assertThat(DashboardService.percent(new BigDecimal("72.50"))).isEqualTo("72.5%");
        assertThat(DashboardService.percent(new BigDecimal("75.00"))).isEqualTo("75%");
        assertThat(DashboardService.percent(new BigDecimal("66.666"))).isEqualTo("66.7%");
    }
}
