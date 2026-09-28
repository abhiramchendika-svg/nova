package dev.nova.security;

import dev.nova.common.web.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Sliding-window limit on login attempts per (client IP + email): by default 5 attempts per minute.
 * Slows down password guessing without locking accounts (lockouts let anyone lock anyone out).
 *
 * Kept in memory on purpose: NOVA runs as a single instance. With several instances this state
 * would move to a shared store (e.g. Redis or a table).
 */
@Component
public class LoginRateLimiter {

    private final Clock clock;
    private final int maxAttempts;
    private final Duration window;
    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    public LoginRateLimiter(
            Clock clock,
            @Value("${nova.security.login-attempts:5}") int maxAttempts,
            @Value("${nova.security.login-window:PT1M}") Duration window) {
        this.clock = clock;
        this.maxAttempts = maxAttempts;
        this.window = window;
    }

    /**
     * Records an attempt for this key, or throws {@link ApiException} (429) if the key already used
     * all attempts in the current window. The exception carries how many seconds to wait.
     */
    public void checkAndRecord(String key) {
        Instant now = clock.instant();
        Instant windowStart = now.minus(window);
        Deque<Instant> recent = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (recent) {
            while (!recent.isEmpty() && !recent.peekFirst().isAfter(windowStart)) {
                recent.pollFirst();
            }
            if (recent.size() >= maxAttempts) {
                Instant freesUpAt = recent.peekFirst().plus(window);
                long millis = Duration.between(now, freesUpAt).toMillis();
                long seconds = Math.max(1, (millis + 999) / 1000); // round up; never "retry in 0 s"
                throw ApiException.tooManyRequests(seconds);
            }
            recent.addLast(now);
        }
    }

    /** A successful login clears the counter, so a typo or two doesn't linger. */
    public void reset(String key) {
        attempts.remove(key);
    }
}
