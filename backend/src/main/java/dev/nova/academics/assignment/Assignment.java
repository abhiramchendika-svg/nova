package dev.nova.academics.assignment;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** A piece of coursework with a due date, a priority and progress. */
@Entity
@Table(name = "assignments")
public class Assignment extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 4000)
    private String description;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private AssignmentPriority priority = AssignmentPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 11)
    private AssignmentStatus status = AssignmentStatus.NOT_STARTED;

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    @Column(name = "progress_pct", nullable = false)
    private int progressPct;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected Assignment() {}

    public Assignment(UUID userId) {
        this.userId = Objects.requireNonNull(userId, "userId");
    }

    /** Everything the assignment form edits. Progress has its own method. */
    public void edit(
            UUID courseId,
            String title,
            String description,
            Instant dueAt,
            AssignmentPriority priority,
            Integer estimatedMinutes) {
        this.courseId = Objects.requireNonNull(courseId, "courseId");
        this.title = Objects.requireNonNull(title, "title");
        this.description = description;
        this.dueAt = Objects.requireNonNull(dueAt, "dueAt");
        this.priority = Objects.requireNonNull(priority, "priority");
        this.estimatedMinutes = estimatedMinutes;
    }

    /**
     * Moves status and progress together so they never contradict each other (the database checks
     * the same rules):
     * <ul>
     *   <li>COMPLETED forces 100% and records when it was completed;
     *   <li>SUBMITTED records when it was submitted;
     *   <li>going back to NOT_STARTED or IN_PROGRESS clears those timestamps, and NOT_STARTED means 0%;
     *   <li>progress above 0 on a NOT_STARTED assignment (with no status given) starts it.
     * </ul>
     */
    public void updateProgress(AssignmentStatus newStatus, Integer newProgress, Instant now) {
        AssignmentStatus next = newStatus != null ? newStatus : status;
        int progress = newProgress != null ? newProgress : progressPct;
        if (newStatus == null && next == AssignmentStatus.NOT_STARTED && progress > 0) {
            next = AssignmentStatus.IN_PROGRESS;
        }
        switch (next) {
            case COMPLETED -> {
                progress = 100;
                if (completedAt == null) {
                    completedAt = now;
                }
            }
            case SUBMITTED -> {
                completedAt = null;
                if (submittedAt == null) {
                    submittedAt = now;
                }
            }
            case IN_PROGRESS -> {
                completedAt = null;
                submittedAt = null;
            }
            case NOT_STARTED -> {
                completedAt = null;
                submittedAt = null;
                progress = 0;
            }
        }
        if (progress < 0 || progress > 100) {
            throw new IllegalArgumentException("Progress must be between 0 and 100");
        }
        this.status = next;
        this.progressPct = progress;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getCourseId() {
        return courseId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public AssignmentPriority getPriority() {
        return priority;
    }

    public AssignmentStatus getStatus() {
        return status;
    }

    public Integer getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public int getProgressPct() {
        return progressPct;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
