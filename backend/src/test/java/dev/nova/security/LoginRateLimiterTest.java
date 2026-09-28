package dev.nova.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.nova.common.web.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Pure unit test with a controllable clock: no Spring, no waiting. */
class LoginRateLimiterTest {

    /** A clock the test can move forward. */
    static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-09-28T04:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private MutableClock clock;
    private LoginRateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new LoginRateLimiter(clock, 5, Duration.ofMinutes(1));
    }

    @Test
    void allowsUpToTheLimitThenBlocksWithRetryAfter() {
        for (int i = 0; i < 5; i++) {
            limiter.checkAndRecord("ip|a@x.com");
            clock.advance(Duration.ofSeconds(1));
        }
        // First attempt was at t=0; it expires at t=60. Now t=5 → wait 55 s.
        assertThatThrownBy(() -> limiter.checkAndRecord("ip|a@x.com"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("RATE_LIMITED");
                    assertThat(e.getRetryAfterSeconds()).isEqualTo(55);
                });
    }

    @Test
    void windowSlides() {
        for (int i = 0; i < 5; i++) {
            limiter.checkAndRecord("k");
        }
        clock.advance(Duration.ofSeconds(60)); // all five attempts are now exactly one window old
        assertThatCode(() -> limiter.checkAndRecord("k")).doesNotThrowAnyException();
    }

    @Test
    void keysAreIndependent() {
        for (int i = 0; i < 5; i++) {
            limiter.checkAndRecord("ip|a@x.com");
        }
        assertThatCode(() -> limiter.checkAndRecord("ip|b@x.com")).doesNotThrowAnyException();
    }

    @Test
    void resetClearsTheCounter() {
        for (int i = 0; i < 5; i++) {
            limiter.checkAndRecord("k");
        }
        limiter.reset("k");
        assertThatCode(() -> limiter.checkAndRecord("k")).doesNotThrowAnyException();
    }

    @Test
    void retryAfterIsNeverZero() {
        for (int i = 0; i < 5; i++) {
            limiter.checkAndRecord("k");
        }
        clock.advance(Duration.ofMillis(59_999)); // 1 ms left in the window
        assertThatThrownBy(() -> limiter.checkAndRecord("k"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getRetryAfterSeconds()).isEqualTo(1));
    }
}
