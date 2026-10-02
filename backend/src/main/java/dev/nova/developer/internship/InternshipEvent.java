package dev.nova.developer.internship;

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

/** One status change of an application; append-only. The first one has no {@code fromStatus}. */
@Entity
@Table(name = "internship_status_events")
public class InternshipEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "application_id", nullable = false, updatable = false)
    private UUID applicationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 10, updatable = false)
    private InternshipStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 10, updatable = false)
    private InternshipStatus toStatus;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected InternshipEvent() {}

    public InternshipEvent(
            UUID userId, UUID applicationId, InternshipStatus fromStatus, InternshipStatus toStatus, Instant changedAt) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.applicationId = Objects.requireNonNull(applicationId, "applicationId");
        this.fromStatus = fromStatus;
        this.toStatus = Objects.requireNonNull(toStatus, "toStatus");
        this.changedAt = Objects.requireNonNull(changedAt, "changedAt");
    }

    public UUID getId() {
        return id;
    }

    public UUID getApplicationId() {
        return applicationId;
    }

    public InternshipStatus getFromStatus() {
        return fromStatus;
    }

    public InternshipStatus getToStatus() {
        return toStatus;
    }

    public Instant getChangedAt() {
        return changedAt;
    }
}
