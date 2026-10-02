package dev.nova.common;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on {@code @Scheduled} jobs (notifications). Their timing comes from {@code nova.notifications.*};
 * the full-stack tests push them out of reach so background runs never race with a test's own calls.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
public class SchedulingConfig {}
