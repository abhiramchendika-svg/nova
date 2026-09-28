package dev.nova.academics.semester;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SemesterRepository extends JpaRepository<Semester, UUID> {

    List<Semester> findByUserIdOrderByOrdinalAsc(UUID userId);

    Optional<Semester> findByIdAndUserId(UUID id, UUID userId);

    Optional<Semester> findByUserIdAndCurrentTrue(UUID userId);

    long countByUserId(UUID userId);

    boolean existsByUserIdAndOrdinal(UUID userId, int ordinal);

    boolean existsByUserIdAndOrdinalAndIdNot(UUID userId, int ordinal, UUID id);

    /** Native so this package doesn't depend on the course package (course depends on semester). */
    @Query(
            value = "select exists (select 1 from courses where semester_id = :semesterId"
                    + " and grade_definition_id is not null)",
            nativeQuery = true)
    boolean hasGradedCourses(@Param("semesterId") UUID semesterId);
}
