package dev.nova.academics.grading;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/** One grade in a scheme, e.g. "A+" = 9 points, passing, counts towards GPA. */
@Entity
@Table(name = "grade_definitions")
public class GradeDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private GradingScheme scheme;

    @Column(nullable = false, length = 8)
    private String label;

    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal points;

    @Column(name = "is_passing", nullable = false)
    private boolean passing;

    @Column(name = "counts_in_gpa", nullable = false)
    private boolean countsInGpa;

    /** Display order, best grade first. Named displayOrder in Java so it can't be confused with HQL's position(). */
    @Column(name = "position", nullable = false)
    private int displayOrder;

    protected GradeDefinition() {}

    GradeDefinition(
            GradingScheme scheme, String label, BigDecimal points, boolean passing, boolean countsInGpa, int position) {
        this.scheme = scheme;
        update(label, points, passing, countsInGpa, position);
    }

    void update(String label, BigDecimal points, boolean passing, boolean countsInGpa, int position) {
        this.label = label;
        this.points = points;
        this.passing = passing;
        this.countsInGpa = countsInGpa;
        this.displayOrder = position;
    }

    public UUID getId() {
        return id;
    }

    public GradingScheme getScheme() {
        return scheme;
    }

    public String getLabel() {
        return label;
    }

    public BigDecimal getPoints() {
        return points;
    }

    public boolean isPassing() {
        return passing;
    }

    public boolean isCountsInGpa() {
        return countsInGpa;
    }

    public int getPosition() {
        return displayOrder;
    }
}
