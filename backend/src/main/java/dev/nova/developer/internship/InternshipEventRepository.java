package dev.nova.developer.internship;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InternshipEventRepository extends JpaRepository<InternshipEvent, UUID> {

    List<InternshipEvent> findByUserIdAndApplicationIdInOrderByChangedAtAscIdAsc(
            UUID userId, Collection<UUID> applicationIds);

    List<InternshipEvent> findByUserId(UUID userId);
}
