package dev.nova.developer.learning;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningResourceRepository extends JpaRepository<LearningResource, UUID> {

    /** Oldest first, so links keep the order they were added in. */
    List<LearningResource> findByUserIdAndGoalIdInOrderByCreatedAtAscIdAsc(UUID userId, Collection<UUID> goalIds);

    Optional<LearningResource> findByIdAndGoalIdAndUserId(UUID id, UUID goalId, UUID userId);

    long countByGoalId(UUID goalId);
}
