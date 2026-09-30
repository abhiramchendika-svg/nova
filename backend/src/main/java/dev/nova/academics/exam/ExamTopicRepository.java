package dev.nova.academics.exam;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExamTopicRepository extends JpaRepository<ExamTopic, UUID> {

    List<ExamTopic> findByExamIdAndUserIdOrderByDisplayOrderAscCreatedAtAsc(UUID examId, UUID userId);

    Optional<ExamTopic> findByIdAndExamIdAndUserId(UUID id, UUID examId, UUID userId);

    long countByExamId(UUID examId);

    /** Topic totals and done counts for a batch of exams, in one query. count(doneAt) skips nulls. */
    @Query("select new dev.nova.academics.exam.PrepCount(t.examId, count(t), count(t.doneAt))"
            + " from ExamTopic t where t.userId = :userId and t.examId in :examIds group by t.examId")
    List<PrepCount> prepCounts(@Param("userId") UUID userId, @Param("examIds") Collection<UUID> examIds);
}
