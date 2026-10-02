package dev.nova.developer.learning;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import java.util.UUID;

/** A titled http(s) link the user follows for a goal: docs, a course, a video. */
@Entity
@Table(name = "learning_resources")
public class LearningResource extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "goal_id", nullable = false, updatable = false)
    private UUID goalId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 2048)
    private String url;

    protected LearningResource() {}

    public LearningResource(UUID userId, UUID goalId, String title, String url) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.goalId = Objects.requireNonNull(goalId, "goalId");
        edit(title, url);
    }

    public void edit(String title, String url) {
        this.title = Objects.requireNonNull(title, "title");
        this.url = Objects.requireNonNull(url, "url");
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

    public String getUrl() {
        return url;
    }
}
