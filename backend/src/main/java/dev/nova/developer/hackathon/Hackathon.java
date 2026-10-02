package dev.nova.developer.hackathon;

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

/**
 * A hackathon the user is considering, doing or has done. Status is progress only; how it went is
 * the free-text {@code result} the user writes, never inferred.
 */
@Entity
@Table(name = "hackathons")
public class Hackathon extends AuditedEntity {

    /** Everything the form edits, already validated and normalised. */
    public record Details(
            String name,
            String organizer,
            HackathonMode mode,
            String location,
            String websiteUrl,
            LocalDate startsOn,
            LocalDate endsOn,
            Instant registrationDeadline,
            Instant submissionDeadline,
            HackathonStatus status,
            String teamName,
            String teamMembers,
            UUID projectId,
            String result,
            String repoUrl,
            String demoUrl,
            String certificateUrl,
            String notes) {

        public Details {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(status, "status");
            if (endsOn != null && (startsOn == null || endsOn.isBefore(startsOn))) {
                throw new IllegalArgumentException("The end date needs a start date on or before it");
            }
            if (registrationDeadline != null
                    && submissionDeadline != null
                    && registrationDeadline.isAfter(submissionDeadline)) {
                throw new IllegalArgumentException("Registration can't close after submissions do");
            }
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 120)
    private String organizer;

    @Enumerated(EnumType.STRING)
    @Column(length = 7)
    private HackathonMode mode;

    @Column(length = 120)
    private String location;

    @Column(name = "website_url", length = 2048)
    private String websiteUrl;

    @Column(name = "starts_on")
    private LocalDate startsOn;

    @Column(name = "ends_on")
    private LocalDate endsOn;

    @Column(name = "registration_deadline")
    private Instant registrationDeadline;

    @Column(name = "submission_deadline")
    private Instant submissionDeadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 13)
    private HackathonStatus status = HackathonStatus.INTERESTED;

    @Column(name = "team_name", length = 80)
    private String teamName;

    @Column(name = "team_members", length = 500)
    private String teamMembers;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(length = 160)
    private String result;

    @Column(name = "repo_url", length = 2048)
    private String repoUrl;

    @Column(name = "demo_url", length = 2048)
    private String demoUrl;

    @Column(name = "certificate_url", length = 2048)
    private String certificateUrl;

    @Column(length = 4000)
    private String notes;

    protected Hackathon() {}

    public Hackathon(UUID userId) {
        this.userId = Objects.requireNonNull(userId, "userId");
    }

    public void edit(Details d) {
        Objects.requireNonNull(d, "details");
        this.name = d.name();
        this.organizer = d.organizer();
        this.mode = d.mode();
        this.location = d.location();
        this.websiteUrl = d.websiteUrl();
        this.startsOn = d.startsOn();
        this.endsOn = d.endsOn();
        this.registrationDeadline = d.registrationDeadline();
        this.submissionDeadline = d.submissionDeadline();
        this.status = d.status();
        this.teamName = d.teamName();
        this.teamMembers = d.teamMembers();
        this.projectId = d.projectId();
        this.result = d.result();
        this.repoUrl = d.repoUrl();
        this.demoUrl = d.demoUrl();
        this.certificateUrl = d.certificateUrl();
        this.notes = d.notes();
    }

    /** The last day of the event: its end date, or its start date for a one-day event. */
    public LocalDate lastDay() {
        return endsOn != null ? endsOn : startsOn;
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

    public String getOrganizer() {
        return organizer;
    }

    public HackathonMode getMode() {
        return mode;
    }

    public String getLocation() {
        return location;
    }

    public String getWebsiteUrl() {
        return websiteUrl;
    }

    public LocalDate getStartsOn() {
        return startsOn;
    }

    public LocalDate getEndsOn() {
        return endsOn;
    }

    public Instant getRegistrationDeadline() {
        return registrationDeadline;
    }

    public Instant getSubmissionDeadline() {
        return submissionDeadline;
    }

    public HackathonStatus getStatus() {
        return status;
    }

    public String getTeamName() {
        return teamName;
    }

    public String getTeamMembers() {
        return teamMembers;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getResult() {
        return result;
    }

    public String getRepoUrl() {
        return repoUrl;
    }

    public String getDemoUrl() {
        return demoUrl;
    }

    public String getCertificateUrl() {
        return certificateUrl;
    }

    public String getNotes() {
        return notes;
    }
}
