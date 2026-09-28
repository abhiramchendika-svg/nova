package dev.nova.academics.grading;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GradingSchemeRepository extends JpaRepository<GradingScheme, UUID> {

    /**
     * Built-in presets plus the user's own schemes, with their grades loaded in the same query.
     * (Hibernate 6+ removes the duplicate parent rows a collection fetch join produces, so no DISTINCT.)
     */
    @Query("select s from GradingScheme s left join fetch s.grades"
            + " where s.userId is null or s.userId = :userId")
    List<GradingScheme> findVisibleTo(@Param("userId") UUID userId);

    /** A preset or one of the user's own schemes; anything else is treated as not existing. */
    @Query("select s from GradingScheme s left join fetch s.grades"
            + " where s.id = :id and (s.userId is null or s.userId = :userId)")
    Optional<GradingScheme> findVisible(@Param("id") UUID id, @Param("userId") UUID userId);

    long countByUserId(UUID userId);

    // Native queries keep this package independent of the semester and course packages
    // (they depend on grading, not the other way round).

    @Query(value = "select exists (select 1 from semesters where grading_scheme_id = :schemeId)", nativeQuery = true)
    boolean isUsedBySemester(@Param("schemeId") UUID schemeId);

    /** Labels of the given grades that at least one course is currently graded with. */
    @Query(
            value = "select distinct g.label from grade_definitions g"
                    + " join courses c on c.grade_definition_id = g.id where g.id in (:gradeIds)",
            nativeQuery = true)
    List<String> findLabelsInUse(@Param("gradeIds") Collection<UUID> gradeIds);
}
