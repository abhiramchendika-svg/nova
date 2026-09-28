package dev.nova.settings;

import dev.nova.common.web.ApiException;
import dev.nova.settings.SettingsDtos.SettingsRequest;
import dev.nova.settings.SettingsDtos.SettingsResponse;
import dev.nova.user.UserSettings;
import dev.nova.user.UserSettingsRepository;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    private final UserSettingsRepository settings;
    private final Clock clock;

    public SettingsService(UserSettingsRepository settings, Clock clock) {
        this.settings = settings;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public SettingsResponse get(UUID userId) {
        return SettingsResponse.from(load(userId));
    }

    /**
     * Replaces the editable settings. The timezone must be a real IANA zone (e.g. "Asia/Kolkata"),
     * because every "today" and "due tomorrow" in NOVA is computed in it.
     */
    @Transactional
    public SettingsResponse update(UUID userId, SettingsRequest request) {
        String zone = request.timezone().strip();
        if (!isValidZone(zone)) {
            throw ApiException.invalidField("timezone", "Unknown timezone. Use a name like Asia/Kolkata.");
        }
        UserSettings s = load(userId);
        s.setTimezone(zone);
        s.setWeekStart(request.weekStart());
        s.setUniversityName(blankToNull(request.universityName()));
        s.setDefaultAttendanceTarget(request.defaultAttendanceTarget());
        s.setTheme(request.theme());
        return SettingsResponse.from(s); // saved on commit: the entity is managed inside this transaction
    }

    @Transactional
    public SettingsResponse completeOnboarding(UUID userId) {
        UserSettings s = load(userId);
        s.completeOnboarding(clock.instant());
        return SettingsResponse.from(s);
    }

    static boolean isValidZone(String zone) {
        try {
            ZoneId.of(zone);
            // Region ids only: offsets like "+05:30" don't follow daylight-saving rules
            return zone.contains("/") || zone.equals("UTC");
        } catch (DateTimeException e) {
            return false;
        }
    }

    private UserSettings load(UUID userId) {
        return settings.findById(userId).orElseThrow(ApiException::notFound);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
