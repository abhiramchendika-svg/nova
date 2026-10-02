package dev.nova.developer.github;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitHubRepoRepository extends JpaRepository<GitHubRepo, UUID> {

    List<GitHubRepo> findByUserIdOrderByPushedAtDescNameAsc(UUID userId);

    @Modifying
    @Query("delete from GitHubRepo r where r.userId = :userId")
    void deleteAllForUser(@Param("userId") UUID userId);
}
