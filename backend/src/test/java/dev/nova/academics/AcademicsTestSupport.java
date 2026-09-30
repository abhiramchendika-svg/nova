package dev.nova.academics;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import dev.nova.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Shared setup for academics flow tests. The built-in presets have fixed ids (migration V3), so
 * tests can refer to them directly.
 */
public abstract class AcademicsTestSupport extends IntegrationTest {

    protected static final String TEN_POINT = "00000000-0000-4000-8000-000000000001";
    protected static final String FOUR_POINT = "00000000-0000-4000-8000-000000000002";
    protected static final String PASS_FAIL = "00000000-0000-4000-8000-000000000003";

    // 10-point scale
    protected static final String GRADE_O = "00000000-0000-4000-8000-000000000101"; // 10
    protected static final String GRADE_A_PLUS = "00000000-0000-4000-8000-000000000102"; // 9
    protected static final String GRADE_A = "00000000-0000-4000-8000-000000000103"; // 8
    protected static final String GRADE_B = "00000000-0000-4000-8000-000000000105"; // 6
    protected static final String GRADE_F = "00000000-0000-4000-8000-000000000108"; // 0, failing
    // 4.0 scale
    protected static final String US_A = "00000000-0000-4000-8000-000000000201"; // 4.0
    // Pass/Fail
    protected static final String PF_PASS = "00000000-0000-4000-8000-000000000301";

    protected ResultActions postJson(Cookie session, String url, String json) throws Exception {
        return mvc.perform(
                post(url).cookie(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    protected ResultActions putJson(Cookie session, String url, String json) throws Exception {
        return mvc.perform(
                put(url).cookie(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    protected ResultActions patchJson(Cookie session, String url, String json) throws Exception {
        return mvc.perform(
                patch(url).cookie(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    protected ResultActions deleteAs(Cookie session, String url) throws Exception {
        return mvc.perform(delete(url).cookie(session).with(csrf()));
    }

    protected static String semesterJson(String name, int ordinal, String schemeId, boolean current) {
        return """
                {"name":"%s","ordinal":%d,"gradingSchemeId":"%s","current":%s}"""
                .formatted(name, ordinal, schemeId, current);
    }

    protected static String courseJson(String semesterId, String name, String credits) {
        return """
                {"semesterId":"%s","name":"%s","credits":%s}""".formatted(semesterId, name, credits);
    }

    protected static String gradeJson(String gradeId, String kind) {
        return """
                {"gradeDefinitionId":"%s","kind":"%s"}""".formatted(gradeId, kind);
    }

    /** Creates a semester and returns its id. */
    protected String createSemester(Cookie session, String name, int ordinal, String schemeId, boolean current)
            throws Exception {
        return idOf(postJson(session, "/api/v1/semesters", semesterJson(name, ordinal, schemeId, current))
                .andExpect(status().isCreated())
                .andReturn());
    }

    /** Creates a course and returns its id. */
    protected String createCourse(Cookie session, String semesterId, String name, String credits) throws Exception {
        return idOf(postJson(session, "/api/v1/courses", courseJson(semesterId, name, credits))
                .andExpect(status().isCreated())
                .andReturn());
    }

    /** Creates a course with a grade and returns its id. */
    protected String createGradedCourse(
            Cookie session, String semesterId, String name, String credits, String gradeId, String kind)
            throws Exception {
        String courseId = createCourse(session, semesterId, name, credits);
        putJson(session, "/api/v1/courses/" + courseId + "/grade", gradeJson(gradeId, kind))
                .andExpect(status().isOk());
        return courseId;
    }

    protected static String idOf(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }
}
