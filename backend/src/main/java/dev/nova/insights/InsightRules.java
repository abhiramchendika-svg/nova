package dev.nova.insights;

import dev.nova.dashboard.DashboardService;
import dev.nova.insights.InsightDtos.Fact;
import dev.nova.insights.InsightDtos.Insight;
import dev.nova.insights.InsightDtos.Quiet;
import dev.nova.insights.InsightDtos.Source;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The insight rules (docs/api.md §2.14). Pure functions of plain inputs and "now", so each is
 * unit-tested without a database. Every insight carries the numbers it was computed from, the formula,
 * the records behind it and a link. A rule whose minimum data isn't there says so in {@code quiet}
 * instead of guessing; a rule with nothing worth saying stays silent.
 */
public final class InsightRules {

    public static final int MIN_PLANNED_TASKS = 5;
    public static final int MIN_DEADLINES = 3;
    public static final int MIN_HANDED_IN = 3;
    public static final int MIN_APPLICATIONS = 3;
    public static final int MIN_CONTRIBUTIONS = 5;
    public static final int MIN_CLASSES = 2;
    /** Attendance has to fall at least this many percentage points to be worth saying. */
    public static final BigDecimal ATTENDANCE_DROP = new BigDecimal("3.0");
    public static final int STALL_DAYS = 14;
    public static final int PREP_DAYS = 14;
    public static final int STUDY_DAYS = 10;
    public static final int AHEAD_DAYS = 7;
    public static final int CLASH_DAYS = 14;
    static final int MAX_SOURCES = 10;
    static final int MAX_PER_RULE = 3;

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);
    private static final DateTimeFormatter LONG_DAY = DateTimeFormatter.ofPattern("EEEE d MMM", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);

    private InsightRules() {}

    public enum Window {
        WEEK,
        MONTH;

        String phrase() {
            return this == WEEK ? "this week" : "this month";
        }
    }

    public enum Severity {
        WARN,
        INFO,
        GOOD
    }

    /** The rules, in the order ties are broken. */
    public enum Rule {
        BUSY_DAY_CLASH("Busy days that clash", "cross"),
        EXAM_PREP_GAP("Exam prep", "academics"),
        EXAM_STUDY_TIME("Study time before exams", "cross"),
        ATTENDANCE_DROP("Attendance trend", "academics"),
        DEADLINE_CLUSTER("Deadline clusters", "planner"),
        CARRIED_OVER("Tasks carried over", "planner"),
        TASK_COMPLETION("Task completion", "planner"),
        ON_TIME_SUBMISSIONS("On-time submissions", "academics"),
        STALLED_PROJECT("Project momentum", "developer"),
        INTERNSHIP_RESPONSE("Internship responses", "developer"),
        GITHUB_TREND("GitHub activity", "developer");

        final String title;
        final String domain;

        Rule(String title, String domain) {
            this.title = title;
            this.domain = domain;
        }
    }

    /** Where the rules write: insights that fired, and rules waiting for more data. */
    public static final class Findings {
        final List<Insight> insights = new ArrayList<>();
        final List<Quiet> quiet = new ArrayList<>();

        void add(Rule rule, String subject, Severity severity, String text, Evidence evidence, List<Source> sources, String link) {
            List<Source> shown = sources.size() > MAX_SOURCES ? sources.subList(0, MAX_SOURCES) : sources;
            insights.add(new Insight(
                    rule.name() + (subject == null ? "" : ":" + subject),
                    rule.name(),
                    rule.domain,
                    severity.name(),
                    text,
                    new InsightDtos.Evidence(evidence.from, evidence.to, evidence.facts, evidence.formula, evidence.note),
                    List.copyOf(shown),
                    sources.size() - shown.size(),
                    link));
        }

        void quiet(Rule rule, String reason) {
            quiet.add(new Quiet(rule.name(), rule.title, reason));
        }

        public List<Insight> insights() {
            return insights;
        }

        public List<Quiet> quiet() {
            return quiet;
        }

        /** Warnings first, then by rule order (Rule's declaration order), then as added. */
        public List<Insight> ranked() {
            return insights.stream()
                    .sorted(Comparator.comparingInt((Insight i) -> Severity.valueOf(i.severity()).ordinal())
                            .thenComparingInt(i -> Rule.valueOf(i.rule()).ordinal()))
                    .toList();
        }
    }

    record Evidence(LocalDate from, LocalDate to, List<Fact> facts, String formula, String note) {}

    /** The window and the user's clock. {@code from} is the first day of the window; it ends today. */
    public record Context(Window window, LocalDate from, LocalDate today, Instant now, ZoneId zone) {}

    // ───────────── inputs ─────────────

    public record TaskIn(
            UUID id,
            String title,
            LocalDate plannedFor,
            Instant dueAt,
            boolean done,
            Integer estimatedMinutes,
            UUID examId) {}

    /** {@code handedInAt}: submitted (or completed) time, null if not handed in. */
    public record AssignmentIn(UUID id, String title, String course, UUID courseId, Instant dueAt, boolean open, Instant handedInAt) {}

    public record ExamIn(UUID id, String title, String course, Instant startsAt, int topicsDone, int topicsTotal) {}

    /** Attendance counts (baseline included) at the start of the window and now. */
    public record AttendanceIn(
            UUID courseId,
            String course,
            int conductedBefore,
            int attendedBefore,
            int conductedNow,
            int attendedNow,
            boolean belowOrAtRiskNow) {}

    public record HackathonIn(UUID id, String name, LocalDate startsOn, LocalDate endsOn) {}

    /** {@code lastProgressAt}: the latest finished milestone, or when the project was added if none. */
    public record ProjectIn(UUID id, String name, int openMilestones, Instant lastProgressAt, boolean anyDone) {}

    public record MonthRate(YearMonth month, int applied, int responded) {}

    public record ContributionDay(LocalDate day, int count) {}

    // ───────────── planner ─────────────

    /** Of the tasks planned for a day in the window (up to today), how many are done. */
    public static void taskCompletion(Context c, List<TaskIn> plannedInWindow, Findings out) {
        int planned = plannedInWindow.size();
        if (planned < MIN_PLANNED_TASKS) {
            out.quiet(Rule.TASK_COMPLETION, "Needs " + MIN_PLANNED_TASKS + " tasks planned for days "
                    + c.window().phrase() + "; you have " + planned + ".");
            return;
        }
        int done = (int) plannedInWindow.stream().filter(TaskIn::done).count();
        int pct = percentInt(done, planned);
        Severity severity = pct >= 80 ? Severity.GOOD : pct >= 50 ? Severity.INFO : Severity.WARN;
        out.add(
                Rule.TASK_COMPLETION,
                null,
                severity,
                "You completed " + done + " of " + planned + " tasks planned " + c.window().phrase() + " (" + pct + "%).",
                new Evidence(
                        c.from(),
                        c.today(),
                        List.of(fact("Planned", planned), fact("Done", done), fact("Rate", pct + "%")),
                        "done ÷ planned, for tasks planned for a day from " + c.from() + " to today",
                        null),
                plannedInWindow.stream()
                        .sorted(Comparator.comparing(TaskIn::done)) // still open first
                        .map(InsightRules::task)
                        .toList(),
                calendarLink(c));
    }

    /** Tasks planned for an earlier day in the window that are still open. */
    public static void carriedOver(Context c, List<TaskIn> plannedInWindow, Findings out) {
        List<TaskIn> open = plannedInWindow.stream()
                .filter(t -> !t.done() && t.plannedFor() != null && t.plannedFor().isBefore(c.today()))
                .sorted(Comparator.comparing(TaskIn::plannedFor))
                .toList();
        if (open.size() < 2) {
            return;
        }
        out.add(
                Rule.CARRIED_OVER,
                null,
                open.size() >= 5 ? Severity.WARN : Severity.INFO,
                open.size() + " tasks planned for earlier days " + c.window().phrase() + " are still open.",
                new Evidence(
                        c.from(),
                        c.today().minusDays(1),
                        List.of(fact("Still open", open.size()), fact("Oldest", open.getFirst().plannedFor().format(DAY))),
                        "open tasks planned for a day from " + c.from() + " to yesterday",
                        "Move them to a new day or mark them done."),
                open.stream().map(InsightRules::task).toList(),
                "/app/planner/tasks");
    }

    /** The day with the most deadlines in the next 7 days, when it holds a good share of them. */
    public static void deadlineCluster(Context c, List<TaskIn> tasks, List<AssignmentIn> assignments, Findings out) {
        LocalDate last = c.today().plusDays(AHEAD_DAYS - 1L);
        Map<LocalDate, List<Source>> byDay = deadlinesByDay(c, tasks, assignments, c.today(), last);
        int total = byDay.values().stream().mapToInt(List::size).sum();
        if (total < MIN_DEADLINES) {
            out.quiet(Rule.DEADLINE_CLUSTER, "Needs " + MIN_DEADLINES
                    + " deadlines in the next 7 days to look for a cluster; you have " + total + ".");
            return;
        }
        Map.Entry<LocalDate, List<Source>> busiest = byDay.entrySet().stream()
                .max(Comparator.comparingInt((Map.Entry<LocalDate, List<Source>> e) -> e.getValue().size())
                        .thenComparing(Map.Entry::getKey, Comparator.reverseOrder()))
                .orElseThrow();
        int count = busiest.getValue().size();
        if (count < 2 || count * 10 < total * 4) {
            return; // spread out: nothing to say
        }
        List<Fact> facts = byDay.entrySet().stream()
                .map(e -> fact(e.getKey().format(DAY), e.getValue().size()))
                .toList();
        out.add(
                Rule.DEADLINE_CLUSTER,
                busiest.getKey().toString(),
                count >= 3 ? Severity.WARN : Severity.INFO,
                busiest.getKey().format(LONG_DAY) + " holds " + count + " of your " + total
                        + " deadlines in the next 7 days.",
                new Evidence(
                        c.today(),
                        last,
                        facts,
                        "open assignments and tasks due on each day, in your timezone; a cluster is a day with at least"
                                + " 2 of them and 40% of the total",
                        null),
                busiest.getValue(),
                "/app/planner/calendar?date=" + busiest.getKey());
    }

    // ───────────── academics ─────────────

    /** Courses whose attendance fell by at least {@link #ATTENDANCE_DROP} points since the window began. */
    public static void attendanceDrop(Context c, List<AttendanceIn> courses, Findings out) {
        if (courses.isEmpty()) {
            return;
        }
        record Drop(AttendanceIn a, BigDecimal before, BigDecimal now, BigDecimal fall) {}
        List<Drop> drops = new ArrayList<>();
        int enoughClasses = 0;
        for (AttendanceIn a : courses) {
            if (a.conductedNow() - a.conductedBefore() < MIN_CLASSES || a.conductedBefore() == 0) {
                continue;
            }
            enoughClasses++;
            BigDecimal before = percent(a.attendedBefore(), a.conductedBefore());
            BigDecimal now = percent(a.attendedNow(), a.conductedNow());
            BigDecimal fall = before.subtract(now);
            if (fall.compareTo(ATTENDANCE_DROP) >= 0) {
                drops.add(new Drop(a, before, now, fall));
            }
        }
        if (enoughClasses == 0) {
            out.quiet(Rule.ATTENDANCE_DROP, "Needs " + MIN_CLASSES + " classes marked in a course "
                    + c.window().phrase() + " to compare.");
            return;
        }
        drops.stream()
                .sorted(Comparator.comparing(Drop::fall).reversed())
                .limit(MAX_PER_RULE)
                .forEach(d -> out.add(
                        Rule.ATTENDANCE_DROP,
                        d.a().courseId().toString(),
                        d.a().belowOrAtRiskNow() ? Severity.WARN : Severity.INFO,
                        d.a().course() + " attendance fell from " + DashboardService.percent(d.before()) + " to "
                                + DashboardService.percent(d.now()) + " " + c.window().phrase() + ".",
                        new Evidence(
                                c.from(),
                                c.today(),
                                List.of(
                                        fact("At the start", DashboardService.percent(d.before()) + " ("
                                                + d.a().attendedBefore() + " of " + d.a().conductedBefore() + ")"),
                                        fact("Now", DashboardService.percent(d.now()) + " (" + d.a().attendedNow()
                                                + " of " + d.a().conductedNow() + ")"),
                                        fact("Classes since", d.a().conductedNow() - d.a().conductedBefore())),
                                "attended ÷ conducted (cancelled classes don't count), on " + c.from()
                                        + " and now",
                                null),
                        List.of(new Source("course", d.a().courseId(), d.a().course(), courseLink(d.a().courseId()))),
                        courseLink(d.a().courseId())));
    }

    /** Exams in the next 14 days with topics listed and less than half of them ready. */
    public static void examPrepGap(Context c, List<ExamIn> exams, Findings out) {
        Instant until = c.today().plusDays(PREP_DAYS + 1L).atStartOfDay(c.zone()).toInstant();
        List<ExamIn> behind = exams.stream()
                .filter(e -> e.startsAt().isAfter(c.now()) && e.startsAt().isBefore(until))
                .filter(e -> e.topicsTotal() > 0 && e.topicsDone() * 2 < e.topicsTotal())
                .sorted(Comparator.comparing(ExamIn::startsAt))
                .toList();
        if (behind.isEmpty()) {
            return;
        }
        String list = behind.stream()
                .limit(3)
                .map(e -> e.title() + " (" + e.topicsDone() + " of " + e.topicsTotal() + " topics)")
                .collect(Collectors.joining(", "));
        String more = behind.size() > 3 ? " and " + (behind.size() - 3) + " more" : "";
        out.add(
                Rule.EXAM_PREP_GAP,
                null,
                Severity.WARN,
                (behind.size() == 1 ? "1 exam" : behind.size() + " exams") + " in the next " + PREP_DAYS
                        + " days " + (behind.size() == 1 ? "is" : "are") + " less than half prepared: " + list + more
                        + ".",
                new Evidence(
                        c.today(),
                        c.today().plusDays(PREP_DAYS),
                        behind.stream()
                                .map(e -> fact(
                                        e.title() + " · " + localDay(e.startsAt(), c).format(DAY),
                                        e.topicsDone() + " of " + e.topicsTotal() + " topics"))
                                .toList(),
                        "topics ticked off ÷ topics listed, for exams in the next " + PREP_DAYS + " days",
                        null),
                behind.stream().map(InsightRules::exam).toList(),
                behind.size() == 1 ? examLink(behind.getFirst().id()) : "/app/academics/exams");
    }

    /** Of the assignments due in the window and handed in, how many were in by the deadline. */
    public static void onTimeSubmissions(Context c, List<AssignmentIn> dueInWindow, Findings out) {
        List<AssignmentIn> handedIn = dueInWindow.stream().filter(a -> a.handedInAt() != null).toList();
        if (handedIn.size() < MIN_HANDED_IN) {
            out.quiet(Rule.ON_TIME_SUBMISSIONS, "Needs " + MIN_HANDED_IN + " assignments due and handed in "
                    + c.window().phrase() + "; you have " + handedIn.size() + ".");
            return;
        }
        List<AssignmentIn> late = handedIn.stream().filter(a -> a.handedInAt().isAfter(a.dueAt())).toList();
        int onTime = handedIn.size() - late.size();
        int pct = percentInt(onTime, handedIn.size());
        Severity severity = late.isEmpty() ? Severity.GOOD : late.size() * 2 >= handedIn.size() ? Severity.WARN : Severity.INFO;
        List<Source> sources = new ArrayList<>(late.stream().map(InsightRules::assignment).toList());
        handedIn.stream().filter(a -> !late.contains(a)).map(InsightRules::assignment).forEach(sources::add);
        out.add(
                Rule.ON_TIME_SUBMISSIONS,
                null,
                severity,
                onTime + " of " + handedIn.size() + " assignments due " + c.window().phrase()
                        + " were handed in on time (" + pct + "%).",
                new Evidence(
                        c.from(),
                        c.today(),
                        List.of(fact("On time", onTime), fact("Late", late.size())),
                        "handed in at or before the deadline ÷ handed in, for assignments due from " + c.from()
                                + " to now",
                        null),
                sources,
                "/app/academics/assignments");
    }

    // ───────────── developer ─────────────

    /** Contributions so far this month against the same days of last month, from saved GitHub data. */
    public static void gitHubTrend(Context c, Instant fetchedAt, List<ContributionDay> days, Findings out) {
        if (fetchedAt == null) {
            out.quiet(Rule.GITHUB_TREND, "Needs the contribution calendar (a GitHub token on the server).");
            return;
        }
        LocalDate thisStart = c.today().withDayOfMonth(1);
        LocalDate lastStart = thisStart.minusMonths(1);
        LocalDate lastEnd = lastStart.plusDays(c.today().getDayOfMonth() - 1L);
        if (lastEnd.isAfter(thisStart.minusDays(1))) {
            lastEnd = thisStart.minusDays(1); // e.g. 31 Oct vs 30 Sep
        }
        int now = sum(days, thisStart, c.today());
        int before = sum(days, lastStart, lastEnd);
        if (before == 0 || now + before < MIN_CONTRIBUTIONS) {
            out.quiet(Rule.GITHUB_TREND, "Needs public contributions in both months (at least "
                    + MIN_CONTRIBUTIONS + " together); you have " + now + " this month and " + before
                    + " in the same days of last month.");
            return;
        }
        String thisRange = range(thisStart, c.today());
        String lastRange = range(lastStart, lastEnd);
        String change = now > before ? "up from" : now < before ? "down from" : "the same as";
        out.add(
                Rule.GITHUB_TREND,
                null,
                now > before ? Severity.GOOD : Severity.INFO,
                now + " public contributions in " + thisRange + ", " + change + " " + before + " in " + lastRange
                        + ".",
                new Evidence(
                        thisStart,
                        c.today(),
                        List.of(fact(thisRange, now), fact(lastRange, before)),
                        "public contributions on the same days of each month, from GitHub's contribution calendar",
                        "From GitHub, saved " + fetchedAt + "."),
                List.of(new Source("github", null, "GitHub contribution calendar", "/app/developer/github")),
                "/app/developer/github");
    }

    /** Projects in development with open milestones and none finished in {@link #STALL_DAYS} days. */
    public static void stalledProjects(Context c, List<ProjectIn> inDevelopment, Findings out) {
        Instant cutoff = c.now().minus(Duration.ofDays(STALL_DAYS));
        inDevelopment.stream()
                .filter(p -> p.openMilestones() > 0 && p.lastProgressAt().isBefore(cutoff))
                .sorted(Comparator.comparing(ProjectIn::lastProgressAt))
                .limit(MAX_PER_RULE)
                .forEach(p -> {
                    long days = ChronoUnit.DAYS.between(localDay(p.lastProgressAt(), c), c.today());
                    String link = "/app/developer/projects/" + p.id();
                    out.add(
                            Rule.STALLED_PROJECT,
                            p.id().toString(),
                            Severity.INFO,
                            p.anyDone()
                                    ? "No milestone finished on " + p.name() + " in " + days + " days."
                                    : "No milestone finished on " + p.name() + " since you added it " + days
                                            + " days ago.",
                            new Evidence(
                                    localDay(p.lastProgressAt(), c),
                                    c.today(),
                                    List.of(
                                            fact("Open milestones", p.openMilestones()),
                                            fact(
                                                    p.anyDone() ? "Last finished" : "Added",
                                                    localDay(p.lastProgressAt(), c).format(DAY))),
                                    "days since the latest finished milestone (or since the project was added);"
                                            + " shown after " + STALL_DAYS,
                                    null),
                            List.of(new Source("project", p.id(), p.name(), link)),
                            link);
                });
    }

    /** The response rate of applications sent this month against last month's. */
    public static void internshipResponse(Context c, MonthRate thisMonth, MonthRate lastMonth, boolean anyApplications, Findings out) {
        if (!anyApplications) {
            return;
        }
        if (thisMonth.applied() < MIN_APPLICATIONS || lastMonth.applied() < MIN_APPLICATIONS) {
            out.quiet(Rule.INTERNSHIP_RESPONSE, "Needs " + MIN_APPLICATIONS
                    + " applications sent in each of this month and last; you have " + thisMonth.applied()
                    + " and " + lastMonth.applied() + ".");
            return;
        }
        BigDecimal now = rate(thisMonth);
        BigDecimal before = rate(lastMonth);
        String thisName = thisMonth.month().format(MONTH);
        String lastName = lastMonth.month().format(MONTH);
        out.add(
                Rule.INTERNSHIP_RESPONSE,
                null,
                Severity.INFO,
                DashboardService.percent(now) + " of applications sent in " + thisName + " have had a response, vs "
                        + DashboardService.percent(before) + " of those sent in " + lastName + ".",
                new Evidence(
                        lastMonth.month().atDay(1),
                        c.today(),
                        List.of(
                                fact(thisName, thisMonth.responded() + " of " + thisMonth.applied()),
                                fact(lastName, lastMonth.responded() + " of " + lastMonth.applied())),
                        "responded / applied, for applications by the month they were sent; a response is an"
                                + " assessment, interview, offer or rejection",
                        "Applications sent recently have had less time to hear back."),
                List.of(new Source("internships", null, "Internship applications", "/app/developer/internships")),
                "/app/developer/internships");
    }

    // ───────────── across domains ─────────────

    /** Days in the next 14 with 2+ deadlines and an exam or a hackathon on the same day. */
    public static void busyDayClash(
            Context c,
            List<TaskIn> tasks,
            List<AssignmentIn> assignments,
            List<ExamIn> exams,
            List<HackathonIn> hackathons,
            Findings out) {
        LocalDate last = c.today().plusDays(CLASH_DAYS - 1L);
        Map<LocalDate, List<Source>> byDay = deadlinesByDay(c, tasks, assignments, c.today(), last);
        int found = 0;
        for (Map.Entry<LocalDate, List<Source>> e : byDay.entrySet()) {
            if (e.getValue().size() < 2 || found >= 2) {
                continue;
            }
            LocalDate day = e.getKey();
            List<ExamIn> examsThatDay = exams.stream()
                    .filter(x -> x.startsAt().isAfter(c.now()) && localDay(x.startsAt(), c).equals(day))
                    .toList();
            List<HackathonIn> running = hackathons.stream()
                    .filter(h -> h.startsOn() != null
                            && !day.isBefore(h.startsOn())
                            && !day.isAfter(h.endsOn() != null ? h.endsOn() : h.startsOn()))
                    .toList();
            if (examsThatDay.isEmpty() && running.isEmpty()) {
                continue;
            }
            found++;
            List<String> also = new ArrayList<>();
            examsThatDay.forEach(x -> also.add(x.title()));
            running.forEach(h -> also.add(h.name()));
            List<Source> sources = new ArrayList<>(e.getValue());
            examsThatDay.forEach(x -> sources.add(exam(x)));
            running.forEach(h -> sources.add(new Source("hackathon", h.id(), h.name(), "/app/developer/hackathons/" + h.id())));
            out.add(
                    Rule.BUSY_DAY_CLASH,
                    day.toString(),
                    Severity.WARN,
                    day.format(LONG_DAY) + " has " + e.getValue().size() + " deadlines and " + String.join(" and ", also)
                            + ".",
                    new Evidence(
                            day,
                            day,
                            List.of(
                                    fact("Deadlines", e.getValue().size()),
                                    fact("Exams", examsThatDay.size()),
                                    fact("Hackathons", running.size())),
                            "open assignments and tasks due that day, plus exams on it and hackathons running through it",
                            null),
                    sources,
                    "/app/planner/calendar?date=" + day);
        }
    }

    /** Exams in the next 10 days with topics still open: how much study is planned before each. */
    public static void examStudyTime(Context c, List<ExamIn> exams, List<TaskIn> studyTasks, Findings out) {
        Instant until = c.today().plusDays(STUDY_DAYS + 1L).atStartOfDay(c.zone()).toInstant();
        exams.stream()
                .filter(e -> e.startsAt().isAfter(c.now()) && e.startsAt().isBefore(until))
                .filter(e -> e.topicsTotal() > e.topicsDone())
                .sorted(Comparator.comparing(ExamIn::startsAt))
                .limit(MAX_PER_RULE)
                .forEach(e -> {
                    LocalDate examDay = localDay(e.startsAt(), c);
                    long days = ChronoUnit.DAYS.between(c.today(), examDay);
                    String when = days == 0 ? "today" : days == 1 ? "tomorrow" : "in " + days + " days";
                    List<TaskIn> planned = studyTasks.stream()
                            .filter(t -> e.id().equals(t.examId()) && !t.done() && t.plannedFor() != null)
                            .filter(t -> !t.plannedFor().isBefore(c.today()) && !t.plannedFor().isAfter(examDay))
                            .sorted(Comparator.comparing(TaskIn::plannedFor))
                            .toList();
                    int minutes = planned.stream()
                            .map(TaskIn::estimatedMinutes)
                            .filter(m -> m != null)
                            .mapToInt(Integer::intValue)
                            .sum();
                    int unestimated = (int) planned.stream().filter(t -> t.estimatedMinutes() == null).count();
                    int openTopics = e.topicsTotal() - e.topicsDone();
                    String text = planned.isEmpty()
                            ? "No study time planned before " + e.title() + " " + when + ", with " + openTopics
                                    + (openTopics == 1 ? " topic" : " topics") + " still to go."
                            : planned.size() + (planned.size() == 1 ? " study session" : " study sessions")
                                    + (minutes > 0 ? " (" + duration(minutes) + ")" : "") + " planned before "
                                    + e.title() + " " + when + ", for " + openTopics
                                    + (openTopics == 1 ? " topic" : " topics") + " still to go.";
                    List<Source> sources = new ArrayList<>();
                    sources.add(exam(e));
                    planned.forEach(t -> sources.add(task(t)));
                    out.add(
                            Rule.EXAM_STUDY_TIME,
                            e.id().toString(),
                            planned.isEmpty() ? Severity.WARN : Severity.INFO,
                            text,
                            new Evidence(
                                    c.today(),
                                    examDay,
                                    List.of(
                                            fact("Study tasks", planned.size()),
                                            fact("Estimated", minutes > 0 ? duration(minutes) : "—"),
                                            fact("Without an estimate", unestimated),
                                            fact("Topics to go", openTopics)),
                                    "open tasks linked to the exam and planned from today to the exam day",
                                    planned.isEmpty() ? "The exam page can spread its topics over the days before it." : null),
                            sources,
                            examLink(e.id()));
                });
    }

    // ───────────── charts ─────────────

    /** Tasks planned for and completed on each day of the window. */
    public static List<InsightDtos.DayTasks> tasksPerDay(
            LocalDate from, LocalDate to, List<TaskIn> planned, List<LocalDate> completedOn) {
        Map<LocalDate, Long> plannedBy = planned.stream()
                .filter(t -> t.plannedFor() != null)
                .collect(Collectors.groupingBy(TaskIn::plannedFor, Collectors.counting()));
        Map<LocalDate, Long> doneBy = completedOn.stream().collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        List<InsightDtos.DayTasks> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            out.add(new InsightDtos.DayTasks(d, plannedBy.getOrDefault(d, 0L).intValue(), doneBy.getOrDefault(d, 0L).intValue()));
        }
        return out;
    }

    /** Open deadlines and exams on each of the next {@code days} days. */
    public static List<InsightDtos.DayDeadlines> deadlinesPerDay(
            Context c, int days, List<TaskIn> tasks, List<AssignmentIn> assignments, List<ExamIn> exams) {
        LocalDate last = c.today().plusDays(days - 1L);
        Map<LocalDate, List<Source>> byDay = deadlinesByDay(c, tasks, assignments, c.today(), last);
        Map<LocalDate, Long> examsBy = exams.stream()
                .filter(e -> e.startsAt().isAfter(c.now()))
                .collect(Collectors.groupingBy(e -> localDay(e.startsAt(), c), Collectors.counting()));
        List<InsightDtos.DayDeadlines> out = new ArrayList<>();
        for (LocalDate d = c.today(); !d.isAfter(last); d = d.plusDays(1)) {
            out.add(new InsightDtos.DayDeadlines(
                    d, byDay.getOrDefault(d, List.of()).size(), examsBy.getOrDefault(d, 0L).intValue()));
        }
        return out;
    }

    // ───────────── helpers ─────────────

    /** Open assignments and tasks with a deadline from now to the end of {@code last}, by local day. */
    static Map<LocalDate, List<Source>> deadlinesByDay(
            Context c, List<TaskIn> tasks, List<AssignmentIn> assignments, LocalDate first, LocalDate last) {
        Map<LocalDate, List<Source>> byDay = new TreeMap<>();
        for (AssignmentIn a : assignments) {
            if (a.open() && a.dueAt() != null && !a.dueAt().isBefore(c.now())) {
                LocalDate d = localDay(a.dueAt(), c);
                if (!d.isBefore(first) && !d.isAfter(last)) {
                    byDay.computeIfAbsent(d, k -> new ArrayList<>()).add(assignment(a));
                }
            }
        }
        for (TaskIn t : tasks) {
            if (!t.done() && t.dueAt() != null && !t.dueAt().isBefore(c.now())) {
                LocalDate d = localDay(t.dueAt(), c);
                if (!d.isBefore(first) && !d.isAfter(last)) {
                    byDay.computeIfAbsent(d, k -> new ArrayList<>()).add(task(t));
                }
            }
        }
        return byDay;
    }

    static String calendarLink(Context c) {
        return "/app/planner/calendar?" + (c.window() == Window.MONTH ? "view=month&" : "") + "date=" + c.from();
    }

    private static Source task(TaskIn t) {
        return new Source("task", t.id(), t.title(), "/app/planner/tasks?task=" + t.id());
    }

    private static Source assignment(AssignmentIn a) {
        return new Source(
                "assignment",
                a.id(),
                a.course() == null ? a.title() : a.title() + " · " + a.course(),
                "/app/academics/assignments?course=" + a.courseId());
    }

    private static Source exam(ExamIn e) {
        return new Source("exam", e.id(), e.course() == null ? e.title() : e.title() + " · " + e.course(), examLink(e.id()));
    }

    private static String examLink(UUID id) {
        return "/app/academics/exams/" + id;
    }

    private static String courseLink(UUID id) {
        return "/app/academics/courses/" + id;
    }

    static LocalDate localDay(Instant at, Context c) {
        return LocalDate.ofInstant(at, c.zone());
    }

    private static Fact fact(String label, Object value) {
        return new Fact(label, String.valueOf(value));
    }

    /** Rounded half up to a whole percent. */
    static int percentInt(int part, int whole) {
        return (int) ((200L * part + whole) / (2L * whole));
    }

    /** One decimal, half up. */
    static BigDecimal percent(int part, int whole) {
        return BigDecimal.valueOf(part * 100L).divide(BigDecimal.valueOf(whole), 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal rate(MonthRate m) {
        return percent(m.responded(), m.applied());
    }

    private static int sum(List<ContributionDay> days, LocalDate from, LocalDate to) {
        return days.stream()
                .filter(d -> !d.day().isBefore(from) && !d.day().isAfter(to))
                .mapToInt(ContributionDay::count)
                .sum();
    }

    /** "1–3 Oct", or "1 Oct". */
    static String range(LocalDate from, LocalDate to) {
        String month = to.format(MONTH);
        return from.equals(to) ? to.getDayOfMonth() + " " + month : from.getDayOfMonth() + "–" + to.getDayOfMonth() + " " + month;
    }

    /** 210 → "3 h 30 min", 60 → "1 h", 45 → "45 min". */
    static String duration(int minutes) {
        int h = minutes / 60;
        int m = minutes % 60;
        if (h == 0) {
            return m + " min";
        }
        return m == 0 ? h + " h" : h + " h " + m + " min";
    }
}
