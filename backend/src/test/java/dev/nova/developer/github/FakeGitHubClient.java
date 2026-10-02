package dev.nova.developer.github;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * An in-memory GitHub for full-stack tests. Users are keyed by lower-cased login, so tests that run
 * in parallel on the shared context don't see each other's data. A user can be made to fail with a
 * chosen outcome to test stale data and rate limits.
 */
public class FakeGitHubClient implements GitHubClient {

    public record User(ProfileData profile, List<RepoData> repos, Calendar calendar) {}

    private final Map<String, User> users = new ConcurrentHashMap<>();
    private final Map<String, Fetch<?>> failures = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> calls = new ConcurrentHashMap<>();

    public void put(User user) {
        users.put(user.profile().login().toLowerCase(), user);
        failures.remove(user.profile().login().toLowerCase());
    }

    /** From now on every call for this login answers with {@code outcome}. */
    public void fail(String login, Outcome outcome, Instant retryAt) {
        failures.put(login.toLowerCase(), new Fetch<>(outcome, null, null, retryAt));
    }

    public void recover(String login) {
        failures.remove(login.toLowerCase());
    }

    public int calls(String login) {
        return calls.computeIfAbsent(login.toLowerCase(), k -> new AtomicInteger()).get();
    }

    @SuppressWarnings("unchecked")
    private <T> Fetch<T> answer(String login, java.util.function.Function<User, T> part, String etag, String currentEtag) {
        String key = login.toLowerCase();
        calls.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet();
        Fetch<?> failure = failures.get(key);
        if (failure != null) {
            return (Fetch<T>) failure;
        }
        User user = users.get(key);
        if (user == null) {
            return Fetch.of(Outcome.NOT_FOUND);
        }
        if (etag != null && etag.equals(currentEtag)) {
            return Fetch.of(Outcome.NOT_MODIFIED);
        }
        return Fetch.ok(part.apply(user), currentEtag);
    }

    private static String etag(Object value) {
        return "\"" + Integer.toHexString(value.hashCode()) + "\"";
    }

    @Override
    public Fetch<ProfileData> profile(String username, String etag) {
        User user = users.get(username.toLowerCase());
        return answer(username, User::profile, etag, user == null ? null : etag(user.profile()));
    }

    @Override
    public Fetch<List<RepoData>> repos(String username, String etag) {
        User user = users.get(username.toLowerCase());
        return answer(username, User::repos, etag, user == null ? null : etag(user.repos()));
    }

    @Override
    public Fetch<Calendar> contributions(String username, LocalDate from, LocalDate to) {
        return answer(username, User::calendar, null, null);
    }

    @Override
    public boolean canFetchContributions() {
        return true; // as if GITHUB_SERVER_TOKEN were set; the no-token path is covered by HttpGitHubClientTest
    }
}
