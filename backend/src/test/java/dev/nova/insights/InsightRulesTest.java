package dev.nova.insights;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.insights.InsightDtos.Insight;
import dev.nova.insights.InsightRules.AssignmentIn;
import dev.nova.insights.InsightRules.AttendanceIn;
import dev.nova.insights.InsightRules.ContributionDay;
import dev.nova.insights.InsightRules.Context;
import dev.nova.insights.InsightRules.ExamIn;
import dev.nova.insights.InsightRules.Findings;
import dev.nova.insights.InsightRules.HackathonIn;
import dev.nova.insights.InsightRules.MonthRate;
import dev.nova.insights.InsightRules.ProjectIn;
import dev.nova.insights.InsightRules.TaskIn;
import dev.nova.insights.InsightRules.Window;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Each rule: when it speaks, what it says, the evidence it shows, and when it waits for more data. */
class InsightRulesTest {

    private static final ZoneId UTC = ZoneId.of("UTC");
    /** Wednesday 7 Oct 2026, 10:00 UTC; the week began on Monday 5 Oct. */
    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 7);
    private static final Context WEEK = new Context(Window.WEEK, LocalDate.of(2026, 10, 5), TODAY, NOW, UTC);
    private static final Context MONTH = new Context(Window.MONTH, LocalDate.of(2026, 10, 1), TODAY, NOW, UTC);

    private static int n = 0;

    private static UUID id() {
        return new UUID(0, ++n);
    }

    private static TaskIn planned(LocalDate day, boolean done) {
        return new TaskIn(id(), "Task " + n, day, null, done, null, null);
    }

    private static TaskIn due(Instant at) {
        return new TaskIn(id(), "Due " + n, null, at, false, null, null);
    }

    private static AssignmentIn assignment(Instant dueAt, Instant handedInAt) {
        return new AssignmentIn(id(), "Lab " + n, "CS301", new UUID(1, 1), dueAt, handedInAt == null, handedInAt);
    }

    private static Insight only(Findings f) {
        assertThat(f.insights()).hasSize(1);
        return f.insights().getFirst();
    }

    @Test
    void taskCompletionNeedsFivePlannedTasks() {
        Findings f = new Findings();
        InsightRules.taskCompletion(WEEK, List.of(planned(TODAY, true), planned(TODAY, false)), f);
        assertThat(f.insights()).isEmpty();
        assertThat(f.quiet().getFirst().reason()).isEqualTo("Needs 5 tasks planned for days this week; you have 2.");

        f = new Findings();
        List<TaskIn> week = new ArrayList<>();
        for (int i = 0; i < 4; i++) week.add(planned(TODAY.minusDays(i % 3), true));
        week.add(planned(TODAY, false));
        InsightRules.taskCompletion(WEEK, week, f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("You completed 4 of 5 tasks planned this week (80%).");
        assertThat(i.severity()).isEqualTo("GOOD");
        assertThat(i.evidence().from()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(i.evidence().facts().get(2).value()).isEqualTo("80%");
        assertThat(i.link()).isEqualTo("/app/planner/calendar?date=2026-10-05");
        // The open one is listed first
        assertThat(i.sources().getFirst().id()).isEqualTo(week.get(4).id());
    }

    @Test
    void carriedOverCountsOpenTasksFromEarlierDays() {
        Findings f = new Findings();
        InsightRules.carriedOver(
                WEEK,
                List.of(
                        planned(LocalDate.of(2026, 10, 5), false),
                        planned(LocalDate.of(2026, 10, 6), false),
                        planned(TODAY, false), // today's: not carried over yet
                        planned(LocalDate.of(2026, 10, 6), true)),
                f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("2 tasks planned for earlier days this week are still open.");
        assertThat(i.severity()).isEqualTo("INFO");
        assertThat(i.evidence().facts().get(1).value()).isEqualTo("Mon 5 Oct");
    }

    @Test
    void deadlineClusterFindsTheBusiestDay() {
        Instant fri = Instant.parse("2026-10-09T18:00:00Z");
        Findings f = new Findings();
        InsightRules.deadlineCluster(
                WEEK,
                List.of(due(fri), due(fri.plusSeconds(3600))),
                List.of(assignment(fri.plusSeconds(60), null), assignment(Instant.parse("2026-10-12T09:00:00Z"), null)),
                f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("Friday 9 Oct holds 3 of your 4 deadlines in the next 7 days.");
        assertThat(i.severity()).isEqualTo("WARN");
        assertThat(i.sources()).hasSize(3);
        assertThat(i.link()).isEqualTo("/app/planner/calendar?date=2026-10-09");

        // Spread out: no insight, no "needs more data" either
        f = new Findings();
        InsightRules.deadlineCluster(
                WEEK,
                List.of(due(Instant.parse("2026-10-08T09:00:00Z")), due(Instant.parse("2026-10-09T09:00:00Z"))),
                List.of(assignment(Instant.parse("2026-10-10T09:00:00Z"), null)),
                f);
        assertThat(f.insights()).isEmpty();
        assertThat(f.quiet()).isEmpty();

        f = new Findings();
        InsightRules.deadlineCluster(WEEK, List.of(due(fri)), List.of(), f);
        assertThat(f.quiet().getFirst().reason()).isEqualTo("Needs 3 deadlines in the next 7 days to look for a cluster; you have 1.");
    }

    @Test
    void attendanceDropComparesTheStartOfTheWindowWithNow() {
        UUID dbms = id();
        Findings f = new Findings();
        InsightRules.attendanceDrop(
                WEEK,
                List.of(
                        new AttendanceIn(dbms, "CS301", 20, 17, 24, 18, true), // 85% → 75%
                        new AttendanceIn(id(), "CS302", 20, 18, 22, 20, false), // 90% → 90.9%: rose
                        new AttendanceIn(id(), "CS303", 20, 18, 21, 18, false)), // only 1 class since
                f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("CS301 attendance fell from 85% to 75% this week.");
        assertThat(i.severity()).isEqualTo("WARN");
        assertThat(i.evidence().facts().get(0).value()).isEqualTo("85% (17 of 20)");
        assertThat(i.evidence().facts().get(2).value()).isEqualTo("4");
        assertThat(i.link()).isEqualTo("/app/academics/courses/" + dbms);

        f = new Findings();
        InsightRules.attendanceDrop(WEEK, List.of(new AttendanceIn(dbms, "CS301", 20, 17, 21, 17, false)), f);
        assertThat(f.quiet().getFirst().reason()).isEqualTo("Needs 2 classes marked in a course this week to compare.");
    }

    @Test
    void examPrepGapListsExamsUnderHalfReady() {
        Findings f = new Findings();
        InsightRules.examPrepGap(
                WEEK,
                List.of(
                        new ExamIn(id(), "DBMS midsem", "CS301", Instant.parse("2026-10-12T09:00:00Z"), 1, 6),
                        new ExamIn(id(), "OS quiz", "CS303", Instant.parse("2026-10-09T09:00:00Z"), 0, 3),
                        new ExamIn(id(), "Ready", "CS302", Instant.parse("2026-10-10T09:00:00Z"), 3, 4),
                        new ExamIn(id(), "No topics", "CS304", Instant.parse("2026-10-10T09:00:00Z"), 0, 0),
                        new ExamIn(id(), "Far", "CS305", Instant.parse("2026-11-30T09:00:00Z"), 0, 4)),
                f);
        Insight i = only(f);
        assertThat(i.text())
                .isEqualTo("2 exams in the next 14 days are less than half prepared: OS quiz (0 of 3 topics),"
                        + " DBMS midsem (1 of 6 topics).");
        assertThat(i.evidence().facts().getFirst().label()).isEqualTo("OS quiz · Fri 9 Oct");
        assertThat(i.link()).isEqualTo("/app/academics/exams");
    }

    @Test
    void onTimeSubmissionsNeedsThreeHandedIn() {
        Instant mon = Instant.parse("2026-10-05T18:00:00Z");
        Findings f = new Findings();
        InsightRules.onTimeSubmissions(
                WEEK,
                List.of(
                        assignment(mon, mon.minusSeconds(60)),
                        assignment(mon, mon), // at the deadline counts as on time
                        assignment(mon, mon.plusSeconds(3600)),
                        assignment(mon, null)), // not handed in: not counted
                f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("2 of 3 assignments due this week were handed in on time (67%).");
        assertThat(i.severity()).isEqualTo("INFO");
        assertThat(i.sources().getFirst().label()).isEqualTo("Lab " + (n - 1) + " · CS301"); // the late one first

        f = new Findings();
        InsightRules.onTimeSubmissions(MONTH, List.of(assignment(mon, mon)), f);
        assertThat(f.quiet().getFirst().reason()).isEqualTo("Needs 3 assignments due and handed in this month; you have 1.");
    }

    @Test
    void gitHubComparesTheSameDaysOfEachMonth() {
        List<ContributionDay> days = List.of(
                new ContributionDay(LocalDate.of(2026, 9, 2), 3),
                new ContributionDay(LocalDate.of(2026, 9, 20), 50), // after 7 Sep: not compared
                new ContributionDay(LocalDate.of(2026, 10, 1), 4),
                new ContributionDay(LocalDate.of(2026, 10, 6), 5));
        Findings f = new Findings();
        InsightRules.gitHubTrend(MONTH, Instant.parse("2026-10-07T08:00:00Z"), days, f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("9 public contributions in 1–7 Oct, up from 3 in 1–7 Sep.");
        assertThat(i.severity()).isEqualTo("GOOD");
        assertThat(i.evidence().note()).isEqualTo("From GitHub, saved 2026-10-07T08:00:00Z.");

        f = new Findings();
        InsightRules.gitHubTrend(MONTH, null, List.of(), f);
        assertThat(f.quiet().getFirst().reason()).startsWith("Needs the contribution calendar");

        f = new Findings();
        InsightRules.gitHubTrend(MONTH, Instant.parse("2026-10-07T08:00:00Z"), days.subList(2, 4), f);
        assertThat(f.insights()).isEmpty();
        assertThat(f.quiet().getFirst().reason()).contains("you have 9 this month and 0 in the same days of last month");
    }

    @Test
    void stalledProjectsAfterTwoWeeksWithoutAFinishedMilestone() {
        UUID bus = id();
        Findings f = new Findings();
        InsightRules.stalledProjects(
                WEEK,
                List.of(
                        new ProjectIn(bus, "Bus tracker", 2, NOW.minus(Duration.ofDays(20)), true),
                        new ProjectIn(id(), "Fresh", 3, NOW.minus(Duration.ofDays(3)), true),
                        new ProjectIn(id(), "All done", 0, NOW.minus(Duration.ofDays(40)), true)),
                f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("No milestone finished on Bus tracker in 20 days.");
        assertThat(i.link()).isEqualTo("/app/developer/projects/" + bus);
    }

    @Test
    void internshipResponseNeedsThreeApplicationsEachMonth() {
        Findings f = new Findings();
        InsightRules.internshipResponse(
                MONTH,
                new MonthRate(YearMonth.of(2026, 10), 4, 1),
                new MonthRate(YearMonth.of(2026, 9), 6, 3),
                true,
                f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("25% of applications sent in Oct have had a response, vs 50% of those sent in Sep.");
        assertThat(i.evidence().note()).isEqualTo("Applications sent recently have had less time to hear back.");

        f = new Findings();
        InsightRules.internshipResponse(
                MONTH, new MonthRate(YearMonth.of(2026, 10), 1, 0), new MonthRate(YearMonth.of(2026, 9), 6, 3), true, f);
        assertThat(f.quiet().getFirst().reason())
                .isEqualTo("Needs 3 applications sent in each of this month and last; you have 1 and 6.");

        f = new Findings();
        InsightRules.internshipResponse(
                MONTH, new MonthRate(YearMonth.of(2026, 10), 0, 0), new MonthRate(YearMonth.of(2026, 9), 0, 0), false, f);
        assertThat(f.quiet()).isEmpty();
    }

    @Test
    void busyDaysThatClashWithAnExamOrAHackathon() {
        Instant thu = Instant.parse("2026-10-08T18:00:00Z");
        Findings f = new Findings();
        InsightRules.busyDayClash(
                WEEK,
                List.of(due(thu)),
                List.of(assignment(thu.minusSeconds(3600), null)),
                List.of(new ExamIn(id(), "DBMS midsem", "CS301", Instant.parse("2026-10-08T09:00:00Z"), 0, 2)),
                List.of(new HackathonIn(id(), "HackSRM", LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 9))),
                f);
        Insight i = only(f);
        assertThat(i.text()).isEqualTo("Thursday 8 Oct has 2 deadlines and DBMS midsem and HackSRM.");
        assertThat(i.sources()).hasSize(4);
    }

    @Test
    void studyTimeBeforeExamsWarnsWhenNoneIsPlanned() {
        UUID dbms = id();
        UUID os = id();
        List<ExamIn> exams = List.of(
                new ExamIn(dbms, "DBMS midsem", "CS301", Instant.parse("2026-10-12T09:00:00Z"), 1, 4),
                new ExamIn(os, "OS quiz", "CS303", Instant.parse("2026-10-09T09:00:00Z"), 0, 2));
        List<TaskIn> study = List.of(
                new TaskIn(id(), "Study joins", LocalDate.of(2026, 10, 8), null, false, 90, dbms),
                new TaskIn(id(), "Study indexing", LocalDate.of(2026, 10, 10), null, false, 120, dbms),
                new TaskIn(id(), "Study B-trees", LocalDate.of(2026, 10, 11), null, false, null, dbms),
                new TaskIn(id(), "After the exam", LocalDate.of(2026, 10, 13), null, false, 60, dbms));
        Findings f = new Findings();
        InsightRules.examStudyTime(WEEK, exams, study, f);
        assertThat(f.insights()).extracting(Insight::text).containsExactly(
                "No study time planned before OS quiz in 2 days, with 2 topics still to go.",
                "3 study sessions (3 h 30 min) planned before DBMS midsem in 5 days, for 3 topics still to go.");
        assertThat(f.insights().get(0).severity()).isEqualTo("WARN");
        assertThat(f.insights().get(1).evidence().facts().get(2).value()).isEqualTo("1");
    }

    @Test
    void rankingPutsWarningsFirst() {
        Findings f = new Findings();
        InsightRules.stalledProjects(
                WEEK, List.of(new ProjectIn(id(), "Bus", 1, NOW.minus(Duration.ofDays(30)), false)), f);
        InsightRules.examPrepGap(
                WEEK, List.of(new ExamIn(id(), "Quiz", null, Instant.parse("2026-10-09T09:00:00Z"), 0, 2)), f);
        assertThat(f.ranked()).extracting(Insight::rule).containsExactly("EXAM_PREP_GAP", "STALLED_PROJECT");
        assertThat(f.ranked().get(1).text()).isEqualTo("No milestone finished on Bus since you added it 30 days ago.");
    }

    @Test
    void chartsCoverEveryDay() {
        assertThat(InsightRules.tasksPerDay(
                        LocalDate.of(2026, 10, 5),
                        TODAY,
                        List.of(planned(TODAY, true), planned(TODAY, false)),
                        List.of(TODAY, LocalDate.of(2026, 10, 5))))
                .extracting(d -> d.date() + "=" + d.planned() + "/" + d.done())
                .containsExactly("2026-10-05=0/1", "2026-10-06=0/0", "2026-10-07=2/1");
        assertThat(InsightRules.deadlinesPerDay(WEEK, 3, List.of(due(NOW.plusSeconds(60))), List.of(), List.of()))
                .extracting(d -> d.deadlines())
                .containsExactly(1, 0, 0);
        assertThat(InsightRules.duration(45)).isEqualTo("45 min");
        assertThat(InsightRules.duration(60)).isEqualTo("1 h");
        assertThat(InsightRules.range(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 1))).isEqualTo("1 Oct");
    }
}
