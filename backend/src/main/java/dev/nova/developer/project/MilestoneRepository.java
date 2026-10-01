package dev.nova.developer.project;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MilestoneRepository extends JpaRepository<Milestone, UUID> {

    List<Milestone> findByProjectIdAndUserIdOrderByDisplayOrderAsc(UUID projectId, UUID userId);

    /** Every milestone of several projects at once (the project list). */
    List<Milestone> findByUserIdAndProjectIdInOrderByDisplayOrderAsc(UUID userId, Collection<UUID> projectIds);

    Optional<Milestone> findByIdAndProjectIdAndUserId(UUID id, UUID projectId, UUID userId);

    long countByProjectId(UUID projectId);

    /** Open milestones due within [from, to] (the calendar). */
    List<Milestone> findByUserIdAndDoneAtIsNullAndDueOnBetween(UUID userId, LocalDate from, LocalDate to);

    /** Open milestones with a due date, soonest first (Home's next milestone). */
    List<Milestone> findByUserIdAndDoneAtIsNullAndDueOnIsNotNullOrderByDueOnAsc(UUID userId);
}
