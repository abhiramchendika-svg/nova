package dev.nova.academics.grades;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** End-to-end GPA through the API. The arithmetic itself is covered in depth by GpaCalculatorTest. */
class GradesFlowTest extends AcademicsTestSupport {

    private static final String SUMMARY = "/api/v1/grades/summary";
    private static final String WHAT_IF = "/api/v1/grades/what-if";

    private static String overrides(String... courseAndGradePairs) {
        StringBuilder json = new StringBuilder("{\"overrides\":[");
        for (int i = 0; i < courseAndGradePairs.length; i += 2) {
            if (i > 0) {
                json.append(',');
            }
            json.append("{\"courseId\":\"").append(courseAndGradePairs[i])
                    .append("\",\"gradeDefinitionId\":\"").append(courseAndGradePairs[i + 1]).append("\"}");
        }
        return json.append("]}").toString();
    }

    @Test
    void newAccountHasNoGpaYet() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("grades-empty"));

        mvc.perform(get(SUMMARY).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cgpa").doesNotExist())
                .andExpect(jsonPath("$.projectedCgpa").doesNotExist())
                .andExpect(jsonPath("$.totalCredits").value(0.0))
                .andExpect(jsonPath("$.semesters", hasSize(0)))
                .andExpect(jsonPath("$.excluded", hasSize(0)));
    }

    @Test
    void summarisesOfficialAndProjectedGrades() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("grades-summary"));
        String s1 = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String s2 = createSemester(session, "Semester 2", 2, TEN_POINT, true);
        createGradedCourse(session, s1, "DBMS", "4", GRADE_O, "FINAL"); // 4 × 10
        createGradedCourse(session, s1, "OS", "3", GRADE_A, "FINAL"); // 3 × 8
        createGradedCourse(session, s2, "Compilers", "4", GRADE_A_PLUS, "EXPECTED"); // 4 × 9
        createCourse(session, s2, "Soft Skills", "2"); // not graded yet

        // Official: 64 / 7 = 9.142… → 9.14. Projected: (64 + 36) / 11 = 9.0909… → 9.09
        mvc.perform(get(SUMMARY).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cgpa").value(9.14))
                .andExpect(jsonPath("$.projectedCgpa").value(9.09))
                .andExpect(jsonPath("$.scale").value(10.0))
                .andExpect(jsonPath("$.cgpaUnavailableReason").doesNotExist())
                .andExpect(jsonPath("$.totalCredits").value(13.0))
                .andExpect(jsonPath("$.completedCredits").value(7.0))
                .andExpect(jsonPath("$.semesters", hasSize(2)))
                .andExpect(jsonPath("$.semesters[0].id").value(s1))
                .andExpect(jsonPath("$.semesters[0].gpa").value(9.14))
                .andExpect(jsonPath("$.semesters[0].credits").value(7.0))
                .andExpect(jsonPath("$.semesters[1].name").value("Semester 2"))
                .andExpect(jsonPath("$.semesters[1].current").value(true))
                .andExpect(jsonPath("$.semesters[1].gpa").doesNotExist())
                .andExpect(jsonPath("$.semesters[1].projectedGpa").value(9.0))
                .andExpect(jsonPath("$.semesters[1].hasExpectedGrades").value(true))
                .andExpect(jsonPath("$.semesters[1].credits").value(6.0));
    }

    @Test
    void refusesToAverageDifferentScales() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("grades-mixed"));
        String india = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String exchange = createSemester(session, "Exchange", 2, FOUR_POINT, true);
        createGradedCourse(session, india, "DBMS", "4", GRADE_O, "FINAL");
        createGradedCourse(session, exchange, "Databases", "3", US_A, "FINAL");

        mvc.perform(get(SUMMARY).cookie(session))
                .andExpect(jsonPath("$.cgpa").doesNotExist())
                .andExpect(jsonPath("$.cgpaUnavailableReason").value("MIXED_SCALES"))
                .andExpect(jsonPath("$.semesters[0].gpa").value(10.0))
                .andExpect(jsonPath("$.semesters[1].gpa").value(4.0))
                .andExpect(jsonPath("$.semesters[1].scale").value(4.0));
    }

    @Test
    void listsCoursesLeftOutOfGpaAndWhy() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("grades-excluded"));
        String graded = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String passFail = createSemester(session, "Bridge term", 2, PASS_FAIL, true);
        createGradedCourse(session, graded, "DBMS", "4", GRADE_B, "FINAL"); // 6
        String yoga = createGradedCourse(session, passFail, "Yoga", "1", PF_PASS, "FINAL");

        mvc.perform(get(SUMMARY).cookie(session))
                .andExpect(jsonPath("$.cgpa").value(6.0)) // the Pass/Fail term doesn't make scales "mixed"
                .andExpect(jsonPath("$.completedCredits").value(5.0)) // but its pass is completed
                .andExpect(jsonPath("$.excluded", hasSize(1)))
                .andExpect(jsonPath("$.excluded[0].courseId").value(yoga))
                .andExpect(jsonPath("$.excluded[0].courseName").value("Yoga"))
                .andExpect(jsonPath("$.excluded[0].semesterId").value(passFail))
                .andExpect(jsonPath("$.excluded[0].reason").value("GRADE_NOT_IN_GPA"));
    }

    @Test
    void failingGradeCountsAsZero() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("grades-fail"));
        String s1 = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        createGradedCourse(session, s1, "DBMS", "3", GRADE_A, "FINAL"); // 3 × 8
        createGradedCourse(session, s1, "Physics", "3", GRADE_F, "FINAL"); // 3 × 0

        mvc.perform(get(SUMMARY).cookie(session))
                .andExpect(jsonPath("$.cgpa").value(4.0))
                .andExpect(jsonPath("$.completedCredits").value(3.0));
    }

    @Test
    void whatIfProjectsWithoutSavingAnything() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("grades-whatif"));
        String s1 = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String dbms = createGradedCourse(session, s1, "DBMS", "4", GRADE_B, "FINAL"); // 6
        String os = createCourse(session, s1, "OS", "4");

        // DBMS as O (10) and OS as A (8): projected (40 + 32) / 8 = 9.00. Official stays 6.00.
        postJson(session, WHAT_IF, overrides(dbms, GRADE_O, os, GRADE_A))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cgpa").value(6.0))
                .andExpect(jsonPath("$.projectedCgpa").value(9.0))
                .andExpect(jsonPath("$.semesters[0].projectedGpa").value(9.0));

        mvc.perform(get(SUMMARY).cookie(session))
                .andExpect(jsonPath("$.cgpa").value(6.0))
                .andExpect(jsonPath("$.projectedCgpa").value(6.0));
        mvc.perform(get("/api/v1/courses/" + dbms).cookie(session)).andExpect(jsonPath("$.grade.label").value("B"));

        // No overrides: same as the summary
        postJson(session, WHAT_IF, overrides()).andExpect(status().isOk()).andExpect(jsonPath("$.cgpa").value(6.0));
    }

    @Test
    void whatIfRejectsCoursesAndGradesThatDontFit() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("grades-whatif-invalid"));
        Cookie other = registerAndGetSession(uniqueEmail("grades-whatif-other"));
        String s1 = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String dbms = createCourse(session, s1, "DBMS", "4");
        String othersCourse = createCourse(other, createSemester(other, "Semester 1", 1, TEN_POINT, true), "X", "3");

        postJson(session, WHAT_IF, overrides(UUID.randomUUID().toString(), GRADE_O))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("overrides[0].courseId"));
        postJson(session, WHAT_IF, overrides(othersCourse, GRADE_O))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("overrides[0].courseId"));
        postJson(session, WHAT_IF, overrides(dbms, US_A))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("overrides[0].gradeDefinitionId"));
        postJson(session, WHAT_IF, overrides(dbms, GRADE_O, dbms, GRADE_A))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("overrides[1].courseId"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(SUMMARY)).andExpect(status().isUnauthorized());
    }
}
