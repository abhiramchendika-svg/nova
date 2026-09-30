package dev.nova.academics.exam;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** The list endpoint's optional filters use Specifications, like assignments. */
public interface ExamRepository extends JpaRepository<Exam, UUID>, JpaSpecificationExecutor<Exam> {

    Optional<Exam> findByIdAndUserId(UUID id, UUID userId);

    long countByCourseId(UUID courseId);
}
