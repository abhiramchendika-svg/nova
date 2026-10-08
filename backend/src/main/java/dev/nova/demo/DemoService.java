package dev.nova.demo;

import dev.nova.common.web.ApiException;
import dev.nova.notification.NotificationGenerator;
import dev.nova.security.SlidingWindowLimiter;
import dev.nova.user.User;
import dev.nova.user.UserRepository;
import dev.nova.user.UserSettings;
import dev.nova.user.UserSettingsRepository;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.OptionalLong;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Try the demo": a temporary account filled with fictional data, deleted by {@link DemoCleanup}
 * once it expires. Nobody can log in to one again: its password is random and never kept, so the
 * account lives only as long as the browser session that created it.
 */
@Service
public class DemoService {

    private static final Logger log = LoggerFactory.getLogger(DemoService.class);
    private static final BigDecimal ATTENDANCE_TARGET = new BigDecimal("75");

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final DemoStore store;
    private final DemoSeeder seeder;
    private final NotificationGenerator notifications;
    private final Clock clock;
    private final boolean enabled;
    private final DemoRules.Limits limits;
    private final SlidingWindowLimiter perIp;
    private final String unusablePasswordHash;

    public DemoService(
            UserRepository users,
            UserSettingsRepository settings,
            DemoStore store,
            DemoSeeder seeder,
            NotificationGenerator notifications,
            PasswordEncoder passwordEncoder,
            Clock clock,
            @Value("${nova.demo.enabled:true}") boolean enabled,
            @Value("${nova.demo.lifetime:PT24H}") Duration lifetime,
            @Value("${nova.demo.per-hour:60}") int perHour,
            @Value("${nova.demo.max-alive:300}") int maxAlive,
            @Value("${nova.demo.per-ip-per-hour:3}") int perIpPerHour) {
        this.users = users;
        this.settings = settings;
        this.store = store;
        this.seeder = seeder;
        this.notifications = notifications;
        this.clock = clock;
        this.enabled = enabled;
        this.limits = new DemoRules.Limits(lifetime, perHour, maxAlive, perIpPerHour);
        this.perIp = new SlidingWindowLimiter(clock, perIpPerHour, DemoRules.CREATION_WINDOW);
        // One hash of a secret that is thrown away at once: it can never match any password, and
        // hashing it once at start-up keeps a slow BCrypt round off every demo sign-up.
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        this.unusablePasswordHash = passwordEncoder.encode(Base64.getEncoder().encodeToString(secret));
    }

    /**
     * Creates and seeds a demo account. Throws 404 when demos are switched off, and 429 (with the
     * seconds to wait) when this client or everyone together is over the limit.
     */
    @Transactional
    public User start(String timezone, String clientIp) {
        if (!enabled) {
            throw ApiException.notFound();
        }
        perIp.checkAndRecord(clientIp);

        Instant now = clock.instant();
        store.lockCreation();
        DemoRules.Usage usage = store.usage(now, DemoRules.recentExpiryAfter(now, limits));
        OptionalLong wait = DemoRules.waitSeconds(usage, limits, now);
        if (wait.isPresent()) {
            log.info("Demo: at capacity ({} alive, {} in the last hour)", usage.alive(), usage.recent());
            throw ApiException.tooManyRequests(wait.getAsLong());
        }

        ZoneId zone = DemoRules.zoneOrUtc(timezone);
        User user = users.save(User.demo(
                DemoRules.email(UUID.randomUUID()),
                unusablePasswordHash,
                DemoRules.DISPLAY_NAME,
                now.plus(limits.lifetime())));
        UserSettings s = new UserSettings(user);
        s.setTimezone(DemoRules.zoneName(zone));
        s.setDefaultAttendanceTarget(ATTENDANCE_TARGET);
        s.completeOnboarding(now);
        settings.saveAndFlush(s);

        seeder.seed(user.getId(), now, zone);
        notifications.generateFor(user.getId()); // so the bell isn't empty until the next hourly run
        return user;
    }

    /** Forgets clients with no recent demo sign-ups (called by the clean-up job). */
    public void purgeLimiter() {
        perIp.purge();
    }
}
