package dev.nova;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Base for full-stack tests: the real application (security filters, Spring Session, JPA, Flyway)
 * against PostgreSQL in Docker, driven through MockMvc. Spring caches this context, so every
 * subclass shares one container and one startup.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

    protected static final String SESSION_COOKIE = "NOVA_SESSION";
    protected static final String PASSWORD = "correct-horse-battery";

    @Autowired
    protected MockMvc mvc;

    /** Unique per call, so tests never collide on the shared database. */
    protected static String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    protected static String registerJson(String email, String password, String displayName) {
        return """
                {"email":"%s","password":"%s","displayName":"%s"}""".formatted(email, password, displayName);
    }

    /** Registers a user and returns the session cookie that logs them in. */
    protected Cookie registerAndGetSession(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email, PASSWORD, "Test Student")))
                .andExpect(status().isCreated())
                .andReturn();
        return responseCookie(result, SESSION_COOKIE);
    }

    /**
     * Finds a cookie the response set. Session and CSRF cookies are written as raw Set-Cookie
     * headers, so read those directly if MockMvc didn't expose them as Cookie objects. On failure the
     * message lists every Set-Cookie header, which shows exactly what the server sent.
     */
    protected static Cookie responseCookie(MvcResult result, String name) {
        MockHttpServletResponse response = result.getResponse();
        Cookie direct = response.getCookie(name);
        if (direct != null) {
            return direct;
        }
        List<String> setCookies = response.getHeaders(HttpHeaders.SET_COOKIE);
        for (String header : setCookies) {
            if (header.startsWith(name + "=")) {
                int end = header.indexOf(';');
                Cookie cookie = new Cookie(name, header.substring(name.length() + 1, end < 0 ? header.length() : end));
                cookie.setHttpOnly(header.toLowerCase(Locale.ROOT).contains("httponly"));
                return cookie;
            }
        }
        throw new AssertionError("No " + name + " cookie in response (status " + response.getStatus()
                + "). Set-Cookie headers: " + setCookies + ". Header names: " + response.getHeaderNames());
    }
}
