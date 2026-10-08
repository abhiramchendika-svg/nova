package dev.nova.security;

import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Sliding-window limit on login attempts per (client IP + email): by default 5 attempts per minute.
 * Slows down password guessing without locking accounts (lockouts let anyone lock anyone out).
 * In memory, like every {@link SlidingWindowLimiter}.
 */
@Component
public class LoginRateLimiter extends SlidingWindowLimiter {

    public LoginRateLimiter(
            Clock clock,
            @Value("${nova.security.login-attempts:5}") int maxAttempts,
            @Value("${nova.security.login-window:PT1M}") Duration window) {
        super(clock, maxAttempts, window);
    }
}
