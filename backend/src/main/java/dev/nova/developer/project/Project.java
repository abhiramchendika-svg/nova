package dev.nova.developer.project;

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
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Something the user is building. Progress comes from its milestones and is never stored. */
@Entity
@Table(name = "projects")
public class Project extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 4000)
    private String description;

    /** A PostgreSQL text[]: one value, no join, ordered as entered. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "tech_stack", nullable = false, columnDefinition = "text[]")
    private List<String> techStack = new ArrayList<>();

    @Column(name = "repo_url", length = 2048)
    private String repoUrl;

    @Column(name = "demo_url", length = 2048)
    private String demoUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 11)
    private ProjectStatus status = ProjectStatus.IDEA;

    @Column(name = "started_on")
    private LocalDate startedOn;

    @Column(name = "target_on")
    private LocalDate targetOn;

    protected Project() {}

    public Project(UUID userId) {
        this.userId = Objects.requireNonNull(userId, "userId");
    }

    public void edit(
            String name,
            String description,
            List<String> techStack,
            String repoUrl,
            String demoUrl,
            ProjectStatus status,
            LocalDate startedOn,
            LocalDate targetOn) {
        if (startedOn != null && targetOn != null && targetOn.isBefore(startedOn)) {
            throw new IllegalArgumentException("The target date can't be before the start date");
        }
        this.name = Objects.requireNonNull(name, "name");
        this.description = description;
        this.techStack = new ArrayList<>(Objects.requireNonNull(techStack, "techStack"));
        this.repoUrl = repoUrl;
        this.demoUrl = demoUrl;
        this.status = Objects.requireNonNull(status, "status");
        this.startedOn = startedOn;
        this.targetOn = targetOn;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public List<String> getTechStack() {
        return List.copyOf(techStack);
    }

    public String getRepoUrl() {
        return repoUrl;
    }

    public String getDemoUrl() {
        return demoUrl;
    }

    public ProjectStatus getStatus() {
        return status;
    }

    public LocalDate getStartedOn() {
        return startedOn;
    }

    public LocalDate getTargetOn() {
        return targetOn;
    }
}
