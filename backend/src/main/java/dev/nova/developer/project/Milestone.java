package dev.nova.developer.project;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/** A step in a project, in display order, optionally due on a day. */
@Entity
@Table(name = "project_milestones")
public class Milestone extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(name = "due_on")
    private LocalDate dueOn;

    /** Display order from 0. Named displayOrder in Java so it can't be confused with HQL's position(). */
    @Column(name = "position", nullable = false)
    private int displayOrder;

    @Column(name = "done_at")
    private Instant doneAt;

    protected Milestone() {}

    public Milestone(UUID userId, UUID projectId, String title, LocalDate dueOn, int displayOrder) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.projectId = Objects.requireNonNull(projectId, "projectId");
        edit(title, dueOn);
        moveTo(displayOrder);
    }

    public void edit(String title, LocalDate dueOn) {
        this.title = Objects.requireNonNull(title, "title");
        this.dueOn = dueOn;
    }

    public void moveTo(int displayOrder) {
        if (displayOrder < 0) {
            throw new IllegalArgumentException("Position can't be negative");
        }
        this.displayOrder = displayOrder;
    }

    /** Ticking an already-done milestone keeps its original time. */
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

    public UUID getProjectId() {
        return projectId;
    }

    public String getTitle() {
        return title;
    }

    public LocalDate getDueOn() {
        return dueOn;
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
