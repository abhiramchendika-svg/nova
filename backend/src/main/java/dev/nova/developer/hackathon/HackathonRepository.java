package dev.nova.developer.hackathon;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HackathonRepository extends JpaRepository<Hackathon, UUID> {

    Optional<Hackathon> findByIdAndUserId(UUID id, UUID userId);

    List<Hackathon> findByUserId(UUID userId);

    List<Hackathon> findByUserIdAndStatusIn(UUID userId, Collection<HackathonStatus> statuses);

    long countByUserId(UUID userId);
}
