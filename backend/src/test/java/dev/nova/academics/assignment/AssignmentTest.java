package dev.nova.academics.assignment;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Status and progress move together; these are the same rules the database checks (V5). */
class AssignmentTest {

    private static final Instant T1 = Instant.parse("2026-09-30T10:00:00Z");
    private static final Instant T2 = Instant.parse("2026-10-01T10:00:00Z");

    private static Assignment fresh() {
        Assignment a = new Assignment(UUID.randomUUID());
        a.edit(UUID.randomUUID(), "Lab report", null, T2, AssignmentPriority.MEDIUM, null);
        return a;
    }

    @Test
    void startsNotStartedAtZero() {
        Assignment a = fresh();
        assertThat(a.getStatus()).isEqualTo(AssignmentStatus.NOT_STARTED);
        assertThat(a.getProgressPct()).isZero();
    }

    @Test
    void progressAloneStartsTheWork() {
        Assignment a = fresh();
        a.updateProgress(null, 40, T1);
        assertThat(a.getStatus()).isEqualTo(AssignmentStatus.IN_PROGRESS);
        assertThat(a.getProgressPct()).isEqualTo(40);
    }

    @Test
    void zeroProgressOnANewAssignmentLeavesItNotStarted() {
        Assignment a = fresh();
        a.updateProgress(null, 0, T1);
        assertThat(a.getStatus()).isEqualTo(AssignmentStatus.NOT_STARTED);
    }

    @Test
    void completingForcesFullProgressAndRecordsWhen() {
        Assignment a = fresh();
        a.updateProgress(AssignmentStatus.COMPLETED, 30, T1);
        assertThat(a.getProgressPct()).isEqualTo(100);
        assertThat(a.getCompletedAt()).isEqualTo(T1);

        // Completing again keeps the original time
        a.updateProgress(AssignmentStatus.COMPLETED, null, T2);
        assertThat(a.getCompletedAt()).isEqualTo(T1);
    }

    @Test
    void submittingRecordsWhenAndKeepsProgress() {
        Assignment a = fresh();
        a.updateProgress(AssignmentStatus.IN_PROGRESS, 90, T1);
        a.updateProgress(AssignmentStatus.SUBMITTED, null, T2);
        assertThat(a.getSubmittedAt()).isEqualTo(T2);
        assertThat(a.getCompletedAt()).isNull();
        assertThat(a.getProgressPct()).isEqualTo(90);
    }

    @Test
    void submittedThenCompletedKeepsTheSubmissionTime() {
        Assignment a = fresh();
        a.updateProgress(AssignmentStatus.SUBMITTED, null, T1);
        a.updateProgress(AssignmentStatus.COMPLETED, null, T2);
        assertThat(a.getSubmittedAt()).isEqualTo(T1);
        assertThat(a.getCompletedAt()).isEqualTo(T2);
    }

    @Test
    void reopeningClearsTheTimestamps() {
        Assignment a = fresh();
        a.updateProgress(AssignmentStatus.COMPLETED, null, T1);
        a.updateProgress(AssignmentStatus.IN_PROGRESS, 60, T2);
        assertThat(a.getCompletedAt()).isNull();
        assertThat(a.getSubmittedAt()).isNull();
        assertThat(a.getProgressPct()).isEqualTo(60);
    }

    @Test
    void backToNotStartedResetsProgress() {
        Assignment a = fresh();
        a.updateProgress(AssignmentStatus.SUBMITTED, 80, T1);
        a.updateProgress(AssignmentStatus.NOT_STARTED, null, T2);
        assertThat(a.getProgressPct()).isZero();
        assertThat(a.getSubmittedAt()).isNull();
    }

    @Test
    void onlyNotStartedAndInProgressAreOpen() {
        assertThat(AssignmentStatus.NOT_STARTED.isOpen()).isTrue();
        assertThat(AssignmentStatus.IN_PROGRESS.isOpen()).isTrue();
        assertThat(AssignmentStatus.SUBMITTED.isOpen()).isFalse();
        assertThat(AssignmentStatus.COMPLETED.isOpen()).isFalse();
    }
}
