package dev.nova.academics.resource;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseResourceRepository extends JpaRepository<CourseResource, UUID> {

    List<CourseResource> findByCourseIdAndUserIdOrderByCreatedAtAscIdAsc(UUID courseId, UUID userId);

    Optional<CourseResource> findByIdAndCourseIdAndUserId(UUID id, UUID courseId, UUID userId);

    long countByCourseId(UUID courseId);
}
