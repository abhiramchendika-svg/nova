package dev.nova.academics.attendance;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, UUID> {

    /** Records per course and status, e.g. (DBMS, PRESENT, 12). One query for a whole semester. */
    @Query("select new dev.nova.academics.attendance.StatusCount("
            + "r.courseId, r.status, count(r)) from AttendanceRecord r"
            + " where r.userId = :userId and r.courseId in :courseIds group by r.courseId, r.status")
    List<StatusCount> countByStatus(@Param("userId") UUID userId, @Param("courseIds") Collection<UUID> courseIds);

    Optional<AttendanceRecord> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByCourseIdAndHeldOnAndSlot(UUID courseId, LocalDate heldOn, int slot);

    /** History, newest first (the sort comes from the caller's Pageable). */
    Page<AttendanceRecord> findByCourseIdAndUserId(UUID courseId, UUID userId, Pageable pageable);
}
