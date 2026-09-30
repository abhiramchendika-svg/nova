package dev.nova.academics.assignment;

import dev.nova.academics.assignment.AssignmentDtos.AssignmentRequest;
import dev.nova.academics.assignment.AssignmentDtos.AssignmentResponse;
import dev.nova.academics.assignment.AssignmentDtos.ProgressRequest;
import dev.nova.academics.assignment.AssignmentService.Filter;
import dev.nova.common.web.PageResponse;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/assignments")
public class AssignmentController {

    private final AssignmentService service;

    public AssignmentController(AssignmentService service) {
        this.service = service;
    }

    /** All filters are optional; {@code status} may repeat (?status=NOT_STARTED&status=IN_PROGRESS). */
    @GetMapping
    public PageResponse<AssignmentResponse> list(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(required = false) List<AssignmentStatus> status,
            @RequestParam(required = false) UUID courseId,
            @RequestParam(required = false) AssignmentPriority priority,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dueTo,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PageResponse.DEFAULT_SIZE) int size) {
        return service.list(me.id(), new Filter(status, courseId, priority, dueFrom, dueTo), sort, page, size);
    }

    @GetMapping("/{id}")
    public AssignmentResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<AssignmentResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody AssignmentRequest body) {
        AssignmentResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/assignments/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public AssignmentResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody AssignmentRequest body) {
        return service.update(me.id(), id, body);
    }

    @PatchMapping("/{id}/progress")
    public AssignmentResponse updateProgress(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody ProgressRequest body) {
        return service.updateProgress(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }
}
