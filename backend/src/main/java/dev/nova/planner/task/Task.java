package dev.nova.planner.task;

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
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

/**
 * A planner task: an optional do date (and start time, read in the user's timezone), an optional
 * deadline, and optional links to a course, an exam, a project and a learning goal. Status and completedAt move together.
 */
@Entity
@Table(name = "tasks")
public class Task extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 4000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 11)
    private TaskCategory category = TaskCategory.PERSONAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private TaskPriority priority = TaskPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 11)
    private TaskStatus status = TaskStatus.TODO;

    @Column(name = "planned_for")
    private LocalDate plannedFor;

    @Column(name = "planned_start")
    private LocalTime plannedStart;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Recurrence recurrence = Recurrence.NONE;

    @Column(name = "recurrence_series_id")
    private UUID seriesId;

    @Column(name = "course_id")
    private UUID courseId;

    @Column(name = "exam_id")
    private UUID examId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "learning_goal_id")
    private UUID learningGoalId;

    protected Task() {}

    public Task(UUID userId) {
        this.userId = Objects.requireNonNull(userId, "userId");
    }

    /** Everything the task form edits. Status has its own method. */
    public void edit(
            String title,
            String description,
            TaskCategory category,
            TaskPriority priority,
            LocalDate plannedFor,
            LocalTime plannedStart,
            Instant dueAt,
            Integer estimatedMinutes,
            Recurrence recurrence,
            UUID courseId,
            UUID examId,
            UUID projectId,
            UUID learningGoalId) {
        if (plannedStart != null && plannedFor == null) {
            throw new IllegalArgumentException("A start time needs a planned day");
        }
        if (recurrence != Recurrence.NONE && plannedFor == null) {
            throw new IllegalArgumentException("A repeating task needs a planned day");
        }
        this.title = Objects.requireNonNull(title, "title");
        this.description = description;
        this.category = Objects.requireNonNull(category, "category");
        this.priority = Objects.requireNonNull(priority, "priority");
        this.plannedFor = plannedFor;
        this.plannedStart = plannedStart;
        this.dueAt = dueAt;
        this.estimatedMinutes = estimatedMinutes;
        this.recurrence = Objects.requireNonNull(recurrence, "recurrence");
        if (recurrence != Recurrence.NONE && seriesId == null) {
            seriesId = UUID.randomUUID();
        }
        this.courseId = courseId;
        this.examId = examId;
        this.projectId = projectId;
        this.learningGoalId = learningGoalId;
    }

    /** DONE records when; anything else clears it. Completing again keeps the first time. */
    public void changeStatus(TaskStatus next, Instant now) {
        Objects.requireNonNull(next, "status");
        if (next == TaskStatus.DONE) {
            if (completedAt == null) {
                completedAt = now;
            }
        } else {
            completedAt = null;
        }
        status = next;
    }

    /**
     * The next repeat of this task: same details and series, planned {@code nextDay}, with the
     * deadline (if any) moved by the same number of days.
     */
    public Task nextInstance(LocalDate nextDay, Instant nextDueAt) {
        Task next = new Task(userId);
        next.seriesId = seriesId;
        next.edit(
                title,
                description,
                category,
                priority,
                nextDay,
                plannedStart,
                nextDueAt,
                estimatedMinutes,
                recurrence,
                courseId,
                examId,
                projectId,
                learningGoalId);
        return next;
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

    public TaskCategory getCategory() {
        return category;
    }

    public TaskPriority getPriority() {
        return priority;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public LocalDate getPlannedFor() {
        return plannedFor;
    }

    public LocalTime getPlannedStart() {
        return plannedStart;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public Integer getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Recurrence getRecurrence() {
        return recurrence;
    }

    public UUID getSeriesId() {
        return seriesId;
    }

    public UUID getCourseId() {
        return courseId;
    }

    public UUID getExamId() {
        return examId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getLearningGoalId() {
        return learningGoalId;
    }
}
