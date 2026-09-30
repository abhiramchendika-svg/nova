package dev.nova.user;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * "Now" and "today" for a user. Every "today", "due tomorrow" and "in N days" in NOVA is evaluated in
 * the user's saved timezone (docs/api.md §1), from one injected Clock so tests are deterministic.
 */
@Component
public class UserClock {

    private final UserSettingsRepository settings;
    private final Clock clock;

    public UserClock(UserSettingsRepository settings, Clock clock) {
        this.settings = settings;
        this.clock = clock;
    }

    public Instant now() {
        return clock.instant();
    }

    /** The user's timezone; UTC if they have no settings row (shouldn't happen after sign-up). */
    public ZoneId zoneOf(UUID userId) {
        return settings.findById(userId).map(s -> ZoneId.of(s.getTimezone())).orElse(ZoneId.of("UTC"));
    }

    public LocalDate today(UUID userId) {
        return LocalDate.ofInstant(now(), zoneOf(userId));
    }
}
