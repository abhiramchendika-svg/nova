package dev.nova.academics.attendance;

import dev.nova.academics.attendance.AttendanceCalculator.Status;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Bodies for attendance endpoints (docs/api.md §2.5). */
public final class AttendanceDtos {

    private AttendanceDtos() {}

    /** Mark one class. {@code slot} defaults to 1; use 2, 3 … when a course meets more than once a day. */
    public record MarkRequest(
            @NotNull(message = "Choose the day of the class.") LocalDate heldOn,
            @Min(value = 1, message = "Must be between 1 and 12.") @Max(value = 12, message = "Must be between 1 and 12.")
                    Integer slot,
            @NotNull(message = "Choose present, absent or cancelled.") AttendanceStatus status) {}

    public record StatusRequest(@NotNull(message = "Choose present, absent or cancelled.") AttendanceStatus status) {}

    public record BaselineRequest(
            @NotNull(message = "Enter the classes held so far.")
                    @Min(value = 0, message = "Can't be negative.")
                    @Max(value = 9999, message = "That's more classes than a semester has.")
                    Integer conducted,
            @NotNull(message = "Enter the classes you attended.")
                    @Min(value = 0, message = "Can't be negative.")
                    @Max(value = 9999, message = "That's more classes than a semester has.")
                    Integer attended) {}

    public record RecordResponse(UUID id, UUID courseId, LocalDate heldOn, int slot, AttendanceStatus status) {

        static RecordResponse from(AttendanceRecord r) {
            return new RecordResponse(r.getId(), r.getCourseId(), r.getHeldOn(), r.getSlot(), r.getStatus());
        }
    }

    /** Where the target came from: the course itself, its semester, or the user's default. */
    public enum TargetSource {
        COURSE,
        SEMESTER,
        DEFAULT
    }

    /**
     * One course's attendance. {@code conducted}/{@code attended} include the baseline; the
     * {@code present}/{@code absent}/{@code cancelled} counts are the marked classes only.
     * {@code target}, {@code targetSource}, {@code canMiss} and {@code needToAttend} are null without a target.
     */
    public record CourseAttendance(
            UUID courseId,
            String courseCode,
            String courseName,
            int baselineConducted,
            int baselineAttended,
            int present,
            int absent,
            int cancelled,
            int conducted,
            int attended,
            BigDecimal percentage,
            BigDecimal target,
            TargetSource targetSource,
            Integer canMiss,
            Integer needToAttend,
            Status status) {}
}
