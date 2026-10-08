package dev.nova.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Pure unit test of the demo capacity, naming and timezone rules. */
class DemoRulesTest {

    private static final Instant NOW = Instant.parse("2026-10-07T06:00:00Z");
    private static final Duration DAY = Duration.ofHours(24);
    private static final DemoRules.Limits LIMITS = new DemoRules.Limits(DAY, 60, 300, 3);

    /** An account created {@code ago} before now expires a day after that. */
    private static Instant expiryOfOneCreated(Duration ago) {
        return NOW.minus(ago).plus(DAY);
    }

    @Test
    void underBothCapsANewAccountCanBeMadeNow() {
        var usage = new DemoRules.Usage(299, expiryOfOneCreated(Duration.ofHours(23)), 59, expiryOfOneCreated(Duration.ofMinutes(50)));
        assertThat(DemoRules.waitSeconds(usage, LIMITS, NOW)).isEmpty();
    }

    @Test
    void nothingAliveMeansNoWait() {
        assertThat(DemoRules.waitSeconds(new DemoRules.Usage(0, null, 0, null), LIMITS, NOW)).isEmpty();
    }

    @Test
    void atTheHourlyCapWaitUntilTheOldestRecentAccountIsAnHourOld() {
        // The oldest of the last hour's 60 accounts was made 50 minutes ago: 10 minutes to wait
        var usage = new DemoRules.Usage(60, expiryOfOneCreated(Duration.ofMinutes(50)), 60, expiryOfOneCreated(Duration.ofMinutes(50)));
        assertThat(DemoRules.waitSeconds(usage, LIMITS, NOW)).hasValue(600);
    }

    @Test
    void atTheAliveCapWaitUntilTheFirstAccountExpires() {
        var usage = new DemoRules.Usage(300, NOW.plusSeconds(90), 10, expiryOfOneCreated(Duration.ofMinutes(5)));
        assertThat(DemoRules.waitSeconds(usage, LIMITS, NOW)).hasValue(90);
    }

    @Test
    void atBothCapsWaitForTheLaterOfTheTwo() {
        var usage = new DemoRules.Usage(300, NOW.plusSeconds(90), 60, expiryOfOneCreated(Duration.ofMinutes(50)));
        assertThat(DemoRules.waitSeconds(usage, LIMITS, NOW)).hasValue(600);
    }

    @Test
    void theWaitIsRoundedUpAndNeverZero() {
        var almostFree = new DemoRules.Usage(300, NOW.plusMillis(1), 0, null);
        assertThat(DemoRules.waitSeconds(almostFree, LIMITS, NOW)).hasValue(1);
        var alreadyFree = new DemoRules.Usage(300, NOW, 0, null);
        assertThat(DemoRules.waitSeconds(alreadyFree, LIMITS, NOW)).hasValue(1);
    }

    @Test
    void recentAccountsAreThoseExpiringWithinTheLastHourOfTheLifetime() {
        assertThat(DemoRules.recentExpiryAfter(NOW, LIMITS)).isEqualTo(NOW.plus(Duration.ofHours(23)));
    }

    @Test
    void limitsRejectNonsense() {
        assertThatThrownBy(() -> new DemoRules.Limits(Duration.ofMinutes(30), 60, 300, 3))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DemoRules.Limits(DAY, 0, 300, 3)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DemoRules.Limits(DAY, 60, 300, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void emailsAreUniqueAndCanNeverReceiveMail() {
        UUID id = UUID.fromString("0f8e1c2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b");
        assertThat(DemoRules.email(id)).isEqualTo("demo-0f8e1c2a3b4d4e5f8a9b0c1d2e3f4a5b@demo.nova.invalid");
        assertThat(DemoRules.email(id)).hasSizeLessThanOrEqualTo(254).isLowerCase();
    }

    @Test
    void timezonesFallBackToUtcRatherThanFailing() {
        assertThat(DemoRules.zoneOrUtc("Asia/Kolkata")).isEqualTo(ZoneId.of("Asia/Kolkata"));
        assertThat(DemoRules.zoneOrUtc(" Europe/Berlin ")).isEqualTo(ZoneId.of("Europe/Berlin"));
        assertThat(DemoRules.zoneOrUtc("UTC")).isEqualTo(ZoneId.of("UTC"));
        assertThat(DemoRules.zoneOrUtc(null)).isEqualTo(ZoneOffset.UTC);
        assertThat(DemoRules.zoneOrUtc("")).isEqualTo(ZoneOffset.UTC);
        assertThat(DemoRules.zoneOrUtc("Mars/Olympus_Mons")).isEqualTo(ZoneOffset.UTC);
        assertThat(DemoRules.zoneOrUtc("+05:30")).isEqualTo(ZoneOffset.UTC); // offsets ignore daylight saving
        assertThat(DemoRules.zoneOrUtc("x".repeat(65))).isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void zoneNamesMatchWhatSettingsStores() {
        assertThat(DemoRules.zoneName(ZoneOffset.UTC)).isEqualTo("UTC");
        assertThat(DemoRules.zoneName(ZoneId.of("UTC"))).isEqualTo("UTC");
        assertThat(DemoRules.zoneName(ZoneId.of("Asia/Kolkata"))).isEqualTo("Asia/Kolkata");
    }
}
