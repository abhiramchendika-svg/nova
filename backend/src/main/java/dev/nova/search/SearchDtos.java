package dev.nova.search;

import java.util.List;
import java.util.UUID;

/** Body for GET /api/v1/search (docs/api.md §2.14). */
public final class SearchDtos {

    private SearchDtos() {}

    /** One match: what it is, a short line of context, and where it lives in the app. */
    public record Hit(UUID id, String title, String subtitle, String link) {}

    /** Up to {@code limit} matches per kind, best first (title starts with the query, then A–Z). */
    public record SearchResponse(
            String q,
            List<Hit> courses,
            List<Hit> assignments,
            List<Hit> exams,
            List<Hit> tasks,
            List<Hit> projects,
            List<Hit> learningGoals,
            List<Hit> hackathons,
            List<Hit> internships) {}
}
