package dev.nova.developer.learning;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningTopicRepository extends JpaRepository<LearningTopic, UUID> {

    List<LearningTopic> findByGoalIdAndUserIdOrderByDisplayOrderAsc(UUID goalId, UUID userId);

    /** Every topic of several goals at once (the goal list). */
    List<LearningTopic> findByUserIdAndGoalIdInOrderByDisplayOrderAsc(UUID userId, Collection<UUID> goalIds);

    Optional<LearningTopic> findByIdAndGoalIdAndUserId(UUID id, UUID goalId, UUID userId);

    long countByGoalId(UUID goalId);
}
