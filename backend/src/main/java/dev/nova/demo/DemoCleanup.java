package dev.nova.demo;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Deletes expired demo accounts, with all their data and sessions. Runs hourly. */
@Component
public class DemoCleanup {

    private static final Logger log = LoggerFactory.getLogger(DemoCleanup.class);

    private final DemoStore store;
    private final DemoService demos;
    private final Clock clock;

    public DemoCleanup(DemoStore store, DemoService demos, Clock clock) {
        this.store = store;
        this.demos = demos;
        this.clock = clock;
    }

    /** Five minutes after start-up, then an hour after each run finishes. Returns how many went. */
    @Scheduled(
            initialDelayString = "${nova.demo.cleanup-initial-delay:PT5M}",
            fixedDelayString = "${nova.demo.cleanup-interval:PT1H}")
    @Transactional
    public int deleteExpired() {
        int deleted = store.deleteExpired(clock.instant());
        demos.purgeLimiter();
        if (deleted > 0) {
            log.info("Demo: deleted {} expired accounts", deleted);
        }
        return deleted;
    }
}
