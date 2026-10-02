package dev.nova.developer.internship;

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
import java.util.Objects;
import java.util.UUID;

/** One internship application. Its status changes are kept as {@link InternshipEvent}s. */
@Entity
@Table(name = "internship_applications")
public class Internship extends AuditedEntity {

    /** Everything the form edits except the status, already validated and normalised. */
    public record Details(
            String company,
            String role,
            String location,
            String jobUrl,
            String source,
            LocalDate appliedOn,
            Instant deadlineAt,
            String nextStep,
            Instant nextStepAt,
            String resumeVersion,
            String notes) {

        public Details {
            Objects.requireNonNull(company, "company");
            Objects.requireNonNull(role, "role");
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String company;

    @Column(nullable = false, length = 120)
    private String role;

    @Column(length = 120)
    private String location;

    @Column(name = "job_url", length = 2048)
    private String jobUrl;

    @Column(length = 60)
    private String source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private InternshipStatus status = InternshipStatus.APPLIED;

    @Column(name = "applied_on")
    private LocalDate appliedOn;

    @Column(name = "deadline_at")
    private Instant deadlineAt;

    @Column(name = "next_step", length = 120)
    private String nextStep;

    @Column(name = "next_step_at")
    private Instant nextStepAt;

    @Column(name = "resume_version", length = 60)
    private String resumeVersion;

    @Column(length = 4000)
    private String notes;

    protected Internship() {}

    public Internship(UUID userId, InternshipStatus status) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.status = Objects.requireNonNull(status, "status");
    }

    /**
     * Applies the form. A missing applied date keeps the one already set; anything past "saved"
     * needs one, and {@code today} fills it in.
     */
    public void edit(Details d, LocalDate today) {
        Objects.requireNonNull(d, "details");
        this.company = d.company();
        this.role = d.role();
        this.location = d.location();
        this.jobUrl = d.jobUrl();
        this.source = d.source();
        if (d.appliedOn() != null) {
            this.appliedOn = d.appliedOn();
        }
        this.deadlineAt = d.deadlineAt();
        this.nextStep = d.nextStep();
        this.nextStepAt = d.nextStepAt();
        this.resumeVersion = d.resumeVersion();
        this.notes = d.notes();
        fillAppliedOn(today);
    }

    /** Moves to {@code next}; returns the previous status (equal to {@code next} when nothing changed). */
    public InternshipStatus moveTo(InternshipStatus next, LocalDate today) {
        InternshipStatus previous = status;
        status = Objects.requireNonNull(next, "status");
        fillAppliedOn(today);
        return previous;
    }

    private void fillAppliedOn(LocalDate today) {
        if (status != InternshipStatus.SAVED && appliedOn == null) {
            appliedOn = Objects.requireNonNull(today, "today");
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getCompany() {
        return company;
    }

    public String getRole() {
        return role;
    }

    public String getLocation() {
        return location;
    }

    public String getJobUrl() {
        return jobUrl;
    }

    public String getSource() {
        return source;
    }

    public InternshipStatus getStatus() {
        return status;
    }

    public LocalDate getAppliedOn() {
        return appliedOn;
    }

    public Instant getDeadlineAt() {
        return deadlineAt;
    }

    public String getNextStep() {
        return nextStep;
    }

    public Instant getNextStepAt() {
        return nextStepAt;
    }

    public String getResumeVersion() {
        return resumeVersion;
    }

    public String getNotes() {
        return notes;
    }
}
