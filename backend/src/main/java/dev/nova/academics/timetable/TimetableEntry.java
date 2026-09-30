package dev.nova.academics.timetable;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

/**
 * A recurring weekly class: course, ISO weekday (1 = Monday) and wall-clock times read in the
 * user's timezone.
 */
@Entity
@Table(name = "timetable_entries")
public class TimetableEntry extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    @Column(name = "starts_at", nullable = false)
    private LocalTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalTime endsAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private ClassKind kind = ClassKind.LECTURE;

    @Column(length = 60)
    private String location;

    @Column(length = 120)
    private String instructor;

    protected TimetableEntry() {}

    public TimetableEntry(UUID userId) {
        this.userId = Objects.requireNonNull(userId, "userId");
    }

    public void edit(
            UUID courseId,
            int dayOfWeek,
            LocalTime startsAt,
            LocalTime endsAt,
            ClassKind kind,
            String location,
            String instructor) {
        if (dayOfWeek < 1 || dayOfWeek > 7) {
            throw new IllegalArgumentException("dayOfWeek must be 1-7");
        }
        if (!endsAt.isAfter(startsAt)) {
            throw new IllegalArgumentException("A class must end after it starts");
        }
        this.courseId = Objects.requireNonNull(courseId, "courseId");
        this.dayOfWeek = dayOfWeek;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.kind = Objects.requireNonNull(kind, "kind");
        this.location = location;
        this.instructor = instructor;
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

    public int getDayOfWeek() {
        return dayOfWeek;
    }

    public LocalTime getStartsAt() {
        return startsAt;
    }

    public LocalTime getEndsAt() {
        return endsAt;
    }

    public ClassKind getKind() {
        return kind;
    }

    public String getLocation() {
        return location;
    }

    public String getInstructor() {
        return instructor;
    }
}
