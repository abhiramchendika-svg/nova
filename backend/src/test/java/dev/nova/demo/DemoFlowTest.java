package dev.nova.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import dev.nova.IntegrationTest;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

/**
 * "Try the demo" end to end: the account, its session, the seeded data seen through the real API,
 * and clean-up after expiry. Limits are raised for the shared test context (see IntegrationTest);
 * DemoLimitsTest checks them in a context of its own.
 */
class DemoFlowTest extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    DemoCleanup cleanup;

    @Autowired
    DemoStore store;

    private MvcResult startDemo(String body) throws Exception {
        var request = post("/api/v1/demo").with(csrf());
        if (body != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request).andExpect(status().isCreated()).andReturn();
    }

    private static String json(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }

    @Test
    void startsALoggedInDemoAccountThatExpiresInADay() throws Exception {
        Instant before = Instant.now();
        MvcResult result = startDemo("""
                {"timezone":"Asia/Kolkata"}""");
        Cookie session = responseCookie(result, SESSION_COOKIE);

        String body = json(result);
        assertThat((String) JsonPath.read(body, "$.email")).endsWith("@demo.nova.invalid");
        assertThat((String) JsonPath.read(body, "$.displayName")).isEqualTo("Demo Student");
        assertThat((Boolean) JsonPath.read(body, "$.onboardingCompleted")).isTrue();
        Instant expires = Instant.parse(JsonPath.read(body, "$.demoExpiresAt"));
        assertThat(Duration.between(before, expires)).isBetween(Duration.ofHours(24), Duration.ofHours(24).plusMinutes(5));

        // The browser is logged in: /me answers with the same account and expiry
        mvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value((String) JsonPath.read(body, "$.email")))
                .andExpect(jsonPath("$.demoExpiresAt").value((String) JsonPath.read(body, "$.demoExpiresAt")));

        // Settings follow the visitor's timezone, with the 75% target the attendance story needs
        mvc.perform(get("/api/v1/settings").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("Asia/Kolkata"))
                .andExpect(jsonPath("$.defaultAttendanceTarget").value(75));
    }

    @Test
    void seedsFictionalDataThatTheRealApiServes() throws Exception {
        Cookie session = responseCookie(startDemo(null), SESSION_COOKIE);

        mvc.perform(get("/api/v1/semesters").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.current == true)].name").value(List.of("Semester 3")));

        // Final grades of semesters 1 and 2: (8·4 + 10·4 + 7·3 + 9·4 + 10·4 + 8·3) / 22 = 193 / 22 = 8.77
        mvc.perform(get("/api/v1/grades/summary").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cgpa").value(8.77));

        mvc.perform(get("/api/v1/projects").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mvc.perform(get("/api/v1/internships").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(3));

        mvc.perform(get("/api/v1/hackathons").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // No GitHub data is ever made up: the demo starts unconnected
        mvc.perform(get("/api/v1/github/overview").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(false));

        // The generator ran once at sign-up: at least the two attendance warnings are waiting
        String count = mvc.perform(get("/api/v1/notifications/unread-count").cookie(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(((Number) JsonPath.read(count, "$.count")).intValue()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void anUnknownTimezoneFallsBackToUtc() throws Exception {
        Cookie session = responseCookie(startDemo("""
                {"timezone":"Mars/Olympus_Mons"}"""), SESSION_COOKIE);
        mvc.perform(get("/api/v1/settings").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("UTC"));
    }

    @Test
    void needsTheCsrfTokenLikeEveryOtherWrite() throws Exception {
        mvc.perform(post("/api/v1/demo")).andExpect(status().isForbidden());
    }

    @Test
    void normalAccountsHaveNoExpiry() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("normal"));
        mvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.demoExpiresAt").doesNotExist());
    }

    @Test
    void cleanupDeletesExpiredAccountsWithTheirDataAndSessions() throws Exception {
        MvcResult expiring = startDemo(null);
        Cookie expiringSession = responseCookie(expiring, SESSION_COOKIE);
        UUID expiredId = UUID.fromString(JsonPath.read(json(expiring), "$.id"));
        MvcResult staying = startDemo(null);
        Cookie stayingSession = responseCookie(staying, SESSION_COOKIE);

        List<UUID> semesters = jdbc.queryForList("select id from semesters where user_id = ?", UUID.class, expiredId);
        assertThat(semesters).hasSize(3);
        jdbc.update("update users set demo_expires_at = now() - interval '1 minute' where id = ?", expiredId);

        assertThat(cleanup.deleteExpired()).isGreaterThanOrEqualTo(1);

        assertThat(jdbc.queryForObject("select count(*) from users where id = ?", Long.class, expiredId)).isZero();
        for (UUID semesterId : semesters) {
            assertThat(jdbc.queryForObject("select count(*) from courses where semester_id = ?", Long.class, semesterId))
                    .isZero();
        }
        assertThat(jdbc.queryForObject("select count(*) from tasks where user_id = ?", Long.class, expiredId)).isZero();
        mvc.perform(get("/api/v1/auth/me").cookie(expiringSession)).andExpect(status().isUnauthorized());

        // An account that hasn't expired is untouched
        mvc.perform(get("/api/v1/auth/me").cookie(stayingSession)).andExpect(status().isOk());
    }

    @Test
    void usageCountsOnlyUnexpiredAccountsAndRecentOnes() {
        // Far in the future, so accounts made by other tests have all expired by then
        Instant later = Instant.now().truncatedTo(ChronoUnit.MILLIS).plus(Duration.ofDays(400));
        Instant soon = later.plus(Duration.ofHours(10));
        Instant recent = later.plus(Duration.ofMinutes(23 * 60 + 30));
        jdbc.update(
                "insert into users (email, password_hash, display_name, demo_expires_at) values (?, 'x', 'Demo Student', ?)",
                DemoRules.email(UUID.randomUUID()),
                OffsetDateTime.ofInstant(soon, ZoneOffset.UTC));
        jdbc.update(
                "insert into users (email, password_hash, display_name, demo_expires_at) values (?, 'x', 'Demo Student', ?)",
                DemoRules.email(UUID.randomUUID()),
                OffsetDateTime.ofInstant(recent, ZoneOffset.UTC));

        DemoRules.Usage usage = store.usage(later, later.plus(Duration.ofHours(23)));

        assertThat(usage.alive()).isEqualTo(2);
        assertThat(usage.earliestExpiry()).isEqualTo(soon);
        assertThat(usage.recent()).isEqualTo(1);
        assertThat(usage.oldestRecentExpiry()).isEqualTo(recent);
    }
}
