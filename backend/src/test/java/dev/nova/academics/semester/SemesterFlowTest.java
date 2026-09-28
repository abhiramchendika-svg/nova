package dev.nova.academics.semester;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SemesterFlowTest extends AcademicsTestSupport {

    private static final String BASE = "/api/v1/semesters";

    @Test
    void createsAndListsSemestersInOrder() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("sem-list"));

        postJson(session, BASE, """
                        {"name":"  Semester 2 ","ordinal":2,"startsOn":"2026-01-05","endsOn":"2026-05-20",
                         "gradingSchemeId":"%s","current":false,"attendanceTarget":75}""".formatted(TEN_POINT))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith(BASE + "/")))
                .andExpect(jsonPath("$.name").value("Semester 2"))
                .andExpect(jsonPath("$.startsOn").value("2026-01-05"))
                .andExpect(jsonPath("$.attendanceTarget").value(75.0))
                .andExpect(jsonPath("$.gradingScheme.id").value(TEN_POINT))
                .andExpect(jsonPath("$.gradingScheme.name").value("10-point scale"));
        createSemester(session, "Semester 1", 1, TEN_POINT, false);

        mvc.perform(get(BASE).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].ordinal").value(1))
                .andExpect(jsonPath("$[1].ordinal").value(2))
                .andExpect(jsonPath("$[1].gradingScheme.maxPoints").value(10.0));
    }

    @Test
    void rejectsInvalidSemesters() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("sem-invalid"));
        createSemester(session, "Semester 1", 1, TEN_POINT, false);

        // Semester numbers are unique per user
        postJson(session, BASE, semesterJson("Again", 1, TEN_POINT, false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("ordinal"));

        // End date before start date
        postJson(session, BASE, """
                        {"name":"S2","ordinal":2,"startsOn":"2026-05-01","endsOn":"2026-04-01",
                         "gradingSchemeId":"%s","current":false}""".formatted(TEN_POINT))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("endsOn"));

        // A grading scheme that doesn't exist (or isn't yours)
        postJson(session, BASE, semesterJson("S2", 2, UUID.randomUUID().toString(), false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("gradingSchemeId"));

        // Bean Validation: blank name, ordinal out of range
        postJson(session, BASE, semesterJson(" ", 21, TEN_POINT, false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(2)));
    }

    @Test
    void onlyOneSemesterIsCurrentAtATime() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("sem-current"));
        String first = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String second = createSemester(session, "Semester 2", 2, TEN_POINT, true); // takes the flag

        mvc.perform(get(BASE).cookie(session))
                .andExpect(jsonPath("$[0].current").value(false))
                .andExpect(jsonPath("$[1].current").value(true));

        mvc.perform(post(BASE + "/" + first + "/make-current").cookie(session).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current").value(true));
        mvc.perform(get(BASE + "/" + second).cookie(session)).andExpect(jsonPath("$.current").value(false));

        // Making the current semester current again changes nothing
        mvc.perform(post(BASE + "/" + first + "/make-current").cookie(session).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current").value(true));

        // An update can move the flag too
        putJson(session, BASE + "/" + second, semesterJson("Semester 2", 2, TEN_POINT, true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current").value(true));
        mvc.perform(get(BASE + "/" + first).cookie(session)).andExpect(jsonPath("$.current").value(false));
    }

    @Test
    void updatesASemester() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("sem-update"));
        String id = createSemester(session, "Sem 1", 1, TEN_POINT, false);

        putJson(session, BASE + "/" + id, semesterJson("Semester 1 (Fall)", 3, FOUR_POINT, false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Semester 1 (Fall)"))
                .andExpect(jsonPath("$.ordinal").value(3))
                .andExpect(jsonPath("$.gradingScheme.id").value(FOUR_POINT));
    }

    @Test
    void refusesToSwitchSchemeWhileCoursesHaveGrades() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("sem-switch"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String courseId = createGradedCourse(session, semesterId, "DBMS", "4", GRADE_A, "FINAL");

        putJson(session, BASE + "/" + semesterId, semesterJson("Semester 1", 1, FOUR_POINT, false))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("RULE_VIOLATION"))
                .andExpect(jsonPath("$.errors[0].field").value("gradingSchemeId"));

        deleteAs(session, "/api/v1/courses/" + courseId + "/grade").andExpect(status().isNoContent());
        putJson(session, BASE + "/" + semesterId, semesterJson("Semester 1", 1, FOUR_POINT, false))
                .andExpect(status().isOk());
    }

    @Test
    void deletingASemesterDeletesItsCourses() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("sem-delete"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String courseId = createCourse(session, semesterId, "DBMS", "4");

        deleteAs(session, BASE + "/" + semesterId).andExpect(status().isNoContent());

        mvc.perform(get(BASE + "/" + semesterId).cookie(session)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/courses/" + courseId).cookie(session)).andExpect(status().isNotFound());
    }

    @Test
    void otherUsersSemestersLookLikeTheyDontExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("sem-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("sem-other"));
        String id = createSemester(owner, "Semester 1", 1, TEN_POINT, true);

        mvc.perform(get(BASE).cookie(other)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get(BASE + "/" + id).cookie(other)).andExpect(status().isNotFound());
        putJson(other, BASE + "/" + id, semesterJson("Mine", 1, TEN_POINT, false)).andExpect(status().isNotFound());
        mvc.perform(post(BASE + "/" + id + "/make-current").cookie(other).with(csrf()))
                .andExpect(status().isNotFound());
        deleteAs(other, BASE + "/" + id).andExpect(status().isNotFound());

        mvc.perform(get(BASE + "/" + id).cookie(owner)).andExpect(status().isOk()); // untouched
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }
}
