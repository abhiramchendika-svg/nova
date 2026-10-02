package dev.nova.developer.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import dev.nova.developer.github.GitHubClient.Calendar;
import dev.nova.developer.github.GitHubClient.Fetch;
import dev.nova.developer.github.GitHubClient.Outcome;
import dev.nova.developer.github.GitHubClient.ProfileData;
import dev.nova.developer.github.GitHubClient.RepoData;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * The HTTP client against a fake GitHub (MockRestServiceServer): recorded-style JSON, ETags,
 * pagination, rate limits and errors. Nothing here reaches the real GitHub.
 */
class HttpGitHubClientTest {

    private static final String API = "https://api.github.test";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

    private HttpGitHubClient client(String token) {
        return new HttpGitHubClient(builder, API, token);
    }

    private static HttpHeaders headers(String... pairs) {
        HttpHeaders h = new HttpHeaders();
        for (int i = 0; i < pairs.length; i += 2) {
            h.set(pairs[i], pairs[i + 1]);
        }
        return h;
    }

    private static final String OCTOCAT = """
            {"login":"octocat","id":583231,"name":"The Octocat","avatar_url":"https://avatars.githubusercontent.com/u/583231",
             "html_url":"https://github.com/octocat","public_repos":8,"followers":20,"following":9,
             "created_at":"2011-01-25T18:44:36Z","site_admin":false}""";

    @Test
    void readsAProfileWithItsEtag() {
        HttpGitHubClient github = client("");
        server.expect(requestTo(API + "/users/octocat"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("User-Agent", "NOVA-Student-Developer-OS"))
                .andRespond(withSuccess(OCTOCAT, MediaType.APPLICATION_JSON).headers(headers("ETag", "\"v1\"")));

        Fetch<ProfileData> fetch = github.profile("octocat", null);

        assertThat(fetch.outcome()).isEqualTo(Outcome.OK);
        assertThat(fetch.etag()).isEqualTo("\"v1\"");
        assertThat(fetch.data().login()).isEqualTo("octocat");
        assertThat(fetch.data().publicRepos()).isEqualTo(8);
        assertThat(fetch.data().createdAt()).isEqualTo(Instant.parse("2011-01-25T18:44:36Z"));
        server.verify();
    }

    @Test
    void asksConditionallyAndUnderstandsNotModified() {
        HttpGitHubClient github = client("");
        server.expect(requestTo(API + "/users/octocat"))
                .andExpect(header("If-None-Match", "\"v1\""))
                .andRespond(withStatus(HttpStatus.NOT_MODIFIED));

        assertThat(github.profile("octocat", "\"v1\"").outcome()).isEqualTo(Outcome.NOT_MODIFIED);
        server.verify();
    }

    @Test
    void reportsAMissingUserRateLimitsAndOutages() {
        HttpGitHubClient github = client("");
        server.expect(requestTo(API + "/users/nobody")).andRespond(withStatus(HttpStatus.NOT_FOUND));
        server.expect(requestTo(API + "/users/octocat"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN)
                        .headers(headers("x-ratelimit-remaining", "0", "x-ratelimit-reset", "1790000000")));
        server.expect(requestTo(API + "/users/octocat")).andRespond(withServerError());

        assertThat(github.profile("nobody", null).outcome()).isEqualTo(Outcome.NOT_FOUND);
        Fetch<ProfileData> limited = github.profile("octocat", null);
        assertThat(limited.outcome()).isEqualTo(Outcome.RATE_LIMITED);
        assertThat(limited.retryAt()).isEqualTo(Instant.ofEpochSecond(1790000000L));
        assertThat(github.profile("octocat", null).outcome()).isEqualTo(Outcome.UNAVAILABLE);
        server.verify();
    }

    private static String repos(int from, int count) {
        return IntStream.range(from, from + count)
                .mapToObj(i -> """
                        {"name":"repo-%d","full_name":"octocat/repo-%d","html_url":"https://github.com/octocat/repo-%d",
                         "description":null,"language":"Java","stargazers_count":%d,"forks_count":0,"fork":false,
                         "archived":false,"pushed_at":"2026-09-30T10:00:00Z","owner":{"login":"octocat"}}"""
                        .formatted(i, i, i, i))
                .collect(Collectors.joining(",", "[", "]"));
    }

    @Test
    void followsPagesUntilAShortOne() {
        HttpGitHubClient github = client("");
        server.expect(requestTo(API + "/users/octocat/repos?type=owner&sort=pushed&per_page=100&page=1"))
                .andRespond(withSuccess(repos(0, 100), MediaType.APPLICATION_JSON).headers(headers("ETag", "\"r1\"")));
        server.expect(requestTo(API + "/users/octocat/repos?type=owner&sort=pushed&per_page=100&page=2"))
                .andRespond(withSuccess(repos(100, 1), MediaType.APPLICATION_JSON));

        Fetch<List<RepoData>> fetch = github.repos("octocat", null);

        assertThat(fetch.outcome()).isEqualTo(Outcome.OK);
        assertThat(fetch.data().size()).isEqualTo(101);
        assertThat(fetch.etag()).isEqualTo("\"r1\"");
        assertThat(fetch.data().get(100).fullName()).isEqualTo("octocat/repo-100");
        server.verify();
    }

    @Test
    void needsATokenForTheCalendar() {
        assertThat(client("").canFetchContributions()).isFalse();
        assertThat(client("  ").contributions("octocat", LocalDate.of(2025, 10, 3), LocalDate.of(2026, 10, 2))
                        .outcome())
                .isEqualTo(Outcome.NOT_CONFIGURED);
        server.verify(); // no request was made
    }

    @Test
    void readsTheCalendarWithAToken() {
        HttpGitHubClient github = client("test-token");
        server.expect(requestTo(API + "/graphql"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-token"))
                .andRespond(withSuccess("""
                        {"data":{"user":{"contributionsCollection":{"contributionCalendar":{"totalContributions":5,
                         "weeks":[{"contributionDays":[{"date":"2026-09-30","contributionCount":2},
                                                       {"date":"2026-10-01","contributionCount":3}]}]}}}}}""",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(API + "/graphql"))
                .andRespond(withSuccess("""
                        {"data":{"user":null},"errors":[{"type":"NOT_FOUND","message":"Could not resolve to a User"}]}""",
                        MediaType.APPLICATION_JSON));

        Fetch<Calendar> fetch = github.contributions("octocat", LocalDate.of(2025, 10, 3), LocalDate.of(2026, 10, 2));
        assertThat(fetch.outcome()).isEqualTo(Outcome.OK);
        assertThat(fetch.data().total()).isEqualTo(5);
        assertThat(fetch.data().days().size()).isEqualTo(2);
        assertThat(fetch.data().days().get(1).count()).isEqualTo(3);
        assertThat(github.contributions("nobody", LocalDate.of(2025, 10, 3), LocalDate.of(2026, 10, 2)).outcome())
                .isEqualTo(Outcome.NOT_FOUND);
        server.verify();
    }
}
