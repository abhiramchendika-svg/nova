package dev.nova.academics.semester;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A term of study. Related rows are referenced by id rather than mapped as JPA relations: services
 * load exactly what they need in a few explicit queries, and nothing is lazily loaded by surprise.
 */
@Entity
@Table(name = "semesters")
public class Semester extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "grading_scheme_id", nullable = false)
    private UUID gradingSchemeId;

    @Column(nullable = false, length = 40)
    private String name;

    @Column(nullable = false)
    private int ordinal;

    @Column(name = "starts_on")
    private LocalDate startsOn;

    @Column(name = "ends_on")
    private LocalDate endsOn;

    @Column(name = "is_current", nullable = false)
    private boolean current;

    /** Percentage in (0, 100); null = inherit the user's default. */
    @Column(name = "attendance_target", precision = 5, scale = 2)
    private BigDecimal attendanceTarget;

    protected Semester() {}

    public Semester(UUID userId) {
        this.userId = userId;
    }

    /** Everything a user can edit, in one place so create and update can't drift apart. */
    public void apply(
            String name,
            int ordinal,
            LocalDate startsOn,
            LocalDate endsOn,
            UUID gradingSchemeId,
            BigDecimal attendanceTarget) {
        this.name = name;
        this.ordinal = ordinal;
        this.startsOn = startsOn;
        this.endsOn = endsOn;
        this.gradingSchemeId = gradingSchemeId;
        this.attendanceTarget = attendanceTarget;
    }

    void setCurrent(boolean current) {
        this.current = current;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getGradingSchemeId() {
        return gradingSchemeId;
    }

    public String getName() {
        return name;
    }

    public int getOrdinal() {
        return ordinal;
    }

    public LocalDate getStartsOn() {
        return startsOn;
    }

    public LocalDate getEndsOn() {
        return endsOn;
    }

    public boolean isCurrent() {
        return current;
    }

    public BigDecimal getAttendanceTarget() {
        return attendanceTarget;
    }
}
