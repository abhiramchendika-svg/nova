package dev.nova.academics.course;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    List<Course> findByUserId(UUID userId);

    List<Course> findBySemesterIdAndUserIdOrderByNameAsc(UUID semesterId, UUID userId);

    Optional<Course> findByIdAndUserId(UUID id, UUID userId);

    long countBySemesterId(UUID semesterId);
}
