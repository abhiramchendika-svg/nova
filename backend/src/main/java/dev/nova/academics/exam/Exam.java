package dev.nova.academics.exam;

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

/** A scheduled exam, quiz or lab test for a course. Its prep checklist lives in {@link ExamTopic}. */
@Entity
@Table(name = "exams")
public class Exam extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(nullable = false, length = 120)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 7)
    private ExamKind kind = ExamKind.OTHER;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(length = 60)
    private String location;

    protected Exam() {}

    public Exam(UUID userId) {
        this.userId = Objects.requireNonNull(userId, "userId");
    }

    public void edit(
            UUID courseId, String title, ExamKind kind, Instant startsAt, Integer durationMinutes, String location) {
        this.courseId = Objects.requireNonNull(courseId, "courseId");
        this.title = Objects.requireNonNull(title, "title");
        this.kind = Objects.requireNonNull(kind, "kind");
        this.startsAt = Objects.requireNonNull(startsAt, "startsAt");
        this.durationMinutes = durationMinutes;
        this.location = location;
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

    public ExamKind getKind() {
        return kind;
    }

    public Instant getStartsAt() {
        return startsAt;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public String getLocation() {
        return location;
    }
}
