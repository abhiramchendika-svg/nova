package dev.nova.academics.grading;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * A grading scale as data: its maximum and its letter grades. Built-in presets have no owner
 * ({@code userId == null}) and are read-only; users clone them to make their own.
 */
@Entity
@Table(name = "grading_schemes")
public class GradingScheme extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "max_points", nullable = false, precision = 4, scale = 2)
    private BigDecimal maxPoints;

    @OneToMany(mappedBy = "scheme", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<GradeDefinition> grades = new ArrayList<>();

    protected GradingScheme() {}

    public GradingScheme(UUID userId, String name, BigDecimal maxPoints) {
        this.userId = userId;
        this.name = name;
        this.maxPoints = maxPoints;
    }

    public boolean isBuiltIn() {
        return userId == null;
    }

    public boolean isOwnedBy(UUID user) {
        return userId != null && userId.equals(user);
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changeMaxPoints(BigDecimal maxPoints) {
        this.maxPoints = maxPoints;
    }

    public GradeDefinition addGrade(String label, BigDecimal points, boolean passing, boolean countsInGpa, int position) {
        GradeDefinition grade = new GradeDefinition(this, label, points, passing, countsInGpa, position);
        grades.add(grade);
        return grade;
    }

    /** Removing from the collection deletes the row (orphanRemoval). */
    public void removeGrade(GradeDefinition grade) {
        grades.remove(grade);
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

    public BigDecimal getMaxPoints() {
        return maxPoints;
    }

    public List<GradeDefinition> getGrades() {
        return Collections.unmodifiableList(grades);
    }
}
