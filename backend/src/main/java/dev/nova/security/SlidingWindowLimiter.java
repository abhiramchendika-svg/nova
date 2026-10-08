package dev.nova.security;

import dev.nova.common.web.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * At most {@code maxAttempts} per key in any {@code window}, in memory. Used for login attempts and
 * demo sign-ups. Kept in memory on purpose: NOVA runs as a single instance. With several instances
 * this state would move to a shared store (e.g. Redis or a table).
 */
public class SlidingWindowLimiter {

    private final Clock clock;
    private final int maxAttempts;
    private final Duration window;
    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    public SlidingWindowLimiter(Clock clock, int maxAttempts, Duration window) {
        if (maxAttempts < 1) {
            throw new IllegalArgumentException("maxAttempts must be at least 1");
        }
        this.clock = clock;
        this.maxAttempts = maxAttempts;
        this.window = window;
    }

    /**
     * Records an attempt for this key, or throws {@link ApiException} (429) if the key already used
     * all attempts in the current window. The exception carries how many seconds to wait.
     */
    public void checkAndRecord(String key) {
        while (true) {
            Instant now = clock.instant();
            Deque<Instant> recent = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
            synchronized (recent) {
                if (attempts.get(key) != recent) {
                    continue; // purge() dropped this deque meanwhile: start again with the live one
                }
                dropBefore(recent, now.minus(window));
                if (recent.size() >= maxAttempts) {
                    Instant freesUpAt = recent.peekFirst().plus(window);
                    long millis = Duration.between(now, freesUpAt).toMillis();
                    long seconds = Math.max(1, (millis + 999) / 1000); // round up; never "retry in 0 s"
                    throw ApiException.tooManyRequests(seconds);
                }
                recent.addLast(now);
                return;
            }
        }
    }

    /** Forgets a key, e.g. after a successful login. */
    public void reset(String key) {
        attempts.remove(key);
    }

    /** Drops keys with no attempts left in the window, so memory doesn't grow with every client seen. */
    public void purge() {
        Instant windowStart = clock.instant().minus(window);
        attempts.forEach((key, recent) -> {
            synchronized (recent) {
                dropBefore(recent, windowStart);
                if (recent.isEmpty()) {
                    attempts.remove(key, recent);
                }
            }
        });
    }

    /** How many keys are tracked (for tests). */
    int trackedKeys() {
        return attempts.size();
    }

    private static void dropBefore(Deque<Instant> recent, Instant windowStart) {
        while (!recent.isEmpty() && !recent.peekFirst().isAfter(windowStart)) {
            recent.pollFirst();
        }
    }
}
