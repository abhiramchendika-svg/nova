package dev.nova.developer.learning;

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

/** One thing to learn within a goal, in display order. */
@Entity
@Table(name = "learning_topics")
public class LearningTopic extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "goal_id", nullable = false, updatable = false)
    private UUID goalId;

    @Column(nullable = false, length = 160)
    private String title;

    /** Display order from 0. Named displayOrder in Java so it can't be confused with HQL's position(). */
    @Column(name = "position", nullable = false)
    private int displayOrder;

    @Column(name = "done_at")
    private Instant doneAt;

    protected LearningTopic() {}

    public LearningTopic(UUID userId, UUID goalId, String title, int displayOrder) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.goalId = Objects.requireNonNull(goalId, "goalId");
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

    public UUID getGoalId() {
        return goalId;
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
