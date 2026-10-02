package dev.nova.developer.github;

import dev.nova.developer.github.GitHubClient.RepoData;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One public repository as GitHub last described it; replaced wholesale on each fresh fetch. */
@Entity
@Table(name = "github_repos")
public class GitHubRepo {

    static final int MAX_DESCRIPTION = 400;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "html_url", nullable = false, length = 2048)
    private String htmlUrl;

    @Column(length = MAX_DESCRIPTION)
    private String description;

    @Column(length = 60)
    private String language;

    @Column(nullable = false)
    private int stars;

    @Column(nullable = false)
    private int forks;

    @Column(nullable = false)
    private boolean fork;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "pushed_at")
    private Instant pushedAt;

    protected GitHubRepo() {}

    public GitHubRepo(UUID userId, RepoData r) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.name = r.name();
        this.fullName = r.fullName();
        this.htmlUrl = r.htmlUrl();
        this.description = r.description() == null || r.description().length() <= MAX_DESCRIPTION
                ? r.description()
                : r.description().substring(0, MAX_DESCRIPTION - 1) + "…";
        this.language = r.language();
        this.stars = Math.max(0, r.stars());
        this.forks = Math.max(0, r.forks());
        this.fork = r.fork();
        this.archived = r.archived();
        this.pushedAt = r.pushedAt();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getFullName() {
        return fullName;
    }

    public String getHtmlUrl() {
        return htmlUrl;
    }

    public String getDescription() {
        return description;
    }

    public String getLanguage() {
        return language;
    }

    public int getStars() {
        return stars;
    }

    public int getForks() {
        return forks;
    }

    public boolean isFork() {
        return fork;
    }

    public boolean isArchived() {
        return archived;
    }

    public Instant getPushedAt() {
        return pushedAt;
    }
}
