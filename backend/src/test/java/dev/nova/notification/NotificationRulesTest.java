package dev.nova.notification;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.academics.attendance.AttendanceCalculator.Status;
import dev.nova.developer.hackathon.HackathonRules.DeadlineKind;
import dev.nova.notification.NotificationRules.ApplicationInput;
import dev.nova.notification.NotificationRules.AttendanceInput;
import dev.nova.notification.NotificationRules.Deadline;
import dev.nova.notification.NotificationRules.Draft;
import dev.nova.notification.NotificationRules.ExamInput;
import dev.nova.notification.NotificationRules.HackathonInput;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** When each rule fires, what it says, and what makes it "once" — in the user's timezone. */
class NotificationRulesTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    /** Monday 5 Oct 2026, 10:00 in India. */
    private static final Instant NOW = Instant.parse("2026-10-05T04:30:00Z");
    private static final UUID A = UUID.fromString("00000000-0000-4000-8000-00000000000a");
    private static final UUID B = UUID.fromString("00000000-0000-4000-8000-00000000000b");

    private static Deadline deadline(UUID id, Duration fromNow) {
        return new Deadline(id, "Lab report", "CS301", NOW.plus(fromNow), "/app/planner/tasks?task=" + id);
    }

    @Test
    void dueSoonMeansTheNext24Hours() {
        List<Draft> drafts = NotificationRules.tasksDue(
                List.of(
                        deadline(A, Duration.ofHours(23)), // 09:00 tomorrow
                        deadline(B, Duration.ofHours(24)), // exactly 24 h: not yet
                        deadline(UUID.randomUUID(), Duration.ofMinutes(-1))), // already passed
                NOW,
                IST);

        assertThat(drafts).singleElement().satisfies(d -> {
            assertThat(d.type()).isEqualTo(NotificationType.TASK_DUE);
            assertThat(d.title()).isEqualTo("Lab report");
            assertThat(d.body()).isEqualTo("CS301 · Due tomorrow at 09:00");
            assertThat(d.link()).isEqualTo("/app/planner/tasks?task=" + A);
            // Once per item and due day (the user's day)
            assertThat(d.dedupeKey()).isEqualTo("TASK_DUE:" + A + ":2026-10-06");
        });
    }

    @Test
    void assignmentsUseTheirOwnTypeAndWorkWithoutACourseCode() {
        Deadline noCourse = new Deadline(A, "Essay", null, NOW.plus(Duration.ofHours(2)), "/app/academics/assignments");
        assertThat(NotificationRules.assignmentsDue(List.of(noCourse), NOW, IST))
                .singleElement()
                .satisfies(d -> {
                    assertThat(d.type()).isEqualTo(NotificationType.ASSIGNMENT_DUE);
                    assertThat(d.body()).isEqualTo("Due today at 12:00");
                    assertThat(d.dedupeKey()).isEqualTo("ASSIGNMENT_DUE:" + A + ":2026-10-05");
                });
    }

    @Test
    void overdueTasksWaitForTheMorningAfterAndForgetOldOnes() {
        List<Deadline> open = List.of(
                deadline(A, Duration.ofHours(-14)), // 20:00 yesterday
                deadline(B, Duration.ofHours(-1)), // 09:00 today: tomorrow's reminder
                deadline(UUID.randomUUID(), Duration.ofDays(-8))); // older than a week

        assertThat(NotificationRules.tasksOverdue(open, NOW, IST)).singleElement().satisfies(d -> {
            assertThat(d.type()).isEqualTo(NotificationType.TASK_OVERDUE);
            assertThat(d.body()).isEqualTo("CS301 · Was due yesterday · still open");
            assertThat(d.dedupeKey()).isEqualTo("TASK_OVERDUE:" + A + ":2026-10-04");
        });
        // 07:59 in India: too early, nothing yet
        Instant early = Instant.parse("2026-10-05T02:29:00Z");
        assertThat(NotificationRules.tasksOverdue(open, early, IST)).isEmpty();
    }

    @Test
    void examsNotifyOnceWithinThreeDaysWithTheirPrep() {
        Instant monday9 = Instant.parse("2026-10-08T03:30:00Z"); // Thu 8 Oct 09:00 IST
        List<Draft> drafts = NotificationRules.examsSoon(
                List.of(
                        new ExamInput(A, "DBMS midsem", "CS301", monday9, 3, 2, 5),
                        new ExamInput(B, "Quiz", null, NOW.plus(Duration.ofHours(3)), 0, 0, 0),
                        new ExamInput(UUID.randomUUID(), "Final", "CS301", NOW.plus(Duration.ofDays(4)), 4, 0, 3)),
                NOW,
                IST);

        assertThat(drafts).extracting(Draft::title).containsExactly("DBMS midsem is in 3 days", "Quiz is today");
        assertThat(drafts.get(0).body()).isEqualTo("CS301 · Thu 8 Oct at 09:00 · 2 of 5 topics ready");
        assertThat(drafts.get(0).link()).isEqualTo("/app/academics/exams/" + A);
        assertThat(drafts.get(0).dedupeKey()).isEqualTo("EXAM_SOON:" + A + ":2026-10-08");
        assertThat(drafts.get(1).body()).isEqualTo("Mon 5 Oct at 13:00 · No topics listed yet · add them to track your prep");
    }

    @Test
    void attendanceNotifiesOnlyWhenItGetsWorse() {
        assertThat(NotificationRules.attendanceWorsened(null, Status.AT_RISK)).isTrue();
        assertThat(NotificationRules.attendanceWorsened("SAFE", Status.AT_RISK)).isTrue();
        assertThat(NotificationRules.attendanceWorsened("SAFE", Status.BELOW)).isTrue();
        assertThat(NotificationRules.attendanceWorsened("AT_RISK", Status.BELOW)).isTrue();

        assertThat(NotificationRules.attendanceWorsened("AT_RISK", Status.AT_RISK)).isFalse();
        assertThat(NotificationRules.attendanceWorsened("BELOW", Status.BELOW)).isFalse();
        assertThat(NotificationRules.attendanceWorsened("BELOW", Status.AT_RISK)).isFalse(); // improving
        assertThat(NotificationRules.attendanceWorsened("AT_RISK", Status.SAFE)).isFalse();
        assertThat(NotificationRules.attendanceWorsened(null, Status.SAFE)).isFalse();
    }

    @Test
    void attendanceSaysWhatToDo() {
        Draft below = NotificationRules.attendance(
                new AttendanceInput(A, "CS301", Status.BELOW, new BigDecimal("60.00"), new BigDecimal("75.00"), 0, 6),
                "AT_RISK",
                NOW);
        assertThat(below.title()).isEqualTo("CS301 attendance is below your target");
        assertThat(below.body()).isEqualTo("60% · attend the next 6 classes to get back to 75%");
        assertThat(below.link()).isEqualTo("/app/academics/courses/" + A);
        // Each change is its own notification
        assertThat(below.dedupeKey()).isEqualTo("ATTENDANCE_AT_RISK:" + A + ":AT_RISK>BELOW:" + NOW.toEpochMilli());

        Draft atRisk = NotificationRules.attendance(
                new AttendanceInput(A, "CS301", Status.AT_RISK, new BigDecimal("76.5"), new BigDecimal("75"), 1, 0),
                null,
                NOW);
        assertThat(atRisk.dedupeKey()).startsWith("ATTENDANCE_AT_RISK:" + A + ":NEW>AT_RISK:");
        assertThat(atRisk.title()).isEqualTo("CS301 attendance is at risk");
        assertThat(atRisk.body()).isEqualTo("76.5% · you can miss only 1 more class and stay at 75%");
    }

    @Test
    void hackathonDeadlinesWithin24Hours() {
        List<Draft> drafts = NotificationRules.hackathonDeadlines(
                List.of(
                        new HackathonInput(A, "HackSRM", DeadlineKind.REGISTRATION, NOW.plus(Duration.ofHours(8)), false),
                        new HackathonInput(B, "Later", DeadlineKind.SUBMISSION, NOW.plus(Duration.ofDays(2)), false),
                        new HackathonInput(UUID.randomUUID(), "Gone", DeadlineKind.SUBMISSION, NOW.minusSeconds(60), true)),
                NOW,
                IST);
        assertThat(drafts).singleElement().satisfies(d -> {
            assertThat(d.title()).isEqualTo("HackSRM");
            assertThat(d.body()).isEqualTo("Registration closes today at 18:00");
            assertThat(d.dedupeKey()).isEqualTo("HACKATHON_DEADLINE:" + A + ":REGISTRATION:2026-10-05");
        });
    }

    @Test
    void applyByOnlyWhileSavedAndNextStepsTheDayBefore() {
        ApplicationInput saved = new ApplicationInput(
                A, "Acme", "Backend intern", true, NOW.plus(Duration.ofHours(13).plusMinutes(59)), null, null);
        ApplicationInput applied = new ApplicationInput(
                B, "Globex", "SDE intern", false, NOW.plus(Duration.ofHours(2)), "Technical interview",
                Instant.parse("2026-10-06T05:30:00Z")); // tomorrow 11:00 IST

        assertThat(NotificationRules.applyBy(List.of(saved, applied), NOW, IST)).singleElement().satisfies(d -> {
            assertThat(d.title()).isEqualTo("Backend intern at Acme");
            assertThat(d.body()).isEqualTo("Apply by today at 23:59");
            assertThat(d.link()).isEqualTo("/app/developer/internships/" + A);
        });
        assertThat(NotificationRules.nextStepsTomorrow(List.of(saved, applied), NOW, IST))
                .singleElement()
                .satisfies(d -> {
                    assertThat(d.type()).isEqualTo(NotificationType.INTERNSHIP_STEP);
                    assertThat(d.title()).isEqualTo("SDE intern at Globex");
                    assertThat(d.body()).isEqualTo("Technical interview tomorrow at 11:00");
                    assertThat(d.dedupeKey()).isEqualTo("INTERNSHIP_STEP:" + B + ":" + Instant.parse("2026-10-06T05:30:00Z").getEpochSecond());
                });
        // Today's step isn't "tomorrow"
        ApplicationInput today = new ApplicationInput(B, "Globex", "SDE intern", false, null, null, NOW.plusSeconds(3600));
        assertThat(NotificationRules.nextStepsTomorrow(List.of(today), NOW, IST)).isEmpty();
    }

    @Test
    void longNamesAreClippedToFit() {
        String longTitle = "x".repeat(300);
        Draft d = new Draft(NotificationType.TASK_DUE, longTitle, "body", "/app", "k");
        assertThat(d.title()).hasSize(NotificationRules.TITLE_MAX).endsWith("…");
    }
}
