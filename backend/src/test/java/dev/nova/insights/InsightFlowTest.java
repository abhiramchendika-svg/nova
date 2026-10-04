package dev.nova.insights;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import org.junit.jupiter.api.Test;

/** The insights endpoint over real data. The test user's timezone is UTC and their week starts on Monday. */
class InsightFlowTest extends AcademicsTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);
    private static final LocalDate MONDAY = TODAY.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Test
    void aNewAccountGetsNoInsightsAndIsToldWhatEachRuleNeeds() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("insights-new"));

        mvc.perform(get("/api/v1/insights").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.window").value("WEEK"))
                .andExpect(jsonPath("$.from").value(MONDAY.toString()))
                .andExpect(jsonPath("$.to").value(TODAY.toString()))
                .andExpect(jsonPath("$.insights").isEmpty())
                .andExpect(jsonPath("$.quiet[*].rule", hasItem("TASK_COMPLETION")))
                .andExpect(jsonPath("$.quiet[*].rule", hasItem("DEADLINE_CLUSTER")))
                .andExpect(jsonPath("$.charts.tasksPerDay.length()")
                        .value((int) ChronoUnit.DAYS.between(MONDAY, TODAY) + 1))
                .andExpect(jsonPath("$.charts.deadlinesPerDay.length()").value(14));

        mvc.perform(get("/api/v1/insights?window=month").cookie(session))
                .andExpect(jsonPath("$.window").value("MONTH"))
                .andExpect(jsonPath("$.from").value(TODAY.withDayOfMonth(1).toString()));
        mvc.perform(get("/api/v1/insights?window=YEAR").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("window"));
    }

    @Test
    void tasksAndExamsTurnIntoInsightsWithTheirEvidence() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("insights-data"));
        for (int i = 1; i <= 5; i++) {
            String id = idOf(postJson(session, "/api/v1/tasks", """
                            {"title":"Planned %d","plannedFor":"%s"}""".formatted(i, TODAY))
                    .andExpect(status().isCreated())
                    .andReturn());
            if (i <= 4) {
                patchJson(session, "/api/v1/tasks/" + id + "/status", """
                                {"status":"DONE"}""")
                        .andExpect(status().isOk());
            }
        }
        String semesterId = createSemester(session, "Semester 3", 3, TEN_POINT, true);
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        String examId = idOf(postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Mid-semester 1","startsAt":"%sT09:00:00Z","topics":["Joins","Indexing"]}"""
                        .formatted(dbms, TODAY.plusDays(3)))
                .andExpect(status().isCreated())
                .andReturn());

        mvc.perform(get("/api/v1/insights").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.insights[?(@.rule == 'TASK_COMPLETION')].text")
                        .value("You completed 4 of 5 tasks planned this week (80%)."))
                .andExpect(jsonPath("$.insights[?(@.rule == 'TASK_COMPLETION')].severity").value("GOOD"))
                .andExpect(jsonPath("$.insights[?(@.rule == 'EXAM_PREP_GAP')].link").value("/app/academics/exams/" + examId))
                .andExpect(jsonPath("$.insights[?(@.rule == 'EXAM_STUDY_TIME')].severity").value("WARN"))
                // Warnings come first
                .andExpect(jsonPath("$.insights[0].severity").value("WARN"))
                .andExpect(jsonPath("$.charts.tasksPerDay[-1].planned").value(5))
                .andExpect(jsonPath("$.charts.tasksPerDay[-1].done").value(4))
                .andExpect(jsonPath("$.charts.deadlinesPerDay[3].exams").value(1));

        // Another user sees none of it
        Cookie other = registerAndGetSession(uniqueEmail("insights-other"));
        mvc.perform(get("/api/v1/insights").cookie(other)).andExpect(jsonPath("$.insights").isEmpty());
    }

    @Test
    void needsALogin() throws Exception {
        mvc.perform(get("/api/v1/insights")).andExpect(status().isUnauthorized());
    }
}
