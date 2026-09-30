package dev.nova.academics.exam;

import dev.nova.academics.exam.ExamDtos.ExamRequest;
import dev.nova.academics.exam.ExamDtos.ExamResponse;
import dev.nova.academics.exam.ExamDtos.ExamSummary;
import dev.nova.academics.exam.ExamDtos.TopicPatch;
import dev.nova.academics.exam.ExamDtos.TopicRequest;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
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
@RequestMapping("/api/v1/exams")
public class ExamController {

    private final ExamService service;

    public ExamController(ExamService service) {
        this.service = service;
    }

    @GetMapping
    public List<ExamSummary> list(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(defaultValue = "false") boolean upcoming,
            @RequestParam(required = false) UUID courseId) {
        return service.list(me.id(), upcoming, courseId);
    }

    @GetMapping("/{id}")
    public ExamResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<ExamResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody ExamRequest body) {
        ExamResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/exams/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public ExamResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody ExamRequest body) {
        return service.update(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }

    /** Returns the whole exam, so the checklist and prep % update together. */
    @PostMapping("/{id}/topics")
    public ResponseEntity<ExamResponse> addTopic(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody TopicRequest body) {
        ExamResponse exam = service.addTopic(me.id(), id, body);
        return ResponseEntity.created(URI.create("/api/v1/exams/" + id)).body(exam);
    }

    @PatchMapping("/{id}/topics/{topicId}")
    public ExamResponse patchTopic(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @PathVariable UUID topicId,
            @Valid @RequestBody TopicPatch body) {
        return service.patchTopic(me.id(), id, topicId, body);
    }

    @DeleteMapping("/{id}/topics/{topicId}")
    public ResponseEntity<Void> deleteTopic(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @PathVariable UUID topicId) {
        service.deleteTopic(me.id(), id, topicId);
        return ResponseEntity.noContent().build();
    }
}
