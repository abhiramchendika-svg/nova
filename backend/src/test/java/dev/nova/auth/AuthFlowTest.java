package dev.nova.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.IntegrationTest;
import dev.nova.user.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** End-to-end auth behaviour through the real security filter chain and a real database. */
class AuthFlowTest extends IntegrationTest {

    @Autowired
    private UserRepository users;

    private static String loginJson(String email, String password) {
        return """
                {"email":"%s","password":"%s"}""".formatted(email, password);
    }

    @Test
    void meWithoutASessionIs401ProblemDetail() throws Exception {
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void stateChangingRequestWithoutCsrfTokenIsRejected() throws Exception {
        mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(uniqueEmail("nocsrf"), PASSWORD, "No Csrf")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void registerCreatesAccountAndLogsIn() throws Exception {
        String email = uniqueEmail("Abhi").toUpperCase();

        MvcResult result = mvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email, PASSWORD, "  Abhi  ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email.toLowerCase()))
                .andExpect(jsonPath("$.displayName").value("Abhi"))
                .andExpect(jsonPath("$.onboardingCompleted").value(false))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andReturn();

        Cookie session = responseCookie(result, SESSION_COOKIE);
        assertThat(session.isHttpOnly()).as("session cookie must be HttpOnly").isTrue();

        mvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email.toLowerCase()));

        String storedHash = users.findByEmail(email.toLowerCase()).orElseThrow().getPasswordHash();
        assertThat(storedHash).startsWith("{bcrypt}").doesNotContain(PASSWORD);
    }

    @Test
    void duplicateEmailInAnyCaseIsAConflict() throws Exception {
        String email = uniqueEmail("dup");
        registerAndGetSession(email);

        mvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email.toUpperCase(), PASSWORD, "Again")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.title").value("An account with this email may already exist"));
    }

    @Test
    void registerValidatesEveryField() throws Exception {
        mvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("not-an-email", "short", "")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[?(@.field == 'email')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'password')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'displayName')]").exists());
    }

    @Test
    void loginSucceedsWithRightPasswordAndFailsGenericallyOtherwise() throws Exception {
        String email = uniqueEmail("login");
        registerAndGetSession(email);

        // Wrong password and unknown email get the identical response
        for (String[] attempt : new String[][] {{email, "wrong-password-1"}, {uniqueEmail("ghost"), PASSWORD}}) {
            mvc.perform(post("/api/v1/auth/login")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginJson(attempt[0], attempt[1])))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                    .andExpect(jsonPath("$.title").value("Invalid email or password"));
        }

        MvcResult ok = mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email.toUpperCase(), PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andReturn();
        Cookie session = responseCookie(ok, SESSION_COOKIE);
        mvc.perform(get("/api/v1/auth/me").cookie(session)).andExpect(status().isOk());
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("logout"));
        mvc.perform(get("/api/v1/auth/me").cookie(session)).andExpect(status().isOk());

        mvc.perform(post("/api/v1/auth/logout").cookie(session).with(csrf())).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/auth/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void repeatedFailedLoginsAreRateLimited() throws Exception {
        String email = uniqueEmail("brute");
        registerAndGetSession(email);

        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/login")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginJson(email, "wrong-password-" + i)))
                    .andExpect(status().isUnauthorized());
        }
        // 6th attempt inside the window is refused before the password is even checked
        mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, PASSWORD)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"));
    }
}
