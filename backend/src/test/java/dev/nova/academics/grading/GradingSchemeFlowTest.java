package dev.nova.academics.grading;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import com.jayway.jsonpath.JsonPath;
import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

class GradingSchemeFlowTest extends AcademicsTestSupport {

    private static final String BASE = "/api/v1/grading-schemes";

    /** A two-grade scheme: A (10, pass) and F (0, fail). */
    private static String simpleScheme(String name) {
        return """
                {"name":"%s","maxPoints":10,"grades":[
                  {"label":"A","points":10,"passing":true,"countsInGpa":true},
                  {"label":"F","points":0,"passing":false,"countsInGpa":true}]}""".formatted(name);
    }

    private static String schemeWithGrades(String name, String gradesJson) {
        return """
                {"name":"%s","maxPoints":10,"grades":[%s]}""".formatted(name, gradesJson);
    }

    private static String grade(String id, String label, String points, boolean passing) {
        String idPart = id == null ? "" : "\"id\":\"" + id + "\",";
        return "{" + idPart + "\"label\":\"" + label + "\",\"points\":" + points + ",\"passing\":" + passing
                + ",\"countsInGpa\":true}";
    }

    @Test
    void listsPresetsFirstThenOwnSchemes() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("schemes"));
        postJson(session, BASE, simpleScheme("My scale"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith(BASE + "/")))
                .andExpect(jsonPath("$.builtIn").value(false))
                .andExpect(jsonPath("$.grades", hasSize(2)));

        mvc.perform(get(BASE).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].id").value(TEN_POINT))
                .andExpect(jsonPath("$[0].builtIn").value(true))
                .andExpect(jsonPath("$[0].maxPoints").value(10.0))
                .andExpect(jsonPath("$[0].grades", hasSize(8)))
                .andExpect(jsonPath("$[0].grades[0].label").value("O"))
                .andExpect(jsonPath("$[0].grades[7].label").value("F"))
                .andExpect(jsonPath("$[0].grades[7].passing").value(false))
                .andExpect(jsonPath("$[1].id").value(FOUR_POINT))
                .andExpect(jsonPath("$[2].id").value(PASS_FAIL))
                .andExpect(jsonPath("$[2].grades[0].countsInGpa").value(false))
                .andExpect(jsonPath("$[3].name").value("My scale"));
    }

    @Test
    void rejectsInvalidSchemes() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("invalid-scheme"));

        // Labels must differ, ignoring case
        postJson(session, BASE, schemeWithGrades("Dup", grade(null, "A", "10", true) + "," + grade(null, "a", "9", true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("grades[1].label"));

        // No grade above the maximum
        postJson(session, BASE, schemeWithGrades("Too high", grade(null, "A", "11", true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("grades[0].points"));

        // At least one passing grade
        postJson(session, BASE, schemeWithGrades("No pass", grade(null, "F", "0", false)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("grades"));

        // At least one grade at all (Bean Validation)
        postJson(session, BASE, schemeWithGrades("Empty", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("grades"));
    }

    @Test
    void presetsAreReadOnly() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("preset-ro"));

        putJson(session, BASE + "/" + TEN_POINT, simpleScheme("Hacked")).andExpect(status().isNotFound());
        deleteAs(session, BASE + "/" + TEN_POINT).andExpect(status().isNotFound());
    }

    @Test
    void cloningAPresetMakesAnEditableCopy() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("clone"));

        String json = mvc.perform(post(BASE + "/" + TEN_POINT + "/clone").cookie(session).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("10-point scale (copy)"))
                .andExpect(jsonPath("$.builtIn").value(false))
                .andExpect(jsonPath("$.grades", hasSize(8)))
                .andExpect(jsonPath("$.grades[0].label").value("O"))
                .andExpect(jsonPath("$.grades[0].id", not(GRADE_O)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String copyId = JsonPath.read(json, "$.id");

        putJson(session, BASE + "/" + copyId, simpleScheme("SRM AP 10-point"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("SRM AP 10-point"));
    }

    @Test
    void otherUsersSchemesLookLikeTheyDontExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("owner"));
        Cookie other = registerAndGetSession(uniqueEmail("other"));
        String schemeId = idOf(postJson(owner, BASE, simpleScheme("Private")).andReturn());

        mvc.perform(get(BASE).cookie(other)).andExpect(jsonPath("$", hasSize(3))); // presets only
        putJson(other, BASE + "/" + schemeId, simpleScheme("Mine now")).andExpect(status().isNotFound());
        deleteAs(other, BASE + "/" + schemeId).andExpect(status().isNotFound());
        mvc.perform(post(BASE + "/" + schemeId + "/clone").cookie(other).with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatingPointsKeepsGradeIdsSoGradedCoursesFollow() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("update-points"));
        String json = postJson(session, BASE, simpleScheme("Mine")).andReturn().getResponse().getContentAsString();
        String schemeId = JsonPath.read(json, "$.id");
        String gradeA = JsonPath.read(json, "$.grades[0].id");
        String gradeF = JsonPath.read(json, "$.grades[1].id");
        String semesterId = createSemester(session, "Semester 1", 1, schemeId, true);
        createGradedCourse(session, semesterId, "DBMS", "4", gradeA, "FINAL");

        mvc.perform(get("/api/v1/grades/summary").cookie(session)).andExpect(jsonPath("$.cgpa").value(10.0));

        putJson(session, BASE + "/" + schemeId,
                        schemeWithGrades("Mine", grade(gradeA, "A", "9", true) + "," + grade(gradeF, "F", "0", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grades[0].id").value(gradeA));

        mvc.perform(get("/api/v1/grades/summary").cookie(session)).andExpect(jsonPath("$.cgpa").value(9.0));
    }

    @Test
    void swappingLabelsAndOrderBetweenExistingGradesWorks() throws Exception {
        // Exercises the deferred unique constraints: the swap is only valid once complete
        Cookie session = registerAndGetSession(uniqueEmail("swap"));
        String json = postJson(session, BASE, simpleScheme("Swap")).andReturn().getResponse().getContentAsString();
        String schemeId = JsonPath.read(json, "$.id");
        String gradeA = JsonPath.read(json, "$.grades[0].id");
        String gradeF = JsonPath.read(json, "$.grades[1].id");

        putJson(session, BASE + "/" + schemeId,
                        schemeWithGrades("Swap", grade(gradeF, "A", "10", true) + "," + grade(gradeA, "F", "0", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grades[0].id").value(gradeF))
                .andExpect(jsonPath("$.grades[0].label").value("A"))
                .andExpect(jsonPath("$.grades[1].id").value(gradeA))
                .andExpect(jsonPath("$.grades[1].label").value("F"));
    }

    @Test
    void addsAndRemovesUnusedGrades() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("add-remove"));
        String json = postJson(session, BASE, simpleScheme("Grow")).andReturn().getResponse().getContentAsString();
        String schemeId = JsonPath.read(json, "$.id");
        String gradeA = JsonPath.read(json, "$.grades[0].id");

        // Keep A, drop F, add B and a new F
        putJson(session, BASE + "/" + schemeId,
                        schemeWithGrades("Grow", grade(gradeA, "A", "10", true) + "," + grade(null, "B", "8", true)
                                + "," + grade(null, "F", "0", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grades", hasSize(3)))
                .andExpect(jsonPath("$.grades[1].label").value("B"))
                .andExpect(jsonPath("$.grades[2].label").value("F"));
    }

    @Test
    void refusesToRemoveAGradeThatACourseUses() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("in-use-grade"));
        String json = postJson(session, BASE, simpleScheme("Used")).andReturn().getResponse().getContentAsString();
        String schemeId = JsonPath.read(json, "$.id");
        String gradeA = JsonPath.read(json, "$.grades[0].id");
        String gradeF = JsonPath.read(json, "$.grades[1].id");
        String semesterId = createSemester(session, "Semester 1", 1, schemeId, false);
        createGradedCourse(session, semesterId, "DBMS", "4", gradeA, "FINAL");

        putJson(session, BASE + "/" + schemeId, schemeWithGrades("Used", grade(gradeF, "P", "5", true)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void rejectsGradeIdsFromAnotherScheme() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("foreign-id"));
        String schemeId = idOf(postJson(session, BASE, simpleScheme("Mine")).andReturn());

        putJson(session, BASE + "/" + schemeId, schemeWithGrades("Mine", grade(GRADE_O, "O", "10", true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("grades[0].id"));
    }

    @Test
    void refusesToDeleteASchemeASemesterUses() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("delete-scheme"));
        String schemeId = idOf(postJson(session, BASE, simpleScheme("Busy")).andReturn());
        String semesterId = createSemester(session, "Semester 1", 1, schemeId, false);

        deleteAs(session, BASE + "/" + schemeId).andExpect(status().isConflict());

        deleteAs(session, "/api/v1/semesters/" + semesterId).andExpect(status().isNoContent());
        deleteAs(session, BASE + "/" + schemeId).andExpect(status().isNoContent());
        mvc.perform(get(BASE).cookie(session)).andExpect(jsonPath("$", hasSize(3)));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }
}
