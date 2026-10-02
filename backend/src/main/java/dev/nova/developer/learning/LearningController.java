package dev.nova.developer.learning;

import dev.nova.developer.learning.LearningDtos.GoalRequest;
import dev.nova.developer.learning.LearningDtos.GoalResponse;
import dev.nova.developer.learning.LearningDtos.ResourceRequest;
import dev.nova.developer.learning.LearningDtos.TopicPatch;
import dev.nova.developer.learning.LearningDtos.TopicRequest;
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

/** Every topic and link write returns the whole goal, so the page updates from the response. */
@RestController
@RequestMapping("/api/v1/learning-goals")
public class LearningController {

    private final LearningService service;

    public LearningController(LearningService service) {
        this.service = service;
    }

    @GetMapping
    public List<GoalResponse> list(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(required = false) List<GoalStatus> status) {
        return service.list(me.id(), status);
    }

    @GetMapping("/{id}")
    public GoalResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<GoalResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody GoalRequest body) {
        GoalResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/learning-goals/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public GoalResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody GoalRequest body) {
        return service.update(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/topics")
    public ResponseEntity<GoalResponse> addTopic(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody TopicRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addTopic(me.id(), id, body));
    }

    @PatchMapping("/{id}/topics/{topicId}")
    public GoalResponse patchTopic(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @PathVariable UUID topicId,
            @Valid @RequestBody TopicPatch body) {
        return service.patchTopic(me.id(), id, topicId, body);
    }

    @DeleteMapping("/{id}/topics/{topicId}")
    public GoalResponse deleteTopic(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @PathVariable UUID topicId) {
        return service.deleteTopic(me.id(), id, topicId);
    }

    @PostMapping("/{id}/resources")
    public ResponseEntity<GoalResponse> addResource(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @Valid @RequestBody ResourceRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addResource(me.id(), id, body));
    }

    @PutMapping("/{id}/resources/{resourceId}")
    public GoalResponse editResource(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @PathVariable UUID resourceId,
            @Valid @RequestBody ResourceRequest body) {
        return service.editResource(me.id(), id, resourceId, body);
    }

    @DeleteMapping("/{id}/resources/{resourceId}")
    public GoalResponse deleteResource(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @PathVariable UUID resourceId) {
        return service.deleteResource(me.id(), id, resourceId);
    }
}
