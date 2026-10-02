package dev.nova.search;

import dev.nova.search.SearchDtos.SearchResponse;
import dev.nova.security.NovaUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    private final SearchService service;

    public SearchController(SearchService service) {
        this.service = service;
    }

    /** {@code q}: 2–100 characters; {@code limit}: 1–10 per kind (default 5). */
    @GetMapping
    public SearchResponse search(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "" + SearchRules.DEFAULT_LIMIT) int limit) {
        return service.search(me.id(), q, limit);
    }
}
