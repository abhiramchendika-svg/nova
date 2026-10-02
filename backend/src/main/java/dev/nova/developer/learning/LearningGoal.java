package dev.nova.developer.learning;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/** Something the user is learning. Progress comes from its topics and is never stored. */
@Entity
@Table(name = "learning_goals")
public class LearningGoal extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 4000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private GoalStatus status = GoalStatus.ACTIVE;

    @Column(name = "target_on")
    private LocalDate targetOn;

    protected LearningGoal() {}

    public LearningGoal(UUID userId) {
        this.userId = Objects.requireNonNull(userId, "userId");
    }

    public void edit(String title, String description, GoalStatus status, LocalDate targetOn) {
        this.title = Objects.requireNonNull(title, "title");
        this.description = description;
        this.status = Objects.requireNonNull(status, "status");
        this.targetOn = targetOn;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public GoalStatus getStatus() {
        return status;
    }

    public LocalDate getTargetOn() {
        return targetOn;
    }
}
