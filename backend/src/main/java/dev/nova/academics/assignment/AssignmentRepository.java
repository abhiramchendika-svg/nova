package dev.nova.academics.assignment;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** Filtering for the list endpoint uses Specifications (optional filters without nullable JPQL parameters). */
public interface AssignmentRepository extends JpaRepository<Assignment, UUID>, JpaSpecificationExecutor<Assignment> {

    Optional<Assignment> findByIdAndUserId(UUID id, UUID userId);

    List<Assignment> findByCourseIdAndUserIdAndStatusInOrderByDueAtAsc(
            UUID courseId, UUID userId, Collection<AssignmentStatus> statuses, Pageable limit);

    long countByCourseIdAndUserIdAndStatusIn(UUID courseId, UUID userId, Collection<AssignmentStatus> statuses);

    long countByCourseIdAndUserIdAndStatusInAndDueAtBefore(
            UUID courseId, UUID userId, Collection<AssignmentStatus> statuses, Instant before);
}
