package dev.nova.academics.timetable;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimetableRepository extends JpaRepository<TimetableEntry, UUID> {

    Optional<TimetableEntry> findByIdAndUserId(UUID id, UUID userId);

    List<TimetableEntry> findByUserIdAndCourseIdIn(UUID userId, Collection<UUID> courseIds);

    List<TimetableEntry> findByUserIdAndDayOfWeekAndCourseIdIn(
            UUID userId, int dayOfWeek, Collection<UUID> courseIds);

    long countByCourseId(UUID courseId);
}
