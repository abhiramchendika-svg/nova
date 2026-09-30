package dev.nova.academics.resource;

import dev.nova.academics.resource.CourseResourceDtos.ResourceRequest;
import dev.nova.academics.resource.CourseResourceDtos.ResourceResponse;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/courses/{courseId}/resources")
public class CourseResourceController {

    private final CourseResourceService service;

    public CourseResourceController(CourseResourceService service) {
        this.service = service;
    }

    @GetMapping
    public List<ResourceResponse> list(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID courseId) {
        return service.list(me.id(), courseId);
    }

    @PostMapping
    public ResponseEntity<ResourceResponse> add(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID courseId,
            @Valid @RequestBody ResourceRequest body) {
        ResourceResponse created = service.add(me.id(), courseId, body);
        return ResponseEntity.created(URI.create("/api/v1/courses/" + courseId + "/resources/" + created.id()))
                .body(created);
    }

    @PutMapping("/{resourceId}")
    public ResourceResponse update(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID courseId,
            @PathVariable UUID resourceId,
            @Valid @RequestBody ResourceRequest body) {
        return service.update(me.id(), courseId, resourceId, body);
    }

    @DeleteMapping("/{resourceId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID courseId, @PathVariable UUID resourceId) {
        service.delete(me.id(), courseId, resourceId);
        return ResponseEntity.noContent().build();
    }
}
