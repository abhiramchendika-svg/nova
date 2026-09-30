package dev.nova.academics.course;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

/**
 * A course in a semester. Its grade is a pair (grade definition, FINAL/EXPECTED): both set or both
 * null, which the database also enforces.
 */
@Entity
@Table(name = "courses")
public class Course extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "semester_id", nullable = false)
    private UUID semesterId;

    @Column(length = 20)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, precision = 4, scale = 1)
    private BigDecimal credits;

    @Column(length = 120)
    private String faculty;

    @Column(name = "color_hue")
    private Integer colorHue;

    @Column(length = 2000)
    private String notes;

    @Column(name = "grade_definition_id")
    private UUID gradeDefinitionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "grade_kind", length = 8)
    private GradeKind gradeKind;

    /** Percentage in (0, 100); null = inherit the semester's target. Used from Phase 2.2. */
    @Column(name = "attendance_target", precision = 5, scale = 2)
    private BigDecimal attendanceTarget;

    // Attendance baseline (see setAttendanceBaseline)
    @Column(name = "baseline_conducted", nullable = false)
    private int baselineConducted;

    @Column(name = "baseline_attended", nullable = false)
    private int baselineAttended;

    protected Course() {}

    public Course(UUID userId) {
        this.userId = userId;
    }

    /** Everything a user edits through the course form. */
    public void apply(
            UUID semesterId,
            String code,
            String name,
            BigDecimal credits,
            String faculty,
            Integer colorHue,
            String notes,
            BigDecimal attendanceTarget) {
        this.semesterId = semesterId;
        this.code = code;
        this.name = name;
        this.credits = credits;
        this.faculty = faculty;
        this.colorHue = colorHue;
        this.notes = notes;
        this.attendanceTarget = attendanceTarget;
    }

    /** The counts a student starts from, e.g. "28 of 34" copied from the university portal. */
    public void setAttendanceBaseline(int conducted, int attended) {
        if (conducted < 0 || attended < 0 || attended > conducted) {
            throw new IllegalArgumentException("Need 0 ≤ attended ≤ conducted");
        }
        this.baselineConducted = conducted;
        this.baselineAttended = attended;
    }

    public void grade(UUID gradeDefinitionId, GradeKind kind) {
        this.gradeDefinitionId = Objects.requireNonNull(gradeDefinitionId, "gradeDefinitionId");
        this.gradeKind = Objects.requireNonNull(kind, "kind");
    }

    public void clearGrade() {
        this.gradeDefinitionId = null;
        this.gradeKind = null;
    }

    public boolean isGraded() {
        return gradeDefinitionId != null;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getSemesterId() {
        return semesterId;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getCredits() {
        return credits;
    }

    public String getFaculty() {
        return faculty;
    }

    public Integer getColorHue() {
        return colorHue;
    }

    public String getNotes() {
        return notes;
    }

    public UUID getGradeDefinitionId() {
        return gradeDefinitionId;
    }

    public GradeKind getGradeKind() {
        return gradeKind;
    }

    public BigDecimal getAttendanceTarget() {
        return attendanceTarget;
    }

    public int getBaselineConducted() {
        return baselineConducted;
    }

    public int getBaselineAttended() {
        return baselineAttended;
    }
}
