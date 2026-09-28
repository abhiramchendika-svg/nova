package dev.nova;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

/**
 * Smoke test: the full application context starts against a real PostgreSQL, Flyway applies every
 * migration, and Hibernate validates all entities against the schema. Shares the cached
 * IntegrationTest context, so it adds no extra startup time.
 */
class NovaApplicationTests extends IntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertThat(context).isNotNull();
    }
}
