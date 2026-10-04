package dev.nova.insights;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The body of GET /api/v1/insights (docs/api.md §2.14). */
public final class InsightDtos {

    private InsightDtos() {}

    /**
     * {@code insights}: ranked, warnings first. {@code quiet}: rules waiting for more data, with what
     * they need. {@code charts}: tasks per day in the window and deadlines per day ahead.
     */
    public record InsightsResponse(
            String window, LocalDate from, LocalDate to, List<Insight> insights, List<Quiet> quiet, Charts charts) {}

    /**
     * One finding. {@code id} is stable for the same rule and subject; {@code domain} is academics,
     * planner, developer or cross; {@code severity} is WARN, INFO or GOOD; {@code moreSources} counts
     * sources left out of the list.
     */
    public record Insight(
            String id,
            String rule,
            String domain,
            String severity,
            String text,
            Evidence evidence,
            List<Source> sources,
            int moreSources,
            String link) {}

    /** The numbers behind an insight, the dates they cover and how they were computed. */
    public record Evidence(LocalDate from, LocalDate to, List<Fact> facts, String formula, String note) {}

    public record Fact(String label, String value) {}

    /** A record the insight came from; {@code id} is null for aggregates (e.g. GitHub). */
    public record Source(String kind, UUID id, String label, String link) {}

    public record Quiet(String rule, String title, String reason) {}

    public record Charts(List<DayTasks> tasksPerDay, List<DayDeadlines> deadlinesPerDay) {}

    public record DayTasks(LocalDate date, int planned, int done) {}

    public record DayDeadlines(LocalDate date, int deadlines, int exams) {}
}
