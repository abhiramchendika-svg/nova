package dev.nova.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.developer.hackathon.HackathonDtos.ExamClash;
import dev.nova.developer.hackathon.HackathonRules.DeadlineKind;
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
    void saysWhichHackathonDeadlineAndWhen() {
        assertThat(DashboardService.hackathonDeadlineReason(
                        DeadlineKind.REGISTRATION, Instant.parse("2026-10-01T18:00:00Z"), false, TODAY, IST))
                .isEqualTo("Registration closes today at 23:30");
        assertThat(DashboardService.hackathonDeadlineReason(
                        DeadlineKind.SUBMISSION, Instant.parse("2026-10-02T03:30:00Z"), false, TODAY, IST))
                .isEqualTo("Submissions close tomorrow at 09:00");
        assertThat(DashboardService.hackathonDeadlineReason(
                        DeadlineKind.REGISTRATION, Instant.parse("2026-09-30T03:30:00Z"), true, TODAY, IST))
                .isEqualTo("Registration closed yesterday · update its status");
        assertThat(DashboardService.hackathonDeadlineReason(
                        DeadlineKind.SUBMISSION, Instant.parse("2026-09-27T03:30:00Z"), true, TODAY, IST))
                .isEqualTo("Submissions closed 4 days ago · update its status");
    }

    @Test
    void saysWhenToApplyBy() {
        assertThat(DashboardService.applyByReason(Instant.parse("2026-10-01T18:29:00Z"), false, TODAY, IST))
                .isEqualTo("Apply by today at 23:59");
        assertThat(DashboardService.applyByReason(Instant.parse("2026-09-30T03:30:00Z"), true, TODAY, IST))
                .isEqualTo("Apply-by date passed yesterday · apply or update it");
    }

    @Test
    void placesAClashingExamAroundTheEvent() {
        LocalDate start = LocalDate.of(2026, 10, 10);
        LocalDate end = LocalDate.of(2026, 10, 11);
        assertThat(DashboardService.clashReason(clash(start.minusDays(2)), start, end))
                .isEqualTo("Midsem on Thu 8 Oct · 2 days before it");
        assertThat(DashboardService.clashReason(clash(end), start, end)).isEqualTo("Midsem on Sun 11 Oct · during it");
        assertThat(DashboardService.clashReason(clash(start.plusDays(1)), start, null))
                .isEqualTo("Midsem on Sun 11 Oct · 1 day after it");
    }

    private static ExamClash clash(LocalDate on) {
        return new ExamClash(null, "Midsem", "CSE 201", on);
    }

    @Test
    void writesPercentagesPlainly() {
        assertThat(DashboardService.percent(new BigDecimal("72.50"))).isEqualTo("72.5%");
        assertThat(DashboardService.percent(new BigDecimal("75.00"))).isEqualTo("75%");
        assertThat(DashboardService.percent(new BigDecimal("66.666"))).isEqualTo("66.7%");
    }
}
