package dev.nova.academics.attendance;

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

/** One marked class: which course, which day (and slot, if it met twice), and what happened. */
@Entity
@Table(name = "attendance_records")
public class AttendanceRecord extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @Column(name = "held_on", nullable = false, updatable = false)
    private LocalDate heldOn;

    @Column(nullable = false, updatable = false)
    private int slot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 9)
    private AttendanceStatus status;

    protected AttendanceRecord() {}

    public AttendanceRecord(UUID userId, UUID courseId, LocalDate heldOn, int slot, AttendanceStatus status) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.courseId = Objects.requireNonNull(courseId, "courseId");
        this.heldOn = Objects.requireNonNull(heldOn, "heldOn");
        this.slot = slot;
        this.status = Objects.requireNonNull(status, "status");
    }

    public void changeStatus(AttendanceStatus status) {
        this.status = Objects.requireNonNull(status, "status");
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

    public LocalDate getHeldOn() {
        return heldOn;
    }

    public int getSlot() {
        return slot;
    }

    public AttendanceStatus getStatus() {
        return status;
    }
}
