package dev.nova.settings;

import dev.nova.user.UserSettings;
import dev.nova.user.UserSettings.ThemePreference;
import dev.nova.user.UserSettings.WeekStart;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Bodies for /api/v1/settings (docs/api.md §2.1). */
public final class SettingsDtos {

    private SettingsDtos() {}

    /** Full replacement of the editable settings (PUT semantics). */
    public record SettingsRequest(
            @NotBlank(message = "Choose a timezone.") @Size(max = 64) String timezone,
            @NotNull(message = "Choose the first day of your week.") WeekStart weekStart,
            @Size(max = 120, message = "Keep it under 120 characters.") String universityName,
            @DecimalMin(value = "0", inclusive = false, message = "Must be more than 0.")
                    @DecimalMax(value = "100", inclusive = false, message = "Must be less than 100.")
                    @Digits(integer = 3, fraction = 2, message = "Use at most 2 decimal places.")
                    BigDecimal defaultAttendanceTarget,
            @NotNull(message = "Choose a theme.") ThemePreference theme) {}

    public record SettingsResponse(
            String timezone,
            WeekStart weekStart,
            String universityName,
            BigDecimal defaultAttendanceTarget,
            ThemePreference theme,
            boolean onboardingCompleted) {

        static SettingsResponse from(UserSettings s) {
            return new SettingsResponse(
                    s.getTimezone(),
                    s.getWeekStart(),
                    s.getUniversityName(),
                    s.getDefaultAttendanceTarget(),
                    s.getTheme(),
                    s.isOnboardingCompleted());
        }
    }
}
