package dev.nova.academics.semester;

import dev.nova.academics.semester.SemesterDtos.SemesterRequest;
import dev.nova.academics.semester.SemesterDtos.SemesterResponse;
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
@RequestMapping("/api/v1/semesters")
public class SemesterController {

    private final SemesterService service;

    public SemesterController(SemesterService service) {
        this.service = service;
    }

    @GetMapping
    public List<SemesterResponse> list(@AuthenticationPrincipal NovaUserDetails me) {
        return service.list(me.id());
    }

    @GetMapping("/{id}")
    public SemesterResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<SemesterResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody SemesterRequest body) {
        SemesterResponse semester = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/semesters/" + semester.id())).body(semester);
    }

    @PutMapping("/{id}")
    public SemesterResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody SemesterRequest body) {
        return service.update(me.id(), id, body);
    }

    @PostMapping("/{id}/make-current")
    public SemesterResponse makeCurrent(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.makeCurrent(me.id(), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }
}
