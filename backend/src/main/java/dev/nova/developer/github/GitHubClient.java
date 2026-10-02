package dev.nova.developer.github;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * NOVA's only way to reach GitHub (docs/architecture.md §13). Every call reports what happened
 * instead of throwing, so the service can fall back to what it already has. Tests replace it; they
 * never call the real GitHub.
 */
public interface GitHubClient {

    enum Outcome {
        /** Fresh data, with its ETag where GitHub sent one. */
        OK,
        /** The ETag still matches: what NOVA has is current. */
        NOT_MODIFIED,
        /** No such GitHub user. */
        NOT_FOUND,
        /** GitHub's rate limit is used up until {@code retryAt}. */
        RATE_LIMITED,
        /** GitHub didn't answer usefully (network, 5xx, unexpected status or body). */
        UNAVAILABLE,
        /** This call needs a token NOVA wasn't given (the contribution calendar). */
        NOT_CONFIGURED
    }

    record Fetch<T>(Outcome outcome, T data, String etag, Instant retryAt) {

        static <T> Fetch<T> ok(T data, String etag) {
            return new Fetch<>(Outcome.OK, data, etag, null);
        }

        static <T> Fetch<T> of(Outcome outcome) {
            return new Fetch<>(outcome, null, null, null);
        }

        static <T> Fetch<T> rateLimited(Instant retryAt) {
            return new Fetch<>(Outcome.RATE_LIMITED, null, null, retryAt);
        }
    }

    record ProfileData(
            long id,
            String login,
            String name,
            String avatarUrl,
            String htmlUrl,
            int publicRepos,
            int followers,
            int following,
            Instant createdAt) {}

    record RepoData(
            String name,
            String fullName,
            String htmlUrl,
            String description,
            String language,
            int stars,
            int forks,
            boolean fork,
            boolean archived,
            Instant pushedAt) {}

    record DayCount(LocalDate date, int count) {}

    record Calendar(int total, List<DayCount> days) {}

    /** The public profile; {@code etag} (may be null) makes it a conditional request. */
    Fetch<ProfileData> profile(String username, String etag);

    /** Every public repository the user owns (up to a few hundred), with the first page's ETag. */
    Fetch<List<RepoData>> repos(String username, String etag);

    /** Public contributions per day between two dates; NOT_CONFIGURED without a server token. */
    Fetch<Calendar> contributions(String username, LocalDate from, LocalDate to);

    /** Whether {@link #contributions} can work at all here. */
    boolean canFetchContributions();
}
