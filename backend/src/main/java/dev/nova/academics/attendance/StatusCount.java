package dev.nova.academics.attendance;

import java.util.UUID;

/** One row of {@link AttendanceRecordRepository#countByStatus}: how many records a course has in a status. */
public record StatusCount(UUID courseId, AttendanceStatus status, Long total) {}
