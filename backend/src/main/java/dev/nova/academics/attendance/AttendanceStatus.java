package dev.nova.academics.attendance;

/** What happened at one class. Cancelled classes are kept for history but never counted. */
public enum AttendanceStatus {
    PRESENT,
    ABSENT,
    CANCELLED
}
