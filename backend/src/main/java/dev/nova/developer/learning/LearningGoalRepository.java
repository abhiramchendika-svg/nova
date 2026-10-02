package dev.nova.developer.learning;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningGoalRepository extends JpaRepository<LearningGoal, UUID> {

    Optional<LearningGoal> findByIdAndUserId(UUID id, UUID userId);

    List<LearningGoal> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<LearningGoal> findByUserIdAndStatusInOrderByCreatedAtDesc(UUID userId, Collection<GoalStatus> statuses);

    long countByUserId(UUID userId);
}
