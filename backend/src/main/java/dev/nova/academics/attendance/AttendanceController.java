package dev.nova.academics.attendance;

import dev.nova.academics.attendance.AttendanceDtos.BaselineRequest;
import dev.nova.academics.attendance.AttendanceDtos.CourseAttendance;
import dev.nova.academics.attendance.AttendanceDtos.MarkRequest;
import dev.nova.academics.attendance.AttendanceDtos.RecordResponse;
import dev.nova.academics.attendance.AttendanceDtos.StatusRequest;
import dev.nova.common.web.PageResponse;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Attendance endpoints (docs/api.md §2.5). Some live under /courses/{id}, where they belong in the URL. */
@RestController
@RequestMapping("/api/v1")
public class AttendanceController {

    private final AttendanceService service;

    public AttendanceController(AttendanceService service) {
        this.service = service;
    }

    /** Without {@code semesterId}: the current semester. */
    @GetMapping("/attendance")
    public List<CourseAttendance> forSemester(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(required = false) UUID semesterId) {
        return service.forSemester(me.id(), semesterId);
    }

    @GetMapping("/courses/{courseId}/attendance")
    public CourseAttendance forCourse(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID courseId) {
        return service.forCourse(me.id(), courseId);
    }

    @GetMapping("/courses/{courseId}/attendance/records")
    public PageResponse<RecordResponse> history(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PageResponse.DEFAULT_SIZE) int size) {
        return service.history(me.id(), courseId, page, size);
    }

    @PostMapping("/courses/{courseId}/attendance/records")
    public ResponseEntity<RecordResponse> mark(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID courseId,
            @Valid @RequestBody MarkRequest body) {
        RecordResponse record = service.mark(me.id(), courseId, body);
        return ResponseEntity.created(URI.create("/api/v1/attendance/records/" + record.id())).body(record);
    }

    @PutMapping("/attendance/records/{recordId}")
    public RecordResponse changeStatus(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID recordId,
            @Valid @RequestBody StatusRequest body) {
        return service.changeStatus(me.id(), recordId, body);
    }

    @DeleteMapping("/attendance/records/{recordId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID recordId) {
        service.delete(me.id(), recordId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/courses/{courseId}/attendance/baseline")
    public CourseAttendance setBaseline(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID courseId,
            @Valid @RequestBody BaselineRequest body) {
        return service.setBaseline(me.id(), courseId, body);
    }
}
