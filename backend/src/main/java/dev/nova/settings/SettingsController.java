package dev.nova.settings;

import dev.nova.security.NovaUserDetails;
import dev.nova.settings.SettingsDtos.SettingsRequest;
import dev.nova.settings.SettingsDtos.SettingsResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The logged-in user's own settings. The user id always comes from the session, never the URL. */
@RestController
@RequestMapping("/api/v1/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public SettingsResponse get(@AuthenticationPrincipal NovaUserDetails me) {
        return settingsService.get(me.id());
    }

    @PutMapping
    public SettingsResponse update(@AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody SettingsRequest body) {
        return settingsService.update(me.id(), body);
    }

    @PostMapping("/onboarding/complete")
    public SettingsResponse completeOnboarding(@AuthenticationPrincipal NovaUserDetails me) {
        return settingsService.completeOnboarding(me.id());
    }
}
