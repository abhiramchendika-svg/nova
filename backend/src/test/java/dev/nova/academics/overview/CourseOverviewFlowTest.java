package dev.nova.academics.overview;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/** The course page's single request: previews plus counts, all scoped to one course. */
class CourseOverviewFlowTest extends AcademicsTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private static String noon(LocalDate day) {
        return OffsetDateTime.of(day.atTime(12, 0), ZoneOffset.UTC).toString();
    }

    private void assignment(Cookie session, String courseId, String title, LocalDate due) throws Exception {
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"%s","dueAt":"%s"}""".formatted(courseId, title, noon(due)))
                .andExpect(status().isCreated());
    }

    private void exam(Cookie session, String courseId, String title, LocalDate day) throws Exception {
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"%s","startsAt":"%s"}""".formatted(courseId, title, noon(day)))
                .andExpect(status().isCreated());
    }

    @Test
    void bringsTheWholeCourseTogether() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("ovw-flow"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String course = createCourse(session, semesterId, "Database Systems", "4");
        String elsewhere = createCourse(session, semesterId, "Compilers", "3");

        putJson(session, "/api/v1/courses/" + course + "/attendance/baseline", """
                        {"conducted":20,"attended":18}""")
                .andExpect(status().isOk());
        assignment(session, course, "Overdue", TODAY.minusDays(2));
        for (int i = 1; i <= 5; i++) {
            assignment(session, course, "Open " + i, TODAY.plusDays(i));
        }
        String doneId = idOf(postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Done","dueAt":"%s"}""".formatted(course, noon(TODAY.minusDays(5))))
                .andReturn());
        patchJson(session, "/api/v1/assignments/" + doneId + "/progress", """
                        {"status":"COMPLETED"}""")
                .andExpect(status().isOk());
        assignment(session, elsewhere, "Other course", TODAY.minusDays(1));
        exam(session, course, "Past quiz", TODAY.minusDays(3));
        for (int i = 1; i <= 4; i++) {
            exam(session, course, "Exam " + i, TODAY.plusDays(i * 7L));
        }
        exam(session, elsewhere, "Other exam", TODAY.plusDays(1));
        postJson(session, "/api/v1/courses/" + course + "/resources", """
                        {"title":"Syllabus","url":"https://example.edu/s.pdf"}""")
                .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/courses/" + course + "/overview").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.course.name").value("Database Systems"))
                .andExpect(jsonPath("$.attendance.conducted").value(20))
                .andExpect(jsonPath("$.attendance.percentage").value(90.0))
                .andExpect(jsonPath("$.openAssignments", hasSize(5)))
                .andExpect(jsonPath("$.openAssignments[0].title").value("Overdue"))
                .andExpect(jsonPath("$.openAssignments[0].urgency").value("OVERDUE"))
                .andExpect(jsonPath("$.openAssignments[4].title").value("Open 4"))
                .andExpect(jsonPath("$.openAssignmentCount").value(6))
                .andExpect(jsonPath("$.overdueCount").value(1))
                .andExpect(jsonPath("$.upcomingExams", hasSize(3)))
                .andExpect(jsonPath("$.upcomingExams[0].title").value("Exam 1"))
                .andExpect(jsonPath("$.upcomingExams[0].daysUntil").value(7))
                .andExpect(jsonPath("$.resources", hasSize(1)))
                .andExpect(jsonPath("$.resources[0].title").value("Syllabus"));
    }

    @Test
    void aNewCourseHasAnEmptyOverview() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("ovw-empty"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String course = createCourse(session, semesterId, "Compilers", "3");

        mvc.perform(get("/api/v1/courses/" + course + "/overview").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attendance.status").value("NO_TARGET"))
                .andExpect(jsonPath("$.openAssignments", hasSize(0)))
                .andExpect(jsonPath("$.openAssignmentCount").value(0))
                .andExpect(jsonPath("$.overdueCount").value(0))
                .andExpect(jsonPath("$.upcomingExams", hasSize(0)))
                .andExpect(jsonPath("$.resources", hasSize(0)));
    }

    @Test
    void anotherUsersCourseLooksLikeItDoesntExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("ovw-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("ovw-other"));
        String course = createCourse(owner, createSemester(owner, "Semester 1", 1, TEN_POINT, true), "Compilers", "3");

        mvc.perform(get("/api/v1/courses/" + course + "/overview").cookie(other)).andExpect(status().isNotFound());
    }
}
