package dev.nova.academics.grading;

import dev.nova.academics.grading.GradingDtos.SchemeRequest;
import dev.nova.academics.grading.GradingDtos.SchemeResponse;
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
@RequestMapping("/api/v1/grading-schemes")
public class GradingSchemeController {

    private final GradingSchemeService service;

    public GradingSchemeController(GradingSchemeService service) {
        this.service = service;
    }

    @GetMapping
    public List<SchemeResponse> list(@AuthenticationPrincipal NovaUserDetails me) {
        return service.list(me.id());
    }

    @PostMapping
    public ResponseEntity<SchemeResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody SchemeRequest body) {
        return created(service.create(me.id(), body));
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<SchemeResponse> cloneScheme(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return created(service.cloneScheme(me.id(), id));
    }

    @PutMapping("/{id}")
    public SchemeResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody SchemeRequest body) {
        return service.update(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }

    private static ResponseEntity<SchemeResponse> created(SchemeResponse scheme) {
        return ResponseEntity.created(URI.create("/api/v1/grading-schemes/" + scheme.id())).body(scheme);
    }
}
