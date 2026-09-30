package dev.nova.academics.overview;

import dev.nova.security.NovaUserDetails;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CourseOverviewController {

    private final CourseOverviewService service;

    public CourseOverviewController(CourseOverviewService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/courses/{id}/overview")
    public CourseOverview overview(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.overview(me.id(), id);
    }
}
