package dev.nova.academics.resource;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import java.util.UUID;

/** A link kept with a course: the syllabus, a lecture playlist, the course's LMS page. */
@Entity
@Table(name = "course_resources")
public class CourseResource extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 2048)
    private String url;

    protected CourseResource() {}

    public CourseResource(UUID userId, UUID courseId, String title, String url) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.courseId = Objects.requireNonNull(courseId, "courseId");
        edit(title, url);
    }

    public void edit(String title, String url) {
        this.title = Objects.requireNonNull(title, "title");
        this.url = Objects.requireNonNull(url, "url");
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

    public String getUrl() {
        return url;
    }
}
