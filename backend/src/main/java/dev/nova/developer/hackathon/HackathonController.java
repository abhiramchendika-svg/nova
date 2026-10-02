package dev.nova.developer.hackathon;

import dev.nova.developer.hackathon.HackathonDtos.HackathonRequest;
import dev.nova.developer.hackathon.HackathonDtos.HackathonResponse;
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

@RestController
@RequestMapping("/api/v1/hackathons")
public class HackathonController {

    private final HackathonService service;

    public HackathonController(HackathonService service) {
        this.service = service;
    }

    /** {@code ?status=} may repeat; none means every status. Upcoming first, then past. */
    @GetMapping
    public List<HackathonResponse> list(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(required = false) List<HackathonStatus> status) {
        return service.list(me.id(), status);
    }

    @GetMapping("/{id}")
    public HackathonResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<HackathonResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody HackathonRequest body) {
        HackathonResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/hackathons/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public HackathonResponse update(
            @AuthenticationPrincipal NovaUserDetails me,
            @PathVariable UUID id,
            @Valid @RequestBody HackathonRequest body) {
        return service.update(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }
}
