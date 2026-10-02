package dev.nova.notification;

import dev.nova.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The background jobs: every hour, create new notifications for every user (each user in their own
 * transaction, so one failure doesn't stop the rest); once a day, delete notifications read more
 * than the retention period ago. Both are safe to run on several instances at once.
 */
@Component
public class NotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationScheduler.class);
    static final int BATCH = 200;
    private static final UUID FIRST = new UUID(0, 0);

    private final UserRepository users;
    private final NotificationGenerator generator;
    private final NotificationService notifications;
    private final Clock clock;
    private final Duration retention;

    public NotificationScheduler(
            UserRepository users,
            NotificationGenerator generator,
            NotificationService notifications,
            Clock clock,
            @Value("${nova.notifications.retention:P90D}") Duration retention) {
        this.users = users;
        this.generator = generator;
        this.notifications = notifications;
        this.clock = clock;
        this.retention = retention;
    }

    /** A minute after start-up, then an hour after each run finishes. */
    @Scheduled(
            initialDelayString = "${nova.notifications.initial-delay:PT1M}",
            fixedDelayString = "${nova.notifications.interval:PT1H}")
    public void generateForEveryone() {
        long started = System.nanoTime();
        int usersSeen = 0;
        int created = 0;
        int failed = 0;
        UUID after = FIRST;
        List<UUID> batch;
        do {
            batch = users.idsAfter(after, PageRequest.ofSize(BATCH));
            for (UUID userId : batch) {
                usersSeen++;
                try {
                    created += generator.generateFor(userId);
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("Notifications failed for user {}", userId, e);
                }
            }
            if (!batch.isEmpty()) {
                after = batch.getLast();
            }
        } while (batch.size() == BATCH);
        log.info(
                "Notifications: {} created for {} users ({} failed) in {} ms",
                created,
                usersSeen,
                failed,
                (System.nanoTime() - started) / 1_000_000);
    }

    /** Daily at 03:17 UTC. Unread notifications are never deleted. */
    @Scheduled(cron = "${nova.notifications.cleanup-cron:0 17 3 * * *}", zone = "UTC")
    public void deleteOldRead() {
        int deleted = notifications.deleteReadBefore(clock.instant().minus(retention));
        log.info("Notifications: deleted {} read more than {} ago", deleted, retention);
    }
}
