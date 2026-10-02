package dev.nova.developer.github;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import dev.nova.developer.github.FakeGitHubClient.User;
import dev.nova.developer.github.GitHubClient.Calendar;
import dev.nova.developer.github.GitHubClient.DayCount;
import dev.nova.developer.github.GitHubClient.Outcome;
import dev.nova.developer.github.GitHubClient.ProfileData;
import dev.nova.developer.github.GitHubClient.RepoData;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** GitHub in public mode end to end, against the in-memory GitHub (never the real one). */
class GitHubFlowTest extends AcademicsTestSupport {

    private static final String BASE = "/api/v1/github";
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    @Autowired
    private GitHubClient client;

    private FakeGitHubClient github() {
        return (FakeGitHubClient) client;
    }

    /** A GitHub user only this test knows about. */
    private String someone() {
        String login = "Octo-" + UUID.randomUUID().toString().substring(0, 8);
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        github().put(new User(
                new ProfileData(42, login, "Octo Student", "https://avatars.example.com/u/42",
                        "https://github.com/" + login, 3, 7, 2, Instant.parse("2024-01-15T10:00:00Z")),
                List.of(
                        new RepoData("bus-tracker", login + "/bus-tracker", "https://github.com/" + login + "/bus-tracker",
                                "Live campus buses", "Java", 5, 1, false, false, now.minus(1, ChronoUnit.HOURS)),
                        new RepoData("dotfiles", login + "/dotfiles", "https://github.com/" + login + "/dotfiles",
                                null, "Shell", 0, 0, false, false, now.minus(30, ChronoUnit.DAYS)),
                        new RepoData("spring-boot", login + "/spring-boot", "https://github.com/" + login + "/spring-boot",
                                "A fork", "Java", 0, 0, true, false, now.minus(90, ChronoUnit.DAYS))),
                new Calendar(5, List.of(new DayCount(TODAY.minusDays(1), 2), new DayCount(TODAY, 3)))));
        return login;
    }

    private String connect(Cookie session, String login) throws Exception {
        putJson(session, BASE + "/account", "{\"username\":\"  %s \"}".formatted(login.toLowerCase()))
                .andExpect(status().isOk());
        return login;
    }

    @Test
    void startsDisconnected() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("gh-none"));
        mvc.perform(get(BASE + "/overview").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(false))
                .andExpect(jsonPath("$.profile").doesNotExist());
        postJson(session, BASE + "/refresh", "{}").andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/dashboard").cookie(session)).andExpect(jsonPath("$.developer.github").doesNotExist());
    }

    @Test
    void connectsAndShowsWhatGitHubSaysPlusNovasOwnNumbers() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("gh-connect"));
        String login = someone();

        putJson(session, BASE + "/account", "{\"username\":\" %s \"}".formatted(login.toLowerCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.source").value("GITHUB_API"))
                .andExpect(jsonPath("$.stale").value(false))
                // GitHub's spelling of the login, not what was typed
                .andExpect(jsonPath("$.username").value(login))
                .andExpect(jsonPath("$.profile.publicRepos").value(3))
                .andExpect(jsonPath("$.profile.followers").value(7))
                .andExpect(jsonPath("$.repos[*].name", contains("bus-tracker", "dotfiles", "spring-boot")))
                .andExpect(jsonPath("$.repos[0].stars").value(5))
                // Forks are left out of the language shares
                .andExpect(jsonPath("$.languages.shares[*].language", contains("Java", "Shell")))
                .andExpect(jsonPath("$.languages.shares[0].share").value(50.0))
                .andExpect(jsonPath("$.contributions.available").value(true))
                .andExpect(jsonPath("$.contributions.total").value(5))
                .andExpect(jsonPath("$.contributions.days", hasSize(2)))
                .andExpect(jsonPath("$.novaMetrics.currentStreak.value").value(2))
                .andExpect(jsonPath("$.novaMetrics.thisMonth.formula").exists());

        // Fresh data is served from NOVA's copy without asking GitHub again
        int calls = github().calls(login);
        mvc.perform(get(BASE + "/overview").cookie(session))
                .andExpect(jsonPath("$.username").value(login))
                .andExpect(jsonPath("$.stale").value(false));
        org.assertj.core.api.Assertions.assertThat(github().calls(login)).isEqualTo(calls);

        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(jsonPath("$.developer.github.username").value(login))
                .andExpect(jsonPath("$.developer.github.contributionsThisMonth").value(greaterThanOrEqualTo(3)))
                .andExpect(jsonPath("$.developer.github.lastPushRepo").value("bus-tracker"));
    }

    @Test
    void checksTheUsernameFirst() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("gh-invalid"));
        putJson(session, BASE + "/account", "{\"username\":\"not a username\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("username"));
        putJson(session, BASE + "/account", "{\"username\":\"-dash\"}").andExpect(status().isBadRequest());
        putJson(session, BASE + "/account", "{\"username\":\"nobody-%s\"}".formatted(UUID.randomUUID().toString().substring(0, 6)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("We couldn’t find that GitHub user."));

        String down = someone();
        github().fail(down, Outcome.UNAVAILABLE, null);
        putJson(session, BASE + "/account", "{\"username\":\"%s\"}".formatted(down))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("UPSTREAM_UNAVAILABLE"));
        mvc.perform(get(BASE + "/overview").cookie(session)).andExpect(jsonPath("$.connected").value(false));
    }

    @Test
    void keepsTheSavedCopyWhenGitHubIsRateLimitedAndThrottlesRefreshes() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("gh-stale"));
        String login = connect(session, someone());

        Instant reset = Instant.now().plus(30, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.SECONDS);
        github().fail(login, Outcome.RATE_LIMITED, reset);
        postJson(session, BASE + "/refresh", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stale").value(true))
                .andExpect(jsonPath("$.retryAt").value(reset.toString()))
                // What NOVA already had is still there, not zeros
                .andExpect(jsonPath("$.repos", hasSize(3)))
                .andExpect(jsonPath("$.contributions.total").value(5));

        github().recover(login);
        postJson(session, BASE + "/refresh", "{}")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void disconnectsAndForgetsEverything() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("gh-disconnect"));
        connect(session, someone());

        deleteAs(session, BASE + "/account").andExpect(status().isNoContent());
        mvc.perform(get(BASE + "/overview").cookie(session)).andExpect(jsonPath("$.connected").value(false));
        mvc.perform(get("/api/v1/dashboard").cookie(session)).andExpect(jsonPath("$.developer.github").doesNotExist());
    }

    @Test
    void eachUserHasTheirOwn() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("gh-owner"));
        String login = connect(owner, someone());
        Cookie other = registerAndGetSession(uniqueEmail("gh-other"));
        mvc.perform(get(BASE + "/overview").cookie(other)).andExpect(jsonPath("$.connected").value(false));
        deleteAs(other, BASE + "/account").andExpect(status().isNoContent());
        mvc.perform(get(BASE + "/overview").cookie(owner)).andExpect(jsonPath("$.username").value(login));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(BASE + "/overview")).andExpect(status().isUnauthorized());
    }
}
