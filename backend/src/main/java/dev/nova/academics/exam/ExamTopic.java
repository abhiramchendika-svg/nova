package dev.nova.academics.exam;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One item on an exam's prep checklist ("Normalization", "Transactions"). Prep % = done / total. */
@Entity
@Table(name = "exam_topics")
public class ExamTopic extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "exam_id", nullable = false, updatable = false)
    private UUID examId;

    @Column(nullable = false, length = 160)
    private String title;

    /** Display order from 0. Named displayOrder in Java so it can't be confused with HQL's position(). */
    @Column(name = "position", nullable = false)
    private int displayOrder;

    @Column(name = "done_at")
    private Instant doneAt;

    protected ExamTopic() {}

    public ExamTopic(UUID userId, UUID examId, String title, int displayOrder) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.examId = Objects.requireNonNull(examId, "examId");
        rename(title);
        moveTo(displayOrder);
    }

    public void rename(String title) {
        this.title = Objects.requireNonNull(title, "title");
    }

    public void moveTo(int displayOrder) {
        if (displayOrder < 0) {
            throw new IllegalArgumentException("Position can't be negative");
        }
        this.displayOrder = displayOrder;
    }

    /** Ticking an already-done topic keeps its original time. */
    public void markDone(boolean done, Instant now) {
        if (!done) {
            doneAt = null;
        } else if (doneAt == null) {
            doneAt = now;
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getExamId() {
        return examId;
    }

    public String getTitle() {
        return title;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public Instant getDoneAt() {
        return doneAt;
    }

    public boolean isDone() {
        return doneAt != null;
    }
}
