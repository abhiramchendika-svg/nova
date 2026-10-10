package dev.nova.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.IntegrationTest;
import dev.nova.security.ProxyGuardFilter;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Starts the application with the production profile (as Render does), so a setting in
 * application-prod.yml that can't be bound fails here instead of on deploy. Its own context and database.
 */
@ActiveProfiles("prod")
class ProdProfileTest extends IntegrationTest {

    private static final String SECRET = "test-proxy-secret-0123456789-abcdefghij";

    @DynamicPropertySource
    static void proxySecret(DynamicPropertyRegistry registry) {
        registry.add("nova.proxy.secret", () -> SECRET);
    }

    @Test
    void startsAndOnlyAnswersTheApiThroughTheProxy() throws Exception {
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/auth/me").header(ProxyGuardFilter.HEADER, SECRET))
                .andExpect(status().isUnauthorized());
    }
}
