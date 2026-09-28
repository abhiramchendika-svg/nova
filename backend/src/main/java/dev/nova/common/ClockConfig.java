package dev.nova.common;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * One injectable clock for the whole app. Code that asks "what time is it?" takes a Clock
 * instead of calling Instant.now(), so tests can fix the time and stay deterministic.
 */
@Configuration(proxyBeanMethods = false)
public class ClockConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
