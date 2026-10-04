package dev.nova.insights;

import dev.nova.insights.InsightDtos.InsightsResponse;
import dev.nova.security.NovaUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Rule-based, traceable insights for this week or this month (docs/api.md §2.14). */
@RestController
public class InsightController {

    private final InsightService service;

    public InsightController(InsightService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/insights")
    public InsightsResponse insights(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(defaultValue = "WEEK") String window) {
        return service.insights(me.id(), InsightService.parseWindow(window));
    }
}
