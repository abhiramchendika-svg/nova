package dev.nova.health;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.IntegrationTest;
import dev.nova.common.web.RequestIdFilter;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/**
 * The health endpoint and the shared error format, exercised through the full security chain.
 * (Moved from a @WebMvcTest slice: with Spring Security on the classpath, a slice would test
 * default security rather than NOVA's SecurityConfig.)
 */
class HealthControllerTest extends IntegrationTest {

    @Test
    void healthIsPublicAndReportsVersion() throws Exception {
        mvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.version").isNotEmpty());
    }

    @Test
    void everyResponseCarriesARequestId() throws Exception {
        mvc.perform(get("/api/v1/health"))
                .andExpect(header().string(RequestIdFilter.HEADER, matchesPattern("[a-f0-9]{8}")));
    }

    @Test
    void acceptsASafeIncomingRequestIdButReplacesUnsafeOnes() throws Exception {
        mvc.perform(get("/api/v1/health").header(RequestIdFilter.HEADER, "trace-12345678"))
                .andExpect(header().string(RequestIdFilter.HEADER, "trace-12345678"));
        mvc.perform(get("/api/v1/health").header(RequestIdFilter.HEADER, "evil\nlog-line"))
                .andExpect(header().string(RequestIdFilter.HEADER, matchesPattern("[a-f0-9]{8}")));
    }

    @Test
    void unknownRouteForALoggedInUserIsANotFoundProblem() throws Exception {
        mvc.perform(get("/api/v1/does-not-exist").with(user("someone")))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void wrongMethodIsAProblemDetail() throws Exception {
        mvc.perform(post("/api/v1/health").with(user("someone")).with(csrf()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }
}
