package dev.nova.developer.github;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContributionDayRepository extends JpaRepository<ContributionDay, UUID> {

    List<ContributionDay> findByUserIdOrderByDayAsc(UUID userId);

    List<ContributionDay> findByUserIdAndDayBetween(UUID userId, LocalDate from, LocalDate to);

    @Modifying
    @Query("delete from ContributionDay d where d.userId = :userId")
    void deleteAllForUser(@Param("userId") UUID userId);
}
