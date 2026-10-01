package dev.nova.developer.project;

import dev.nova.developer.project.ProjectDtos.MilestonePatch;
import dev.nova.developer.project.ProjectDtos.MilestoneRequest;
import dev.nova.developer.project.ProjectDtos.ProjectRequest;
import dev.nova.developer.project.ProjectDtos.ProjectResponse;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    /** {@code ?status=} may repeat; none means every status. */
    @GetMapping
    public List<ProjectResponse> list(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(required = false) List<ProjectStatus> status) {
        return service.list(me.id(), status);
    }

    @GetMapping("/{id}")
    public ProjectResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody ProjectRequest body) {
        ProjectResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public ProjectResponse update(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @Valid @RequestBody ProjectRequest body) {
        return service.update(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/milestones")
    public ResponseEntity<ProjectResponse> addMilestone(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @Valid @RequestBody MilestoneRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addMilestone(me.id(), id, body));
    }

    @PutMapping("/{id}/milestones/{milestoneId}")
    public ProjectResponse editMilestone(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @PathVariable UUID milestoneId,
            @Valid @RequestBody MilestoneRequest body) {
        return service.editMilestone(me.id(), id, milestoneId, body);
    }

    @PatchMapping("/{id}/milestones/{milestoneId}")
    public ProjectResponse patchMilestone(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @PathVariable UUID milestoneId,
            @Valid @RequestBody MilestonePatch body) {
        return service.patchMilestone(me.id(), id, milestoneId, body);
    }

    /** Returns the project, so the page updates from the response. */
    @DeleteMapping("/{id}/milestones/{milestoneId}")
    public ProjectResponse deleteMilestone(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @PathVariable UUID milestoneId) {
        return service.deleteMilestone(me.id(), id, milestoneId);
    }
}
