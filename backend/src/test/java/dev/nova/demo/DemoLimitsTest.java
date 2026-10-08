package dev.nova.demo;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.ResultActions;

/**
 * The demo limits through the real endpoint. Its own low limits mean its own Spring context (and
 * database), so nothing else counts towards them. One test on purpose: the steps share the counts.
 */
class DemoLimitsTest extends IntegrationTest {

    /** Dynamic properties outrank everything else, including IntegrationTest's raised limits. */
    @DynamicPropertySource
    static void lowLimits(DynamicPropertyRegistry registry) {
        registry.add("nova.demo.per-ip-per-hour", () -> 2);
        registry.add("nova.demo.per-hour", () -> 4);
        registry.add("nova.demo.max-alive", () -> 100);
    }

    private ResultActions startFrom(String ip) throws Exception {
        return mvc.perform(post("/api/v1/demo").with(csrf()).with(request -> {
            request.setRemoteAddr(ip);
            return request;
        }));
    }

    @Test
    void perClientThenForEveryone() throws Exception {
        startFrom("203.0.113.1").andExpect(status().isCreated());
        startFrom("203.0.113.1").andExpect(status().isCreated());

        // A third from the same client within the hour waits for the first to be an hour old
        startFrom("203.0.113.1")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"));

        // Another client is still welcome, until four were made this hour by everyone together
        startFrom("203.0.113.2").andExpect(status().isCreated());
        startFrom("203.0.113.3").andExpect(status().isCreated());
        startFrom("203.0.113.4")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.retryAfterSeconds").isNumber());
    }
}
