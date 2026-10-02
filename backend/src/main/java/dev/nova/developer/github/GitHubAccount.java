package dev.nova.developer.github;

import dev.nova.common.persistence.AuditedEntity;
import dev.nova.developer.github.GitHubClient.ProfileData;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A user's GitHub username and the last profile GitHub returned for it, with the ETags and fetch
 * times that keep refreshes polite. One per NOVA user.
 */
@Entity
@Table(name = "github_accounts")
public class GitHubAccount extends AuditedEntity {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 39)
    private String username;

    @Column(name = "github_user_id")
    private Long githubUserId;

    @Column(length = 255)
    private String name;

    @Column(name = "avatar_url", length = 2048)
    private String avatarUrl;

    @Column(name = "html_url", length = 2048)
    private String htmlUrl;

    @Column(name = "public_repos")
    private Integer publicRepos;

    private Integer followers;

    private Integer following;

    @Column(name = "github_created_at")
    private Instant githubCreatedAt;

    @Column(name = "profile_etag", length = 200)
    private String profileEtag;

    @Column(name = "profile_fetched_at")
    private Instant profileFetchedAt;

    @Column(name = "repos_etag", length = 200)
    private String reposEtag;

    @Column(name = "repos_fetched_at")
    private Instant reposFetchedAt;

    @Column(name = "contributions_total")
    private Integer contributionsTotal;

    @Column(name = "contributions_fetched_at")
    private Instant contributionsFetchedAt;

    @Column(name = "backoff_until")
    private Instant backoffUntil;

    @Column(name = "refresh_requested_at")
    private Instant refreshRequestedAt;

    protected GitHubAccount() {}

    public GitHubAccount(UUID userId, String username) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.username = Objects.requireNonNull(username, "username");
    }

    /** Forgets everything fetched before, for a new (or re-entered) username. */
    public void startOver(String username) {
        this.username = Objects.requireNonNull(username, "username");
        this.githubUserId = null;
        this.name = null;
        this.avatarUrl = null;
        this.htmlUrl = null;
        this.publicRepos = null;
        this.followers = null;
        this.following = null;
        this.githubCreatedAt = null;
        this.profileEtag = null;
        this.profileFetchedAt = null;
        this.reposEtag = null;
        this.reposFetchedAt = null;
        this.contributionsTotal = null;
        this.contributionsFetchedAt = null;
        this.backoffUntil = null;
        this.refreshRequestedAt = null;
    }

    /** Stores what GitHub returned; links are kept only when they are https. */
    public void applyProfile(ProfileData p, String etag, Instant fetchedAt) {
        this.username = p.login();
        this.githubUserId = p.id();
        this.name = p.name();
        this.avatarUrl = https(p.avatarUrl());
        this.htmlUrl = https(p.htmlUrl());
        this.publicRepos = p.publicRepos();
        this.followers = p.followers();
        this.following = p.following();
        this.githubCreatedAt = p.createdAt();
        this.profileEtag = etag;
        this.profileFetchedAt = fetchedAt;
    }

    public void profileStillFresh(Instant at) {
        this.profileFetchedAt = at;
    }

    public void reposFetched(String etag, Instant at) {
        this.reposEtag = etag;
        this.reposFetchedAt = at;
    }

    public void reposStillFresh(Instant at) {
        this.reposFetchedAt = at;
    }

    public void contributionsFetched(int total, Instant at) {
        this.contributionsTotal = total;
        this.contributionsFetchedAt = at;
    }

    public void backOffUntil(Instant until) {
        this.backoffUntil = until;
    }

    public void refreshRequested(Instant at) {
        this.refreshRequestedAt = at;
    }

    static String https(String url) {
        return url != null && url.regionMatches(true, 0, "https://", 0, 8) ? url : null;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getUsername() {
        return username;
    }

    public Long getGithubUserId() {
        return githubUserId;
    }

    public String getName() {
        return name;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getHtmlUrl() {
        return htmlUrl;
    }

    public Integer getPublicRepos() {
        return publicRepos;
    }

    public Integer getFollowers() {
        return followers;
    }

    public Integer getFollowing() {
        return following;
    }

    public Instant getGithubCreatedAt() {
        return githubCreatedAt;
    }

    public String getProfileEtag() {
        return profileEtag;
    }

    public Instant getProfileFetchedAt() {
        return profileFetchedAt;
    }

    public String getReposEtag() {
        return reposEtag;
    }

    public Instant getReposFetchedAt() {
        return reposFetchedAt;
    }

    public Integer getContributionsTotal() {
        return contributionsTotal;
    }

    public Instant getContributionsFetchedAt() {
        return contributionsFetchedAt;
    }

    public Instant getBackoffUntil() {
        return backoffUntil;
    }

    public Instant getRefreshRequestedAt() {
        return refreshRequestedAt;
    }
}
