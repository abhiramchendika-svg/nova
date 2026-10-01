package dev.nova.planner.task;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, UUID>, JpaSpecificationExecutor<Task> {

    Optional<Task> findByIdAndUserId(UUID id, UUID userId);

    /** Open tasks planned for the day or earlier, or due before the day ends (overdue included). */
    @Query("select t from Task t where t.userId = :userId and t.status <> dev.nova.planner.task.TaskStatus.DONE"
            + " and ((t.plannedFor is not null and t.plannedFor <= :day)"
            + " or (t.dueAt is not null and t.dueAt < :dayEnd))")
    List<Task> openForDay(@Param("userId") UUID userId, @Param("day") LocalDate day, @Param("dayEnd") Instant dayEnd);

    /** Tasks completed within [from, to). */
    List<Task> findByUserIdAndStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThanOrderByCompletedAtDesc(
            UUID userId, TaskStatus status, Instant from, Instant to);

    /**
     * Open tasks after today: planned within (day, lastDay], or with no plan and due within the
     * window [dayEnd, windowEnd).
     */
    @Query("select t from Task t where t.userId = :userId and t.status <> dev.nova.planner.task.TaskStatus.DONE"
            + " and ((t.plannedFor > :day and t.plannedFor <= :lastDay)"
            + " or (t.plannedFor is null and t.dueAt >= :dayEnd and t.dueAt < :windowEnd))")
    List<Task> openUpcoming(
            @Param("userId") UUID userId,
            @Param("day") LocalDate day,
            @Param("lastDay") LocalDate lastDay,
            @Param("dayEnd") Instant dayEnd,
            @Param("windowEnd") Instant windowEnd);

    /** Open tasks with neither a do date nor a deadline ("someday"). */
    @Query("select t from Task t where t.userId = :userId and t.status <> dev.nova.planner.task.TaskStatus.DONE"
            + " and t.plannedFor is null and t.dueAt is null order by t.createdAt asc")
    List<Task> openUnscheduled(@Param("userId") UUID userId);

    Page<Task> findByUserIdAndStatus(UUID userId, TaskStatus status, Pageable pageable);

    boolean existsBySeriesIdAndPlannedFor(UUID seriesId, LocalDate plannedFor);

    boolean existsBySeriesIdAndPlannedForAndIdNot(UUID seriesId, LocalDate plannedFor, UUID id);

    /** Open repeats in a series from a day on (for "delete this and future repeats"). */
    @Query("select t from Task t where t.userId = :userId and t.seriesId = :seriesId"
            + " and t.status <> dev.nova.planner.task.TaskStatus.DONE and t.plannedFor >= :from")
    List<Task> openInSeriesFrom(
            @Param("userId") UUID userId, @Param("seriesId") UUID seriesId, @Param("from") LocalDate from);
}
