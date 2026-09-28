package dev.nova.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public liveness endpoint for the frontend and deploy checks (docs/api.md §2.1).
 * Infrastructure probes can also use Actuator's /actuator/health.
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final String version;

    public HealthController(@Value("${nova.version}") String version) {
        this.version = version;
    }

    @GetMapping
    public HealthResponse health() {
        return new HealthResponse("UP", version);
    }

    /** Response body. A record is an immutable DTO: no setters, generated equals/hashCode. */
    public record HealthResponse(String status, String version) {}
}
