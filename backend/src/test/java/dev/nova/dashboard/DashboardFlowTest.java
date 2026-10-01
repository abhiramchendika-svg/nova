package dev.nova.dashboard;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

/** Home's aggregate end to end. Scores and wording are covered by PriorityScorerTest and DashboardWordingTest. */
class DashboardFlowTest extends AcademicsTestSupport {

    /** The test user's timezone is UTC (the default). */
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private static String from(Duration offset) {
        return Instant.now().truncatedTo(ChronoUnit.MINUTES).plus(offset).toString();
    }

    @Test
    void ranksWhatNeedsYouAndSummarisesTheSemester() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("home-rank"));
        String semesterId = idOf(postJson(session, "/api/v1/semesters", """
                        {"name":"Semester 3","ordinal":3,"gradingSchemeId":"%s","current":true,"attendanceTarget":75}"""
                        .formatted(TEN_POINT))
                .andExpect(status().isCreated())
                .andReturn());
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        // 6 of 10 attended: 60% against 75%, needs the next 6 classes
        putJson(session, "/api/v1/courses/" + dbms + "/attendance/baseline", """
                        {"conducted":10,"attended":6}""")
                .andExpect(status().isOk());

        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Overdue report","dueAt":"%s","priority":"HIGH"}"""
                        .formatted(dbms, from(Duration.ofHours(-50))))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Due soon","dueAt":"%s","priority":"LOW"}"""
                        .formatted(dbms, from(Duration.ofHours(10))))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Next week","dueAt":"%s","priority":"HIGH"}"""
                        .formatted(dbms, from(Duration.ofDays(5))))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/tasks", """
                        {"title":"Overdue form","dueAt":"%s"}""".formatted(from(Duration.ofHours(-30))))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Mid-semester 1","startsAt":"%sT09:00:00Z","topics":["Joins","Indexing"]}"""
                        .formatted(dbms, TODAY.plusDays(3)))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Final","startsAt":"%sT09:00:00Z","topics":["Everything"]}"""
                        .formatted(dbms, TODAY.plusDays(20)))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(TODAY.toString()))
                // 85 overdue high (2 days) · 80 attendance 15 points short · 73 overdue task (1 day)
                // · 56 exam in 3 days at 0% · 55 low assignment due within 24 h
                .andExpect(jsonPath("$.needsAttention[*].title")
                        .value(contains("Overdue report", "Database Systems", "Overdue form", "Mid-semester 1", "Due soon")))
                .andExpect(jsonPath("$.needsAttention[*].kind")
                        .value(contains(
                                "ASSIGNMENT_OVERDUE",
                                "ATTENDANCE_AT_RISK",
                                "TASK_OVERDUE",
                                "EXAM_PREP",
                                "ASSIGNMENT_DUE_SOON")))
                .andExpect(jsonPath("$.needsAttention[*].score").value(contains(85, 80, 73, 56, 55)))
                .andExpect(jsonPath("$.needsAttention[0].link").value("/app/academics/assignments?course=" + dbms))
                .andExpect(jsonPath("$.needsAttention[0].courseCode").value("Database Systems"))
                .andExpect(jsonPath("$.needsAttention[1].reason")
                        .value("60% · below your 75% target; attend the next 6 classes"))
                .andExpect(jsonPath("$.needsAttention[1].link").value("/app/academics/courses/" + dbms))
                .andExpect(jsonPath("$.needsAttention[2].link").value("/app/planner/tasks"))
                .andExpect(jsonPath("$.needsAttention[3].reason").value("In 3 days · 0 of 2 topics ready"))
                .andExpect(jsonPath("$.academics.semesterName").value("Semester 3"))
                .andExpect(jsonPath("$.academics.semesterId").value(semesterId))
                .andExpect(jsonPath("$.academics.credits").value(4.0))
                .andExpect(jsonPath("$.academics.gpa").doesNotExist())
                .andExpect(jsonPath("$.academics.lowestAttendance.courseName").value("Database Systems"))
                .andExpect(jsonPath("$.academics.lowestAttendance.percentage").value(60.0));
    }

    @Test
    void countsTodayAndThisWeeksTasks() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("home-planner"));
        String done = idOf(postJson(session, "/api/v1/tasks", """
                        {"title":"Done today","plannedFor":"%s"}""".formatted(TODAY))
                .andExpect(status().isCreated())
                .andReturn());
        postJson(session, "/api/v1/tasks", """
                        {"title":"Still open","plannedFor":"%s"}""".formatted(TODAY))
                .andExpect(status().isCreated());
        patchJson(session, "/api/v1/tasks/" + done + "/status", "{\"status\":\"DONE\"}").andExpect(status().isOk());

        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planner.openToday").value(1))
                .andExpect(jsonPath("$.planner.doneToday").value(1))
                .andExpect(jsonPath("$.planner.weekPlanned").value(2))
                .andExpect(jsonPath("$.planner.weekDone").value(1))
                // One day of history is not a streak worth showing
                .andExpect(jsonPath("$.planner.streakDays").doesNotExist())
                // No semester yet
                .andExpect(jsonPath("$.academics").doesNotExist())
                .andExpect(jsonPath("$.needsAttention", hasSize(0)));
    }

    @Test
    void showsOnlyYourOwnThings() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("home-owner"));
        postJson(owner, "/api/v1/tasks", """
                        {"title":"Mine","dueAt":"%s"}""".formatted(from(Duration.ofHours(-5))))
                .andExpect(status().isCreated());
        Cookie other = registerAndGetSession(uniqueEmail("home-other"));

        mvc.perform(get("/api/v1/dashboard").cookie(other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsAttention", hasSize(0)))
                .andExpect(jsonPath("$.planner.openToday").value(0));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/dashboard")).andExpect(status().isUnauthorized());
    }
}
