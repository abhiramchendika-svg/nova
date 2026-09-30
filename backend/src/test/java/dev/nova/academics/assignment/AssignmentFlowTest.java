package dev.nova.academics.assignment;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/** Assignments through the API. Urgency edge cases are covered by UrgencyTest, progress rules by AssignmentTest. */
class AssignmentFlowTest extends AcademicsTestSupport {

    /** The test user's timezone is UTC (the default). Deadlines are at noon to stay clear of day boundaries. */
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private static String noon(LocalDate day) {
        return OffsetDateTime.of(day.atTime(12, 0), ZoneOffset.UTC).toString();
    }

    private static String assignment(String courseId, String title, LocalDate due) {
        return """
                {"courseId":"%s","title":"%s","dueAt":"%s"}""".formatted(courseId, title, noon(due));
    }

    private String courseFor(Cookie session, String name) throws Exception {
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        return createCourse(session, semesterId, name, "4");
    }

    private String create(Cookie session, String courseId, String title, LocalDate due) throws Exception {
        return idOf(postJson(session, "/api/v1/assignments", assignment(courseId, title, due))
                .andExpect(status().isCreated())
                .andReturn());
    }

    @Test
    void createsAnAssignmentWithItsUrgency() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("asg-create"));
        String course = courseFor(session, "Database Systems");

        String id = idOf(postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"  ER diagram  ","description":"Draw it","dueAt":"%s","priority":"HIGH","estimatedMinutes":90}"""
                        .formatted(course, noon(TODAY.plusDays(1))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/assignments/")))
                .andExpect(jsonPath("$.title").value("ER diagram"))
                .andExpect(jsonPath("$.courseName").value("Database Systems"))
                .andExpect(jsonPath("$.priority").value("HIGH"))
                .andExpect(jsonPath("$.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.progressPct").value(0))
                .andExpect(jsonPath("$.estimatedMinutes").value(90))
                .andExpect(jsonPath("$.urgency").value("DUE_TOMORROW"))
                .andReturn());

        mvc.perform(get("/api/v1/assignments/" + id).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Draw it"))
                .andExpect(jsonPath("$.dueAt").exists());

        // Priority defaults to MEDIUM
        postJson(session, "/api/v1/assignments", assignment(course, "Quiz prep", TODAY.plusDays(3)))
                .andExpect(jsonPath("$.priority").value("MEDIUM"))
                .andExpect(jsonPath("$.urgency").value("THIS_WEEK"));
    }

    @Test
    void listsSoonestFirstWithFilters() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("asg-list"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        String os = createCourse(session, semesterId, "Operating Systems", "4");
        create(session, dbms, "Later", TODAY.plusDays(10));
        create(session, dbms, "Overdue", TODAY.minusDays(1));
        String done = create(session, os, "Done", TODAY.plusDays(2));
        patchJson(session, "/api/v1/assignments/" + done + "/progress", """
                        {"status":"COMPLETED"}""")
                .andExpect(status().isOk());

        mvc.perform(get("/api/v1/assignments").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].title").value("Overdue"))
                .andExpect(jsonPath("$.items[0].urgency").value("OVERDUE"))
                .andExpect(jsonPath("$.items[1].title").value("Done"))
                .andExpect(jsonPath("$.items[1].urgency").doesNotExist())
                .andExpect(jsonPath("$.items[2].title").value("Later"))
                .andExpect(jsonPath("$.items[2].urgency").value("LATER"))
                .andExpect(jsonPath("$.totalItems").value(3));

        // Open work only (status repeats)
        mvc.perform(get("/api/v1/assignments")
                        .param("status", "NOT_STARTED")
                        .param("status", "IN_PROGRESS")
                        .cookie(session))
                .andExpect(jsonPath("$.items", hasSize(2)));
        mvc.perform(get("/api/v1/assignments").param("courseId", os).cookie(session))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].title").value("Done"));
        // Due window [today 00:00, +5 days)
        mvc.perform(get("/api/v1/assignments")
                        .param("dueFrom", OffsetDateTime.of(TODAY.atStartOfDay(), ZoneOffset.UTC).toString())
                        .param("dueTo", noon(TODAY.plusDays(5)))
                        .cookie(session))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].title").value("Done"));
        mvc.perform(get("/api/v1/assignments").param("sort", "dueAt,desc").cookie(session))
                .andExpect(jsonPath("$.items[0].title").value("Later"));
        mvc.perform(get("/api/v1/assignments").param("sort", "title,asc").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("sort"));
        mvc.perform(get("/api/v1/assignments").param("size", "1").param("page", "1").cookie(session))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].title").value("Done"))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void progressAndStatusMoveTogether() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("asg-progress"));
        String id = create(session, courseFor(session, "Compilers"), "Parser", TODAY.plusDays(4));
        String progress = "/api/v1/assignments/" + id + "/progress";

        patchJson(session, progress, """
                        {"progressPct":50}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.progressPct").value(50));
        patchJson(session, progress, """
                        {"status":"SUBMITTED"}""")
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.submittedAt").exists())
                .andExpect(jsonPath("$.urgency").doesNotExist());
        patchJson(session, progress, """
                        {"status":"COMPLETED"}""")
                .andExpect(jsonPath("$.progressPct").value(100))
                .andExpect(jsonPath("$.completedAt").exists());
        patchJson(session, progress, """
                        {"status":"IN_PROGRESS","progressPct":70}""")
                .andExpect(jsonPath("$.completedAt").doesNotExist())
                .andExpect(jsonPath("$.submittedAt").doesNotExist())
                .andExpect(jsonPath("$.urgency").value("THIS_WEEK"));

        patchJson(session, progress, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("status"));
        patchJson(session, progress, """
                        {"progressPct":101}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("progressPct"));
    }

    @Test
    void updatesAndDeletes() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("asg-update"));
        String course = courseFor(session, "Compilers");
        String id = create(session, course, "Lexer", TODAY.plusDays(4));

        putJson(session, "/api/v1/assignments/" + id, """
                        {"courseId":"%s","title":"Lexer and parser","dueAt":"%s","priority":"LOW"}"""
                        .formatted(course, noon(TODAY.plusDays(20))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Lexer and parser"))
                .andExpect(jsonPath("$.priority").value("LOW"))
                .andExpect(jsonPath("$.urgency").value("LATER"));

        deleteAs(session, "/api/v1/assignments/" + id).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/assignments/" + id).cookie(session)).andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidAssignments() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("asg-invalid"));
        String course = courseFor(session, "Compilers");

        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":" ","dueAt":"%s"}""".formatted(course, noon(TODAY)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"No date"}""".formatted(course))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("dueAt"));
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Zero","dueAt":"%s","estimatedMinutes":0}"""
                        .formatted(course, noon(TODAY)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("estimatedMinutes"));
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Bad priority","dueAt":"%s","priority":"URGENT"}"""
                        .formatted(course, noon(TODAY)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void otherUsersAssignmentsLookLikeTheyDontExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("asg-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("asg-other"));
        String course = courseFor(owner, "Database Systems");
        String id = create(owner, course, "Mine", TODAY.plusDays(2));

        mvc.perform(get("/api/v1/assignments/" + id).cookie(other)).andExpect(status().isNotFound());
        putJson(other, "/api/v1/assignments/" + id, assignment(course, "Theirs", TODAY))
                .andExpect(status().isNotFound());
        patchJson(other, "/api/v1/assignments/" + id + "/progress", """
                        {"status":"COMPLETED"}""")
                .andExpect(status().isNotFound());
        deleteAs(other, "/api/v1/assignments/" + id).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/assignments").cookie(other)).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/api/v1/assignments").param("courseId", course).cookie(other))
                .andExpect(jsonPath("$.items", hasSize(0)));
        // Someone else's course can't be used, and the answer doesn't reveal it exists
        postJson(other, "/api/v1/assignments", assignment(course, "Sneaky", TODAY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("courseId"));

        mvc.perform(get("/api/v1/assignments/" + id).cookie(owner))
                .andExpect(jsonPath("$.status").value("NOT_STARTED")); // untouched
    }

    @Test
    void deletingACourseDeletesItsAssignments() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("asg-cascade"));
        String course = courseFor(session, "Compilers");
        String id = create(session, course, "Parser", TODAY.plusDays(2));

        deleteAs(session, "/api/v1/courses/" + course).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/assignments/" + id).cookie(session)).andExpect(status().isNotFound());
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/assignments")).andExpect(status().isUnauthorized());
    }
}
