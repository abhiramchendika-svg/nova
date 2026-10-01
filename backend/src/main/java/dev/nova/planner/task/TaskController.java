package dev.nova.planner.task;

import dev.nova.common.web.PageResponse;
import dev.nova.planner.task.TaskDtos.StatusRequest;
import dev.nova.planner.task.TaskDtos.StatusResponse;
import dev.nova.planner.task.TaskDtos.TaskRequest;
import dev.nova.planner.task.TaskDtos.TaskResponse;
import dev.nova.planner.task.TaskDtos.TodayResponse;
import dev.nova.planner.task.TaskDtos.UpcomingResponse;
import dev.nova.planner.task.TaskService.Filter;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
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
@RequestMapping("/api/v1/tasks")
public class TaskController {

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    /** Without {@code date}: today in the user's timezone. */
    @GetMapping("/today")
    public TodayResponse today(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.today(me.id(), date);
    }

    @GetMapping("/upcoming")
    public UpcomingResponse upcoming(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(defaultValue = "14") int days) {
        return service.upcoming(me.id(), days);
    }

    @GetMapping("/completed")
    public PageResponse<TaskResponse> completed(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PageResponse.DEFAULT_SIZE) int size) {
        return service.completed(me.id(), page, size);
    }

    @GetMapping
    public PageResponse<TaskResponse> list(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(required = false) TaskCategory category,
            @RequestParam(required = false) List<TaskStatus> status,
            @RequestParam(required = false) UUID courseId,
            @RequestParam(required = false) UUID examId,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PageResponse.DEFAULT_SIZE) int size) {
        return service.list(me.id(), new Filter(category, status, courseId, examId), sort, page, size);
    }

    @GetMapping("/{id}")
    public TaskResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody TaskRequest body) {
        TaskResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/tasks/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public TaskResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody TaskRequest body) {
        return service.update(me.id(), id, body);
    }

    @PatchMapping("/{id}/status")
    public StatusResponse changeStatus(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody StatusRequest body) {
        return service.changeStatus(me.id(), id, body.status());
    }

    /** {@code ?series=true} also deletes the open repeats planned on or after this one. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @RequestParam(defaultValue = "false") boolean series) {
        service.delete(me.id(), id, series);
        return ResponseEntity.noContent().build();
    }
}
