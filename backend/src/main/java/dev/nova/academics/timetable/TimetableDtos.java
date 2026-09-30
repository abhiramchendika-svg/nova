package dev.nova.academics.timetable;

import dev.nova.academics.attendance.AttendanceStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Bodies for /api/v1/timetable (docs/api.md §2.8). */
public final class TimetableDtos {

    private TimetableDtos() {}

    static final String TIME = "^([01]\\d|2[0-3]):[0-5]\\d$";

    /**
     * Create, or full replacement on update. Times are "HH:mm" on the user's wall clock (minute
     * precision on purpose: nobody's class starts at 09:00:30).
     */
    public record EntryRequest(
            @NotNull(message = "Choose a course.") UUID courseId,
            @NotNull(message = "Choose a day.")
                    @Min(value = 1, message = "Use 1 (Monday) to 7 (Sunday).")
                    @Max(value = 7, message = "Use 1 (Monday) to 7 (Sunday).")
                    Integer dayOfWeek,
            @NotNull(message = "Set the start time.") @Pattern(regexp = TIME, message = "Use a time like 09:00.")
                    String startsAt,
            @NotNull(message = "Set the end time.") @Pattern(regexp = TIME, message = "Use a time like 09:50.")
                    String endsAt,
            ClassKind kind,
            @Size(max = 60, message = "Keep it under 60 characters.") String location,
            @Size(max = 120, message = "Keep it under 120 characters.") String instructor) {}

    /** {@code overlapsWith} lists same-day classes whose times intersect this one (allowed, but worth a warning). */
    public record EntryResponse(
            UUID id,
            UUID courseId,
            String courseCode,
            String courseName,
            Integer colorHue,
            int dayOfWeek,
            String startsAt,
            String endsAt,
            ClassKind kind,
            String location,
            String instructor,
            List<UUID> overlapsWith) {}

    /** A class already marked for that day, so Home can show "Present" instead of the buttons. */
    public record MarkedAttendance(UUID recordId, AttendanceStatus status) {}

    /** One class on a given date: the weekly entry, its attendance slot that day, and any mark. */
    public record DayClass(EntryResponse entry, int slot, MarkedAttendance attendance) {}

    /**
     * A date's classes from the current semester's timetable, in start-time order. {@code inTerm} is
     * false (and {@code classes} empty) when the date falls outside the semester's dates.
     */
    public record DayResponse(LocalDate date, int dayOfWeek, UUID semesterId, boolean inTerm, List<DayClass> classes) {}
}
