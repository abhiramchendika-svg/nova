package dev.nova.developer.github;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/** Public contributions on one day, as GitHub's contribution calendar reported them. */
@Entity
@Table(name = "github_contribution_days")
public class ContributionDay {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false)
    private LocalDate day;

    @Column(nullable = false)
    private int count;

    protected ContributionDay() {}

    public ContributionDay(UUID userId, LocalDate day, int count) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.day = Objects.requireNonNull(day, "day");
        this.count = Math.max(0, count);
    }

    public LocalDate getDay() {
        return day;
    }

    public int getCount() {
        return count;
    }
}
