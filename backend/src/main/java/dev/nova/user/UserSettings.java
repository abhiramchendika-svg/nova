package dev.nova.user;

import dev.nova.common.persistence.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Per-user preferences, 1:1 with {@link User}. {@code @MapsId} makes the primary key the same
 * value as the user's id (shared primary key), so there is no separate id to keep in sync.
 */
@Entity
@Table(name = "user_settings")
public class UserSettings extends AuditedEntity {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 64)
    private String timezone = "UTC";

    @Enumerated(EnumType.STRING)
    @Column(name = "week_start", nullable = false, length = 3)
    private WeekStart weekStart = WeekStart.MON;

    @Column(name = "university_name", length = 120)
    private String universityName;

    /** Percentage in (0, 100); null means "not set" — NOVA never assumes a policy. */
    @Column(name = "default_attendance_target", precision = 5, scale = 2)
    private BigDecimal defaultAttendanceTarget;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private ThemePreference theme = ThemePreference.SYSTEM;

    @Column(name = "onboarding_completed_at")
    private Instant onboardingCompletedAt;

    protected UserSettings() {}

    public UserSettings(User user) {
        this.user = user;
    }

    public enum WeekStart {
        MON,
        SUN
    }

    public enum ThemePreference {
        LIGHT,
        DARK,
        SYSTEM
    }

    public boolean isOnboardingCompleted() {
        return onboardingCompletedAt != null;
    }

    public void completeOnboarding(Instant at) {
        if (onboardingCompletedAt == null) {
            onboardingCompletedAt = at;
        }
    }

    public UUID getUserId() {
        return userId;
    }

    public User getUser() {
        return user;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public WeekStart getWeekStart() {
        return weekStart;
    }

    public void setWeekStart(WeekStart weekStart) {
        this.weekStart = weekStart;
    }

    public String getUniversityName() {
        return universityName;
    }

    public void setUniversityName(String universityName) {
        this.universityName = universityName;
    }

    public BigDecimal getDefaultAttendanceTarget() {
        return defaultAttendanceTarget;
    }

    public void setDefaultAttendanceTarget(BigDecimal defaultAttendanceTarget) {
        this.defaultAttendanceTarget = defaultAttendanceTarget;
    }

    public ThemePreference getTheme() {
        return theme;
    }

    public void setTheme(ThemePreference theme) {
        this.theme = theme;
    }

    public Instant getOnboardingCompletedAt() {
        return onboardingCompletedAt;
    }
}
