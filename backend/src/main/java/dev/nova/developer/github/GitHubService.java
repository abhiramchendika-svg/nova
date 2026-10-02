package dev.nova.developer.github;

import dev.nova.common.web.ApiException;
import dev.nova.developer.github.GitHubClient.Calendar;
import dev.nova.developer.github.GitHubClient.Fetch;
import dev.nova.developer.github.GitHubClient.Outcome;
import dev.nova.developer.github.GitHubClient.ProfileData;
import dev.nova.developer.github.GitHubClient.RepoData;
import dev.nova.developer.github.GitHubDtos.ContributionCalendar;
import dev.nova.developer.github.GitHubDtos.Day;
import dev.nova.developer.github.GitHubDtos.Languages;
import dev.nova.developer.github.GitHubDtos.OverviewResponse;
import dev.nova.developer.github.GitHubDtos.Profile;
import dev.nova.developer.github.GitHubDtos.Repo;
import dev.nova.user.UserClock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * GitHub in public (username-only) mode (docs/architecture.md §13). What GitHub returned is kept in
 * NOVA's tables and served from there; a part is fetched again only when it's older than its TTL
 * (conditionally, with its ETag), or on a throttled manual refresh. When GitHub is down or the rate
 * limit is used up, the saved copy is shown and marked stale. Calls to GitHub never run inside a
 * database transaction.
 */
@Service
public class GitHubService {

    static final Duration PROFILE_TTL = Duration.ofHours(6);
    static final Duration REPOS_TTL = Duration.ofHours(6);
    static final Duration CONTRIBUTIONS_TTL = Duration.ofHours(1);
    static final Duration REFRESH_EVERY = Duration.ofMinutes(5);
    /** GitHub's calendar covers at most a year; NOVA asks for the 365 days ending today. */
    static final int CALENDAR_DAYS = 365;

    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$");
    private static final String NO_TOKEN =
            "The contribution calendar needs a GitHub token on the server (GITHUB_SERVER_TOKEN).";

    private final GitHubClient client;
    private final GitHubAccountRepository accounts;
    private final GitHubRepoRepository repos;
    private final ContributionDayRepository days;
    private final UserClock userClock;
    private final TransactionTemplate tx;

    public GitHubService(
            GitHubClient client,
            GitHubAccountRepository accounts,
            GitHubRepoRepository repos,
            ContributionDayRepository days,
            UserClock userClock,
            PlatformTransactionManager transactions) {
        this.client = client;
        this.accounts = accounts;
        this.repos = repos;
        this.days = days;
        this.userClock = userClock;
        this.tx = new TransactionTemplate(transactions);
    }

    /** Everything for the GitHub page, refreshing whatever is due first. */
    public OverviewResponse overview(UUID userId) {
        GitHubAccount account = accounts.findById(userId).orElse(null);
        if (account == null) {
            return OverviewResponse.notConnected();
        }
        Refresh refresh = refreshDue(account, false);
        return build(userId, refresh);
    }

    /** Sets (or replaces) the username, checking with GitHub that it exists. */
    public OverviewResponse connect(UUID userId, String rawUsername) {
        String username = rawUsername.strip();
        if (!USERNAME.matcher(username).matches()) {
            throw ApiException.invalidField(
                    "username", "Use your GitHub username: letters, numbers and single hyphens, up to 39 characters.");
        }
        Fetch<ProfileData> profile = client.profile(username, null);
        switch (profile.outcome()) {
            case NOT_FOUND -> throw ApiException.invalidField("username", "We couldn’t find that GitHub user.");
            case OK -> { }
            default -> throw ApiException.upstreamUnavailable(
                    "GitHub isn’t answering right now. Try again in a few minutes.");
        }
        Instant now = userClock.now();
        GitHubAccount account = tx.execute(status -> {
            repos.deleteAllForUser(userId);
            days.deleteAllForUser(userId);
            GitHubAccount saved = accounts.findById(userId).orElseGet(() -> new GitHubAccount(userId, username));
            saved.startOver(username);
            saved.applyProfile(profile.data(), profile.etag(), now);
            return accounts.saveAndFlush(saved);
        });
        return build(userId, refreshDue(Objects.requireNonNull(account), false));
    }

    /** Fetches everything again now; at most once every five minutes. */
    public OverviewResponse refresh(UUID userId) {
        GitHubAccount account = accounts.findById(userId).orElseThrow(ApiException::notFound);
        Instant now = userClock.now();
        if (account.getRefreshRequestedAt() != null) {
            Instant allowed = account.getRefreshRequestedAt().plus(REFRESH_EVERY);
            if (now.isBefore(allowed)) {
                throw ApiException.tooManyRequests(Math.max(1, Duration.between(now, allowed).toSeconds()));
            }
        }
        account.refreshRequested(now);
        accounts.saveAndFlush(account);
        return build(userId, refreshDue(account, true));
    }

    /** Forgets the username and everything fetched for it. */
    public void disconnect(UUID userId) {
        tx.executeWithoutResult(status -> {
            repos.deleteAllForUser(userId);
            days.deleteAllForUser(userId);
            accounts.findById(userId).ifPresent(accounts::delete);
        });
    }

    /** What Home shows, from saved data only (Home never waits on GitHub). Null when not connected. */
    public Summary summary(UUID userId) {
        GitHubAccount account = accounts.findById(userId).orElse(null);
        if (account == null) {
            return null;
        }
        LocalDate today = userClock.today(userId);
        Integer thisMonth = account.getContributionsFetchedAt() == null
                ? null
                : days.findByUserIdAndDayBetween(userId, YearMonth.from(today).atDay(1), today).stream()
                        .mapToInt(ContributionDay::getCount)
                        .sum();
        GitHubRepo latest = repos.findByUserIdOrderByPushedAtDescNameAsc(userId).stream()
                .filter(r -> r.getPushedAt() != null)
                .findFirst()
                .orElse(null);
        return new Summary(
                account.getUsername(),
                thisMonth,
                latest == null ? null : latest.getName(),
                latest == null ? null : latest.getPushedAt(),
                oldest(account));
    }

    /** {@code contributionsThisMonth} is null without the calendar. */
    public record Summary(
            String username, Integer contributionsThisMonth, String lastPushRepo, Instant lastPushAt, Instant fetchedAt) {}

    // ───────────── refreshing ─────────────

    record Refresh(boolean stale, Instant retryAt) {}

    /** Fetches each part that's due (or all, when forced); the saved copy stays when GitHub fails. */
    Refresh refreshDue(GitHubAccount account, boolean force) {
        Instant now = userClock.now();
        UUID userId = account.getUserId();
        boolean profileDue = force || due(account.getProfileFetchedAt(), PROFILE_TTL, now);
        boolean reposDue = force || due(account.getReposFetchedAt(), REPOS_TTL, now);
        boolean calendarDue = client.canFetchContributions()
                && (force || due(account.getContributionsFetchedAt(), CONTRIBUTIONS_TTL, now));
        if (!profileDue && !reposDue && !calendarDue) {
            return new Refresh(false, null);
        }
        if (account.getBackoffUntil() != null && now.isBefore(account.getBackoffUntil())) {
            return new Refresh(true, account.getBackoffUntil());
        }

        boolean failed = false;
        Instant retryAt = null;
        String username = account.getUsername();

        if (profileDue) {
            Fetch<ProfileData> f = client.profile(username, account.getProfileEtag());
            if (f.outcome() == Outcome.OK) {
                account.applyProfile(f.data(), f.etag(), now);
            } else if (f.outcome() == Outcome.NOT_MODIFIED) {
                account.profileStillFresh(now);
            } else {
                failed = true;
                retryAt = later(retryAt, f.retryAt());
            }
        }
        if (reposDue && retryAt == null) {
            Fetch<List<RepoData>> f = client.repos(username, account.getReposEtag());
            if (f.outcome() == Outcome.OK) {
                List<GitHubRepo> fresh = f.data().stream()
                        .filter(r -> r.htmlUrl() != null && GitHubAccount.https(r.htmlUrl()) != null)
                        .map(r -> new GitHubRepo(userId, r))
                        .toList();
                tx.executeWithoutResult(status -> {
                    repos.deleteAllForUser(userId);
                    repos.flush();
                    repos.saveAll(fresh);
                });
                account.reposFetched(f.etag(), now);
            } else if (f.outcome() == Outcome.NOT_MODIFIED) {
                account.reposStillFresh(now);
            } else {
                failed = true;
                retryAt = later(retryAt, f.retryAt());
            }
        }
        if (calendarDue && retryAt == null) {
            LocalDate today = userClock.today(userId);
            Fetch<Calendar> f = client.contributions(username, today.minusDays(CALENDAR_DAYS - 1L), today);
            if (f.outcome() == Outcome.OK) {
                List<ContributionDay> fresh = f.data().days().stream()
                        .map(d -> new ContributionDay(userId, d.date(), d.count()))
                        .toList();
                tx.executeWithoutResult(status -> {
                    days.deleteAllForUser(userId);
                    days.flush();
                    days.saveAll(fresh);
                });
                account.contributionsFetched(f.data().total(), now);
            } else if (f.outcome() != Outcome.NOT_CONFIGURED) {
                failed = true;
                retryAt = later(retryAt, f.retryAt());
            }
        }
        // Skipped parts after a rate limit are stale too
        if (retryAt != null && (reposDue || calendarDue)) {
            failed = true;
        }
        account.backOffUntil(retryAt);
        accounts.saveAndFlush(account);
        return new Refresh(failed, retryAt);
    }

    private static boolean due(Instant fetchedAt, Duration ttl, Instant now) {
        return fetchedAt == null || !now.isBefore(fetchedAt.plus(ttl));
    }

    private static Instant later(Instant a, Instant b) {
        if (a == null) {
            return b;
        }
        return b == null || a.isAfter(b) ? a : b;
    }

    // ───────────── the response ─────────────

    private OverviewResponse build(UUID userId, Refresh refresh) {
        GitHubAccount account = accounts.findById(userId).orElseThrow(ApiException::notFound);
        List<GitHubRepo> saved = repos.findByUserIdOrderByPushedAtDescNameAsc(userId);
        List<Repo> repoList = saved.stream()
                .map(r -> new Repo(r.getName(), r.getFullName(), r.getHtmlUrl(), r.getDescription(), r.getLanguage(),
                        r.getStars(), r.getForks(), r.isFork(), r.isArchived(), r.getPushedAt()))
                .toList();
        Languages languages = new Languages(
                GitHubMetrics.LANGUAGE_FORMULA,
                GitHubMetrics.languages(saved.stream()
                        .map(r -> new RepoData(r.getName(), r.getFullName(), r.getHtmlUrl(), r.getDescription(),
                                r.getLanguage(), r.getStars(), r.getForks(), r.isFork(), r.isArchived(), r.getPushedAt()))
                        .toList()));

        ContributionCalendar calendar;
        GitHubMetrics.Contributions metrics = null;
        if (account.getContributionsFetchedAt() != null) {
            List<ContributionDay> stored = days.findByUserIdOrderByDayAsc(userId);
            calendar = new ContributionCalendar(true, null, account.getContributionsTotal(),
                    account.getContributionsFetchedAt(),
                    stored.stream().map(d -> new Day(d.getDay(), d.getCount())).toList());
            metrics = GitHubMetrics.contributions(
                    stored.stream().map(d -> new GitHubMetrics.Day(d.getDay(), d.getCount())).toList(),
                    userClock.today(userId));
        } else {
            calendar = new ContributionCalendar(false,
                    client.canFetchContributions() ? "GitHub hasn’t returned the calendar yet." : NO_TOKEN,
                    null, null, List.of());
        }
        return new OverviewResponse(
                true,
                GitHubDtos.SOURCE,
                account.getUsername(),
                oldest(account),
                refresh.stale(),
                refresh.retryAt(),
                new Profile(account.getUsername(), account.getName(), account.getAvatarUrl(), account.getHtmlUrl(),
                        account.getPublicRepos(), account.getFollowers(), account.getFollowing(),
                        account.getGithubCreatedAt()),
                repoList,
                languages,
                calendar,
                metrics);
    }

    /** The oldest fetch among the parts NOVA has. */
    private static Instant oldest(GitHubAccount a) {
        return Stream.of(a.getProfileFetchedAt(), a.getReposFetchedAt(), a.getContributionsFetchedAt())
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
    }
}
