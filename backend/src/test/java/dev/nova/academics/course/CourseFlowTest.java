package dev.nova.academics.course;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

class CourseFlowTest extends AcademicsTestSupport {

    private static final String BASE = "/api/v1/courses";

    private static String fullCourseJson(String semesterId, String code, String name, String credits, String faculty) {
        return """
                {"semesterId":"%s","code":"%s","name":"%s","credits":%s,"faculty":"%s",
                 "colorHue":210,"notes":"Lab on Fridays","attendanceTarget":80}"""
                .formatted(semesterId, code, name, credits, faculty);
    }

    @Test
    void createsReadsAndUpdatesACourse() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("course-crud"));
        String semesterId = createSemester(session, "Semester 3", 3, TEN_POINT, true);

        String id = idOf(postJson(session, BASE, fullCourseJson(semesterId, " CSE 201 ", " Database Systems ", "4", "  "))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("CSE 201"))
                .andExpect(jsonPath("$.name").value("Database Systems"))
                .andExpect(jsonPath("$.credits").value(4.0))
                .andExpect(jsonPath("$.faculty").doesNotExist()) // blank → not set
                .andExpect(jsonPath("$.colorHue").value(210))
                .andExpect(jsonPath("$.attendanceTarget").value(80.0))
                .andExpect(jsonPath("$.grade").doesNotExist())
                .andReturn());

        mvc.perform(get(BASE + "/" + id).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.semesterId").value(semesterId))
                .andExpect(jsonPath("$.notes").value("Lab on Fridays"));

        putJson(session, BASE + "/" + id, fullCourseJson(semesterId, "CSE 201", "DBMS", "4.5", "Dr. Rao"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("DBMS"))
                .andExpect(jsonPath("$.credits").value(4.5))
                .andExpect(jsonPath("$.faculty").value("Dr. Rao"));
    }

    @Test
    void listDefaultsToTheCurrentSemester() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("course-list"));
        String past = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String current = createSemester(session, "Semester 2", 2, TEN_POINT, true);
        createCourse(session, past, "Physics", "3");
        createCourse(session, current, "Operating Systems", "4");
        createCourse(session, current, "Compilers", "3");

        mvc.perform(get(BASE).cookie(session))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("Compilers")) // sorted by name
                .andExpect(jsonPath("$[1].name").value("Operating Systems"));

        mvc.perform(get(BASE).param("semesterId", past).cookie(session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Physics"));
    }

    @Test
    void listIsEmptyWithoutACurrentSemester() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("course-none"));
        createSemester(session, "Semester 1", 1, TEN_POINT, false);

        mvc.perform(get(BASE).cookie(session)).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void rejectsInvalidCourses() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("course-invalid"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);

        postJson(session, BASE, courseJson(semesterId, "Too many credits", "100"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("credits"));
        postJson(session, BASE, courseJson(semesterId, "Too precise", "3.25"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("credits"));
        postJson(session, BASE, courseJson(semesterId, " ", "3"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"));
    }

    @Test
    void cannotAddACourseToSomeoneElsesSemester() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("course-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("course-intruder"));
        String ownersSemester = createSemester(owner, "Semester 1", 1, TEN_POINT, true);

        postJson(other, BASE, courseJson(ownersSemester, "Sneaky", "3"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("semesterId"));
        mvc.perform(get(BASE).param("semesterId", ownersSemester).cookie(other)).andExpect(status().isNotFound());
    }

    @Test
    void otherUsersCoursesLookLikeTheyDontExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("course-owner2"));
        Cookie other = registerAndGetSession(uniqueEmail("course-other2"));
        String semesterId = createSemester(owner, "Semester 1", 1, TEN_POINT, true);
        String courseId = createCourse(owner, semesterId, "DBMS", "4");
        String othersSemester = createSemester(other, "Semester 1", 1, TEN_POINT, true);

        mvc.perform(get(BASE + "/" + courseId).cookie(other)).andExpect(status().isNotFound());
        putJson(other, BASE + "/" + courseId, courseJson(othersSemester, "Mine", "4")).andExpect(status().isNotFound());
        putJson(other, BASE + "/" + courseId + "/grade", gradeJson(GRADE_O, "FINAL")).andExpect(status().isNotFound());
        deleteAs(other, BASE + "/" + courseId + "/grade").andExpect(status().isNotFound());
        deleteAs(other, BASE + "/" + courseId).andExpect(status().isNotFound());

        mvc.perform(get(BASE + "/" + courseId).cookie(owner)).andExpect(jsonPath("$.name").value("DBMS"));
    }

    @Test
    void setsAndClearsAGrade() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("course-grade"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String courseId = createCourse(session, semesterId, "DBMS", "4");

        putJson(session, BASE + "/" + courseId + "/grade", gradeJson(GRADE_A_PLUS, "EXPECTED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grade.gradeDefinitionId").value(GRADE_A_PLUS))
                .andExpect(jsonPath("$.grade.label").value("A+"))
                .andExpect(jsonPath("$.grade.points").value(9.0))
                .andExpect(jsonPath("$.grade.passing").value(true))
                .andExpect(jsonPath("$.grade.kind").value("EXPECTED"));

        putJson(session, BASE + "/" + courseId + "/grade", gradeJson(GRADE_O, "FINAL"))
                .andExpect(jsonPath("$.grade.label").value("O"))
                .andExpect(jsonPath("$.grade.kind").value("FINAL"));
        mvc.perform(get(BASE).cookie(session)).andExpect(jsonPath("$[0].grade.label").value("O"));

        deleteAs(session, BASE + "/" + courseId + "/grade").andExpect(status().isNoContent());
        mvc.perform(get(BASE + "/" + courseId).cookie(session)).andExpect(jsonPath("$.grade").doesNotExist());
    }

    @Test
    void gradeMustComeFromTheSemestersScheme() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("course-foreign-grade"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String courseId = createCourse(session, semesterId, "DBMS", "4");

        putJson(session, BASE + "/" + courseId + "/grade", gradeJson(US_A, "FINAL"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("gradeDefinitionId"));
        putJson(session, BASE + "/" + courseId + "/grade", """
                        {"gradeDefinitionId":"%s"}""".formatted(GRADE_O))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("kind"));
    }

    @Test
    void movingAGradedCourseToAnotherSchemeIsRefused() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("course-move"));
        String tenPoint = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String alsoTenPoint = createSemester(session, "Semester 2", 2, TEN_POINT, false);
        String fourPoint = createSemester(session, "Exchange", 3, FOUR_POINT, true);
        String courseId = createGradedCourse(session, tenPoint, "DBMS", "4", GRADE_A, "FINAL");

        putJson(session, BASE + "/" + courseId, courseJson(fourPoint, "DBMS", "4"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors[0].field").value("semesterId"));

        putJson(session, BASE + "/" + courseId, courseJson(alsoTenPoint, "DBMS", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.semesterId").value(alsoTenPoint))
                .andExpect(jsonPath("$.grade.label").value("A"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }
}
