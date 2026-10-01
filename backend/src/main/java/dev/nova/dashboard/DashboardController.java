package dev.nova.dashboard;

import dev.nova.dashboard.DashboardDtos.DashboardResponse;
import dev.nova.security.NovaUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    /** Home for today, in the user's timezone. */
    @GetMapping
    public DashboardResponse dashboard(@AuthenticationPrincipal NovaUserDetails me) {
        return service.dashboard(me.id());
    }
}
