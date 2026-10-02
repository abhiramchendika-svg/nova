package dev.nova.developer.github;

import dev.nova.developer.github.GitHubMetrics.Contributions;
import dev.nova.developer.github.GitHubMetrics.LanguageShare;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Bodies for /api/v1/github (docs/api.md §2.13). */
public final class GitHubDtos {

    private GitHubDtos() {}

    public static final String SOURCE = "GITHUB_API";

    public record AccountRequest(
            @NotBlank(message = "Enter your GitHub username.") @Size(max = 39, message = "GitHub usernames are at most 39 characters.")
                    String username) {}

    /** Straight from GitHub. */
    public record Profile(
            String login,
            String name,
            String avatarUrl,
            String htmlUrl,
            Integer publicRepos,
            Integer followers,
            Integer following,
            Instant createdAt) {}

    /** Straight from GitHub. */
    public record Repo(
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

    public record Languages(String formula, List<LanguageShare> shares) {}

    public record Day(LocalDate date, int count) {}

    /**
     * The contribution calendar. Without a server token it isn't {@code available} and
     * {@code reason} says why; nothing is shown as zero.
     */
    public record ContributionCalendar(boolean available, String reason, Integer total, Instant fetchedAt, List<Day> days) {}

    /**
     * {@code connected} false means no username yet (everything else null). {@code fetchedAt} is
     * the oldest part shown; {@code stale} means a refresh that was due failed (GitHub down or rate
     * limited) and older data is shown. {@code novaMetrics} are NOVA's own numbers with formulas.
     */
    public record OverviewResponse(
            boolean connected,
            String source,
            String username,
            Instant fetchedAt,
            boolean stale,
            Instant retryAt,
            Profile profile,
            List<Repo> repos,
            Languages languages,
            ContributionCalendar contributions,
            Contributions novaMetrics) {

        static OverviewResponse notConnected() {
            return new OverviewResponse(false, SOURCE, null, null, false, null, null, null, null, null, null);
        }
    }
}
