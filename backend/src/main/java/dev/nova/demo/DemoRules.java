package dev.nova.demo;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.OptionalLong;
import java.util.UUID;

/** The pure rules behind "Try the demo": capacity, naming and timezone. No Spring, no database. */
final class DemoRules {

    /** Demo accounts live in this made-up domain: ".invalid" is reserved and can never receive mail. */
    static final String EMAIL_DOMAIN = "demo.nova.invalid";

    static final String DISPLAY_NAME = "Demo Student";

    static final Duration CREATION_WINDOW = Duration.ofHours(1);

    private DemoRules() {}

    /**
     * Caps on demo accounts. {@code perHour} and {@code maxAlive} hold for everyone together, so they
     * work even when client IPs are spoofed; {@code perIpPerHour} is a best-effort fairness limit.
     */
    record Limits(Duration lifetime, int perHour, int maxAlive, int perIpPerHour) {

        Limits {
            if (lifetime.compareTo(CREATION_WINDOW) <= 0) {
                throw new IllegalArgumentException("A demo account must live longer than an hour");
            }
            if (perHour < 1 || maxAlive < 1 || perIpPerHour < 1) {
                throw new IllegalArgumentException("Demo limits must be at least 1");
            }
        }
    }

    /**
     * Demo accounts that haven't expired yet, read under a lock. Accounts expire exactly
     * {@code lifetime} after they're created, so expiry times also tell when each one was created.
     *
     * @param alive accounts whose expiry is still ahead
     * @param earliestExpiry the soonest of those expiries (null when none)
     * @param recent accounts created in the last hour
     * @param oldestRecentExpiry the expiry of the oldest of those (null when none)
     */
    record Usage(long alive, Instant earliestExpiry, long recent, Instant oldestRecentExpiry) {}

    /** Expiries after this belong to accounts created in the last hour. */
    static Instant recentExpiryAfter(Instant now, Limits limits) {
        return now.plus(limits.lifetime()).minus(CREATION_WINDOW);
    }

    /** Seconds to wait before another demo account can be created, or empty when it can be now. */
    static OptionalLong waitSeconds(Usage usage, Limits limits, Instant now) {
        Instant freesUpAt = null;
        if (usage.alive() >= limits.maxAlive() && usage.earliestExpiry() != null) {
            freesUpAt = usage.earliestExpiry();
        }
        if (usage.recent() >= limits.perHour() && usage.oldestRecentExpiry() != null) {
            // The oldest recent account was created at expiry - lifetime; it leaves the window an hour later
            Instant leavesWindow = usage.oldestRecentExpiry().minus(limits.lifetime()).plus(CREATION_WINDOW);
            freesUpAt = freesUpAt == null || leavesWindow.isAfter(freesUpAt) ? leavesWindow : freesUpAt;
        }
        if (freesUpAt == null) {
            return OptionalLong.empty();
        }
        long millis = Duration.between(now, freesUpAt).toMillis();
        return OptionalLong.of(Math.max(1, (millis + 999) / 1000)); // round up; never "retry in 0 s"
    }

    static String email(UUID random) {
        return "demo-" + random.toString().replace("-", "") + "@" + EMAIL_DOMAIN;
    }

    /**
     * The browser's timezone when it's a real region id (as in Settings), else UTC. A demo should
     * never fail over a timezone, so a bad value is ignored rather than rejected.
     */
    static ZoneId zoneOrUtc(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 64) {
            return ZoneOffset.UTC;
        }
        String zone = raw.strip();
        try {
            ZoneId id = ZoneId.of(zone);
            return zone.contains("/") || zone.toUpperCase(Locale.ROOT).equals("UTC") ? id : ZoneOffset.UTC;
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }

    /** The timezone name to store in settings. */
    static String zoneName(ZoneId zone) {
        return zone.equals(ZoneOffset.UTC) ? "UTC" : zone.getId();
    }
}
