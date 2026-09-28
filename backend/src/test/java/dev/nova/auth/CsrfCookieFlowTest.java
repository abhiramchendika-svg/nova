package dev.nova.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MvcResult;

/**
 * The exact CSRF dance the browser does: fetch the token cookie, echo it in a header.
 *
 * Runs in its own fresh application context on purpose. Spring Security's test helper
 * {@code csrf()} (used by the other tests) permanently swaps the CSRF filter's token store for a
 * session-based test store inside the shared cached context. Tests that call it would make this
 * one see the swapped store instead of the real cookie store, so nothing here uses {@code csrf()}.
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class CsrfCookieFlowTest extends IntegrationTest {

    @Test
    void tokenCookieIsReadableAndAcceptedWhenEchoedInTheHeader() throws Exception {
        MvcResult csrfResult =
                mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isNoContent()).andReturn();
        Cookie xsrf = responseCookie(csrfResult, "XSRF-TOKEN");
        assertThat(xsrf.isHttpOnly()).as("SPA must be able to read the CSRF cookie").isFalse();
        assertThat(csrfResult.getResponse().getHeaders("Set-Cookie"))
                .as("fetching a CSRF token must not create a server session")
                .noneMatch(header -> header.startsWith(SESSION_COOKIE + "="));

        mvc.perform(post("/api/v1/auth/register")
                        .cookie(xsrf)
                        .header("X-XSRF-TOKEN", xsrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(uniqueEmail("browser"), PASSWORD, "Browser Flow")))
                .andExpect(status().isCreated());
    }

    @Test
    void aWrongTokenIsRejected() throws Exception {
        Cookie xsrf = responseCookie(
                mvc.perform(get("/api/v1/auth/csrf")).andReturn(), "XSRF-TOKEN");

        mvc.perform(post("/api/v1/auth/register")
                        .cookie(xsrf)
                        .header("X-XSRF-TOKEN", "not-the-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(uniqueEmail("forged"), PASSWORD, "Forged")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }
}
