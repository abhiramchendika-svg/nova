package dev.nova.developer.github;

import dev.nova.developer.github.GitHubDtos.AccountRequest;
import dev.nova.developer.github.GitHubDtos.OverviewResponse;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** GitHub in public (username-only) mode (docs/api.md §2.13). OAuth comes later. */
@RestController
@RequestMapping("/api/v1/github")
public class GitHubController {

    private final GitHubService service;

    public GitHubController(GitHubService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public OverviewResponse overview(@AuthenticationPrincipal NovaUserDetails me) {
        return service.overview(me.id());
    }

    /** Checks the username with GitHub, then saves it and fetches its data. */
    @PutMapping("/account")
    public OverviewResponse connect(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody AccountRequest body) {
        return service.connect(me.id(), body.username());
    }

    @DeleteMapping("/account")
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal NovaUserDetails me) {
        service.disconnect(me.id());
        return ResponseEntity.noContent().build();
    }

    /** Fetches everything again now; at most once every five minutes (then 429 with Retry-After). */
    @PostMapping("/refresh")
    public OverviewResponse refresh(@AuthenticationPrincipal NovaUserDetails me) {
        return service.refresh(me.id());
    }
}
