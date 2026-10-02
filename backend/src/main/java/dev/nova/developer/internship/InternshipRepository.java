package dev.nova.developer.internship;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InternshipRepository extends JpaRepository<Internship, UUID> {

    Optional<Internship> findByIdAndUserId(UUID id, UUID userId);

    Page<Internship> findByUserId(UUID userId, Pageable pageable);

    Page<Internship> findByUserIdAndStatusIn(UUID userId, Collection<InternshipStatus> statuses, Pageable pageable);

    List<Internship> findByUserId(UUID userId);

    List<Internship> findByUserIdAndStatusIn(UUID userId, Collection<InternshipStatus> statuses);

    long countByUserId(UUID userId);
}
