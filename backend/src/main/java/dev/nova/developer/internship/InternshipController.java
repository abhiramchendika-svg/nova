package dev.nova.developer.internship;

import dev.nova.common.web.PageResponse;
import dev.nova.developer.internship.InternshipDtos.AnalyticsResponse;
import dev.nova.developer.internship.InternshipDtos.InternshipRequest;
import dev.nova.developer.internship.InternshipDtos.InternshipResponse;
import dev.nova.developer.internship.InternshipDtos.StatusRequest;
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
@RequestMapping("/api/v1/internships")
public class InternshipController {

    private final InternshipService service;

    public InternshipController(InternshipService service) {
        this.service = service;
    }

    /** Paged; {@code ?status=} may repeat. Most recently applied first, saved ones after. */
    @GetMapping
    public PageResponse<InternshipResponse> list(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(required = false) List<InternshipStatus> status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PageResponse.DEFAULT_SIZE) int size) {
        return service.list(me.id(), status, page, size);
    }

    /** {@code ?month=2026-09}; defaults to this month in the user's timezone. */
    @GetMapping("/analytics")
    public AnalyticsResponse analytics(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(required = false) String month) {
        return service.analytics(me.id(), month);
    }

    @GetMapping("/{id}")
    public InternshipResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<InternshipResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody InternshipRequest body) {
        InternshipResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/internships/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public InternshipResponse update(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @Valid @RequestBody InternshipRequest body) {
        return service.update(me.id(), id, body);
    }

    @PatchMapping("/{id}/status")
    public InternshipResponse changeStatus(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @Valid @RequestBody StatusRequest body) {
        return service.changeStatus(me.id(), id, body.status());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }
}
