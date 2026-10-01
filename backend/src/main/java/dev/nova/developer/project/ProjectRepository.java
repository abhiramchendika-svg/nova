package dev.nova.developer.project;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    Optional<Project> findByIdAndUserId(UUID id, UUID userId);

    List<Project> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Project> findByUserIdAndStatusInOrderByCreatedAtDesc(UUID userId, Collection<ProjectStatus> statuses);

    long countByUserId(UUID userId);

    long countByUserIdAndStatus(UUID userId, ProjectStatus status);
}
