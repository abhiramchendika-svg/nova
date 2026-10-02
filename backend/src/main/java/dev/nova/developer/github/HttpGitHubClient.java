package dev.nova.developer.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * {@link GitHubClient} over GitHub's REST and GraphQL APIs. Without a server token it still reads
 * public profiles and repositories (GitHub's unauthenticated limit, 60 requests an hour per IP);
 * the contribution calendar needs GraphQL, which always needs a token ({@code GITHUB_SERVER_TOKEN}).
 * Profiles and repositories use conditional requests (ETags), so an unchanged answer costs nothing.
 */
@Component
public class HttpGitHubClient implements GitHubClient {

    /** Repositories are read 100 at a time, up to this many pages. */
    static final int MAX_REPO_PAGES = 3;
    static final int PAGE_SIZE = 100;
    /** When GitHub says "slow down" without saying until when. */
    static final long DEFAULT_BACKOFF_SECONDS = 60;

    private static final String CALENDAR_QUERY = """
            query($login: String!, $from: DateTime!, $to: DateTime!) {
              user(login: $login) {
                contributionsCollection(from: $from, to: $to) {
                  contributionCalendar {
                    totalContributions
                    weeks { contributionDays { date contributionCount } }
                  }
                }
              }
            }""";

    private final RestClient rest;
    private final boolean hasToken;

    @Autowired
    public HttpGitHubClient(
            @Value("${nova.github.api-url:https://api.github.com}") String apiUrl,
            @Value("${nova.github.server-token:}") String token) {
        this(RestClient.builder(), apiUrl, token);
    }

    /** For tests: the builder can be bound to a mock server. */
    HttpGitHubClient(RestClient.Builder builder, String apiUrl, String token) {
        String trimmed = token == null ? "" : token.strip();
        this.hasToken = !trimmed.isEmpty();
        builder.baseUrl(apiUrl)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                .defaultHeader(HttpHeaders.USER_AGENT, "NOVA-Student-Developer-OS");
        if (hasToken) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + trimmed);
        }
        this.rest = builder.build();
    }

    @Override
    public boolean canFetchContributions() {
        return hasToken;
    }

    @Override
    public Fetch<ProfileData> profile(String username, String etag) {
        try {
            return rest.get()
                    .uri("/users/{username}", username)
                    .headers(h -> {
                        if (etag != null) {
                            h.setIfNoneMatch(etag);
                        }
                    })
                    .exchange((request, response) -> {
                        Fetch<ProfileData> problem = problem(response, true);
                        if (problem != null) {
                            return problem;
                        }
                        UserJson user = response.bodyTo(UserJson.class);
                        if (user == null || user.login() == null) {
                            return Fetch.of(Outcome.UNAVAILABLE);
                        }
                        return Fetch.ok(user.toData(), response.getHeaders().getETag());
                    });
        } catch (RestClientException | IllegalArgumentException e) {
            return Fetch.of(Outcome.UNAVAILABLE);
        }
    }

    @Override
    public Fetch<List<RepoData>> repos(String username, String etag) {
        List<RepoData> all = new ArrayList<>();
        String firstEtag = null;
        try {
            for (int page = 1; page <= MAX_REPO_PAGES; page++) {
                int current = page;
                Fetch<List<RepoData>> fetched = rest.get()
                        .uri("/users/{username}/repos?type=owner&sort=pushed&per_page={size}&page={page}",
                                username, PAGE_SIZE, current)
                        .headers(h -> {
                            if (current == 1 && etag != null) {
                                h.setIfNoneMatch(etag);
                            }
                        })
                        .exchange((request, response) -> {
                            Fetch<List<RepoData>> problem = problem(response, true);
                            if (problem != null) {
                                return problem;
                            }
                            RepoJson[] body = response.bodyTo(RepoJson[].class);
                            if (body == null) {
                                return Fetch.of(Outcome.UNAVAILABLE);
                            }
                            List<RepoData> repos = new ArrayList<>();
                            for (RepoJson r : body) {
                                repos.add(r.toData());
                            }
                            return Fetch.ok(repos, response.getHeaders().getETag());
                        });
                if (fetched.outcome() != Outcome.OK) {
                    return fetched;
                }
                if (page == 1) {
                    firstEtag = fetched.etag();
                }
                all.addAll(fetched.data());
                if (fetched.data().size() < PAGE_SIZE) {
                    break;
                }
            }
            return Fetch.ok(List.copyOf(all), firstEtag);
        } catch (RestClientException | IllegalArgumentException e) {
            return Fetch.of(Outcome.UNAVAILABLE);
        }
    }

    @Override
    public Fetch<Calendar> contributions(String username, LocalDate from, LocalDate to) {
        if (!hasToken) {
            return Fetch.of(Outcome.NOT_CONFIGURED);
        }
        Map<String, Object> body = Map.of(
                "query", CALENDAR_QUERY,
                "variables", Map.of(
                        "login", username,
                        "from", from.atStartOfDay(ZoneOffset.UTC).toInstant().toString(),
                        "to", to.atTime(23, 59, 59).toInstant(ZoneOffset.UTC).toString()));
        try {
            return rest.post()
                    .uri("/graphql")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .exchange((request, response) -> {
                        Fetch<Calendar> problem = problem(response, false);
                        if (problem != null) {
                            return problem;
                        }
                        GraphResponse graph = response.bodyTo(GraphResponse.class);
                        if (graph == null || graph.data() == null) {
                            return Fetch.of(Outcome.UNAVAILABLE);
                        }
                        if (graph.data().user() == null) {
                            return Fetch.of(Outcome.NOT_FOUND);
                        }
                        CalendarJson calendar = graph.data().user().contributionsCollection().contributionCalendar();
                        List<DayCount> days = new ArrayList<>();
                        for (WeekJson week : calendar.weeks()) {
                            for (DayJson day : week.contributionDays()) {
                                days.add(new DayCount(LocalDate.parse(day.date()), day.contributionCount()));
                            }
                        }
                        return Fetch.ok(new Calendar(calendar.totalContributions(), List.copyOf(days)), null);
                    });
        } catch (RestClientException | IllegalArgumentException | NullPointerException e) {
            return Fetch.of(Outcome.UNAVAILABLE);
        }
    }

    /**
     * Everything that isn't a usable 200: 304, 404 (REST only), rate limits (403/429 with the
     * limit used up, or a Retry-After), and any other status. Null means "go ahead and read".
     */
    static <T> Fetch<T> problem(ClientHttpResponse response, boolean rest) throws java.io.IOException {
        int status = response.getStatusCode().value();
        if (status == 304) {
            return Fetch.of(Outcome.NOT_MODIFIED);
        }
        if (rest && status == 404) {
            return Fetch.of(Outcome.NOT_FOUND);
        }
        HttpHeaders headers = response.getHeaders();
        if (status == 403 || status == 429) {
            String remaining = headers.getFirst("x-ratelimit-remaining");
            String reset = headers.getFirst("x-ratelimit-reset");
            String retryAfter = headers.getFirst(HttpHeaders.RETRY_AFTER);
            if ("0".equals(remaining) && reset != null) {
                return Fetch.rateLimited(Instant.ofEpochSecond(Long.parseLong(reset.strip())));
            }
            if (retryAfter != null) {
                return Fetch.rateLimited(Instant.now().plusSeconds(Long.parseLong(retryAfter.strip())));
            }
            if (status == 429) {
                return Fetch.rateLimited(Instant.now().plusSeconds(DEFAULT_BACKOFF_SECONDS));
            }
        }
        if (status != 200) {
            return Fetch.of(Outcome.UNAVAILABLE);
        }
        return null;
    }

    // ───────────── GitHub's JSON, only the fields NOVA keeps ─────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UserJson(
            long id,
            String login,
            String name,
            @JsonProperty("avatar_url") String avatarUrl,
            @JsonProperty("html_url") String htmlUrl,
            @JsonProperty("public_repos") int publicRepos,
            int followers,
            int following,
            @JsonProperty("created_at") String createdAt) {

        ProfileData toData() {
            return new ProfileData(id, login, name, avatarUrl, htmlUrl, publicRepos, followers, following,
                    createdAt == null ? null : Instant.parse(createdAt));
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RepoJson(
            String name,
            @JsonProperty("full_name") String fullName,
            @JsonProperty("html_url") String htmlUrl,
            String description,
            String language,
            @JsonProperty("stargazers_count") int stars,
            @JsonProperty("forks_count") int forks,
            boolean fork,
            boolean archived,
            @JsonProperty("pushed_at") String pushedAt) {

        RepoData toData() {
            return new RepoData(name, fullName, htmlUrl, description, language, stars, forks, fork, archived,
                    pushedAt == null ? null : Instant.parse(pushedAt));
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GraphResponse(GraphData data) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GraphData(GraphUser user) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GraphUser(CollectionJson contributionsCollection) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CollectionJson(CalendarJson contributionCalendar) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CalendarJson(int totalContributions, List<WeekJson> weeks) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record WeekJson(List<DayJson> contributionDays) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record DayJson(String date, int contributionCount) {}
}
