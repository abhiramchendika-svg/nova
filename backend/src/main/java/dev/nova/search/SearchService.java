package dev.nova.search;

import dev.nova.academics.assignment.Assignment;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.exam.Exam;
import dev.nova.common.web.ApiException;
import dev.nova.developer.hackathon.Hackathon;
import dev.nova.developer.internship.Internship;
import dev.nova.developer.learning.LearningGoal;
import dev.nova.developer.project.Project;
import dev.nova.planner.task.Task;
import dev.nova.planner.task.TaskStatus;
import dev.nova.search.SearchDtos.Hit;
import dev.nova.search.SearchDtos.SearchResponse;
import dev.nova.user.UserClock;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Global search (the ⌘K palette): a case-insensitive "contains" match on titles and names, only
 * over the user's own records, a few per kind, those starting with the query first. It's a plain
 * LIKE: fine at a student's data size, and the query is escaped so % and _ match literally.
 */
@Service
public class SearchService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private final EntityManager em;
    private final CourseRepository courses;
    private final UserClock userClock;

    public SearchService(EntityManager em, CourseRepository courses, UserClock userClock) {
        this.em = em;
        this.courses = courses;
        this.userClock = userClock;
    }

    @Transactional(readOnly = true)
    public SearchResponse search(UUID userId, String rawQuery, int limit) {
        String q = rawQuery == null ? "" : rawQuery.strip();
        if (q.length() < SearchRules.MIN_QUERY) {
            throw ApiException.invalidField("q", "Type at least " + SearchRules.MIN_QUERY + " characters.");
        }
        if (q.length() > SearchRules.MAX_QUERY) {
            throw ApiException.invalidField("q", "Keep it under " + SearchRules.MAX_QUERY + " characters.");
        }
        if (limit < 1 || limit > SearchRules.MAX_LIMIT) {
            throw ApiException.invalidField("limit", "Must be between 1 and " + SearchRules.MAX_LIMIT + ".");
        }
        ZoneId zone = userClock.zoneOf(userId);
        Query query = new Query(userId, SearchRules.contains(q), SearchRules.startsWith(q), limit);

        List<Course> courseHits = query.find(Course.class, "name", "code");
        List<Assignment> assignmentHits = query.find(Assignment.class, "title");
        List<Exam> examHits = query.find(Exam.class, "title");
        Set<UUID> courseIds = new HashSet<>();
        assignmentHits.forEach(a -> courseIds.add(a.getCourseId()));
        examHits.forEach(e -> courseIds.add(e.getCourseId()));
        Map<UUID, Course> courseById = courseIds.isEmpty()
                ? Map.of()
                : courses.findAllById(courseIds).stream().collect(Collectors.toMap(Course::getId, Function.identity()));
        Function<UUID, String> courseLabel = id -> {
            Course c = courseById.get(id);
            return c == null ? null : c.getCode() != null ? c.getCode() : c.getName();
        };

        return new SearchResponse(
                q,
                courseHits.stream()
                        .map(c -> new Hit(c.getId(), c.getName(), c.getCode(), "/app/academics/courses/" + c.getId()))
                        .toList(),
                assignmentHits.stream()
                        .map(a -> new Hit(
                                a.getId(),
                                a.getTitle(),
                                join(courseLabel.apply(a.getCourseId()), "due " + day(a.getDueAt(), zone),
                                        SearchRules.label(a.getStatus())),
                                "/app/academics/assignments?course=" + a.getCourseId()))
                        .toList(),
                examHits.stream()
                        .map(e -> new Hit(
                                e.getId(),
                                e.getTitle(),
                                join(courseLabel.apply(e.getCourseId()), day(e.getStartsAt(), zone)),
                                "/app/academics/exams/" + e.getId()))
                        .toList(),
                query.find(Task.class, "title").stream()
                        .map(t -> new Hit(t.getId(), t.getTitle(), taskLine(t, zone), "/app/planner/tasks?task=" + t.getId()))
                        .toList(),
                query.find(Project.class, "name").stream()
                        .map(p -> new Hit(p.getId(), p.getName(), SearchRules.label(p.getStatus()),
                                "/app/developer/projects/" + p.getId()))
                        .toList(),
                query.find(LearningGoal.class, "title").stream()
                        .map(g -> new Hit(g.getId(), g.getTitle(), SearchRules.label(g.getStatus()),
                                "/app/developer/learning/" + g.getId()))
                        .toList(),
                query.find(Hackathon.class, "name").stream()
                        .map(h -> new Hit(h.getId(), h.getName(),
                                join(h.getStartsOn() == null ? null : h.getStartsOn().format(DAY),
                                        SearchRules.label(h.getStatus())),
                                "/app/developer/hackathons/" + h.getId()))
                        .toList(),
                query.find(Internship.class, "company", "role").stream()
                        .map(i -> new Hit(i.getId(), i.getRole() + " at " + i.getCompany(), SearchRules.label(i.getStatus()),
                                "/app/developer/internships/" + i.getId()))
                        .toList());
    }

    /** One JPQL search per kind; the field names are fixed in code, never taken from the request. */
    private final class Query {
        final UUID userId;
        final String contains;
        final String startsWith;
        final int limit;

        Query(UUID userId, String contains, String startsWith, int limit) {
            this.userId = userId;
            this.contains = contains;
            this.startsWith = startsWith;
            this.limit = limit;
        }

        <T> List<T> find(Class<T> type, String primary, String... others) {
            StringBuilder where = new StringBuilder("lower(x.").append(primary).append(") like :contains escape '!'");
            for (String field : others) {
                where.append(" or lower(x.").append(field).append(") like :contains escape '!'");
            }
            String jpql = "select x from " + type.getSimpleName() + " x where x.userId = :userId and (" + where
                    + ") order by case when lower(x." + primary + ") like :startsWith escape '!' then 0 else 1 end, lower(x."
                    + primary + "), x.id";
            return em.createQuery(jpql, type)
                    .setParameter("userId", userId)
                    .setParameter("contains", contains)
                    .setParameter("startsWith", startsWith)
                    .setMaxResults(limit)
                    .getResultList();
        }
    }

    private static String taskLine(Task t, ZoneId zone) {
        if (t.getStatus() == TaskStatus.DONE) {
            return "Done";
        }
        if (t.getPlannedFor() != null) {
            return "Planned " + t.getPlannedFor().format(DAY);
        }
        if (t.getDueAt() != null) {
            return "Due " + day(t.getDueAt(), zone);
        }
        return "Unscheduled";
    }

    private static String day(Instant at, ZoneId zone) {
        return LocalDate.ofInstant(at, zone).format(DAY);
    }

    private static String join(String... parts) {
        String joined = java.util.Arrays.stream(parts)
                .filter(p -> p != null && !p.isBlank())
                .collect(Collectors.joining(" · "));
        return joined.isEmpty() ? null : joined;
    }
}
