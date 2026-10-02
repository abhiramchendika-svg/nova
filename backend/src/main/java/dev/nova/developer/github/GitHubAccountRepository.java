package dev.nova.developer.github;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitHubAccountRepository extends JpaRepository<GitHubAccount, UUID> {}
