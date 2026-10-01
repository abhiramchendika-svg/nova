package dev.nova.planner.calendar;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import org.junit.jupiter.api.Test;

/** The calendar feed end to end. Date arithmetic is covered by CalendarRulesTest. */
class CalendarFlowTest extends AcademicsTestSupport {

    /** A Monday at least a week ahead, so "now" never matters. The test user's timezone is UTC. */
    private static final LocalDate MON =
            LocalDate.now(ZoneOffset.UTC).plusDays(7).with(TemporalAdjusters.next(DayOfWeek.MONDAY));

    private static String at(LocalDate day, String time) {
        return day + "T" + time + ":00Z";
    }

    @Test
    void bringsClassesExamsDeadlinesAndTasksTogether() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("cal-week"));
        // The term ends on Thursday, so Friday's lab is left out
        String semesterId = idOf(postJson(session, "/api/v1/semesters", """
                        {"name":"Semester 3","ordinal":3,"gradingSchemeId":"%s","current":true,
                         "startsOn":"%s","endsOn":"%s"}"""
                        .formatted(TEN_POINT, MON.minusDays(30), MON.plusDays(3)))
                .andExpect(status().isCreated())
                .andReturn());
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        postJson(session, "/api/v1/timetable", """
                        {"courseId":"%s","dayOfWeek":1,"startsAt":"09:00","endsAt":"09:50"}""".formatted(dbms))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/timetable", """
                        {"courseId":"%s","dayOfWeek":3,"startsAt":"14:00","endsAt":"16:00","kind":"LAB","location":"Lab 2"}"""
                        .formatted(dbms))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/timetable", """
                        {"courseId":"%s","dayOfWeek":5,"startsAt":"10:00","endsAt":"11:00"}""".formatted(dbms))
                .andExpect(status().isCreated());
        String exam = idOf(postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Mid-semester 1","kind":"MIDTERM","startsAt":"%s","durationMinutes":90}"""
                        .formatted(dbms, at(MON.plusDays(1), "10:00")))
                .andExpect(status().isCreated())
                .andReturn());
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"ER diagram","dueAt":"%s","priority":"HIGH"}"""
                        .formatted(dbms, at(MON.plusDays(2), "23:59")))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/tasks", """
                        {"title":"Revise joins","plannedFor":"%s","plannedStart":"18:00","estimatedMinutes":45}"""
                        .formatted(MON.plusDays(3)))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/tasks", """
                        {"title":"Read notes","plannedFor":"%s","estimatedMinutes":30}""".formatted(MON.plusDays(3)))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/tasks", """
                        {"title":"Submit form","dueAt":"%s"}""".formatted(at(MON.plusDays(4), "12:00")))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/tasks", """
                        {"title":"Same-day deadline","plannedFor":"%s","dueAt":"%s"}"""
                        .formatted(MON.plusDays(4), at(MON.plusDays(4), "17:00")))
                .andExpect(status().isCreated());
        String done = idOf(postJson(session, "/api/v1/tasks", """
                        {"title":"Laundry","plannedFor":"%s"}""".formatted(MON.plusDays(5)))
                .andExpect(status().isCreated())
                .andReturn());
        patchJson(session, "/api/v1/tasks/" + done + "/status", "{\"status\":\"DONE\"}").andExpect(status().isOk());
        // Outside the week: not shown
        postJson(session, "/api/v1/tasks", """
                        {"title":"Next week","plannedFor":"%s"}""".formatted(MON.plusDays(7)))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/calendar")
                        .param("from", MON.toString())
                        .param("to", MON.plusDays(6).toString())
                        .cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("UTC"))
                .andExpect(jsonPath("$.items[*].title")
                        .value(contains(
                                "Database Systems",
                                "Mid-semester 1",
                                "Database Systems",
                                "ER diagram",
                                "Read notes",
                                "Revise joins",
                                "Same-day deadline",
                                "Submit form",
                                "Laundry")))
                .andExpect(jsonPath("$.items[*].type")
                        .value(contains(
                                "CLASS", "EXAM", "CLASS", "ASSIGNMENT_DUE", "TASK", "TASK", "TASK", "TASK_DUE",
                                "TASK")))
                // Monday's lecture
                .andExpect(jsonPath("$.items[0].date").value(MON.toString()))
                .andExpect(jsonPath("$.items[0].startTime").value("09:00"))
                .andExpect(jsonPath("$.items[0].endTime").value("09:50"))
                .andExpect(jsonPath("$.items[0].courseId").value(dbms))
                .andExpect(jsonPath("$.items[0].kind").value("LECTURE"))
                // Tuesday's exam, 90 minutes
                .andExpect(jsonPath("$.items[1].refId").value(exam))
                .andExpect(jsonPath("$.items[1].startTime").value("10:00"))
                .andExpect(jsonPath("$.items[1].endTime").value("11:30"))
                .andExpect(jsonPath("$.items[1].kind").value("MIDTERM"))
                // Wednesday: the lab, then the deadline (a point in time: no end)
                .andExpect(jsonPath("$.items[2].location").value("Lab 2"))
                .andExpect(jsonPath("$.items[3].startTime").value("23:59"))
                .andExpect(jsonPath("$.items[3].endTime").doesNotExist())
                .andExpect(jsonPath("$.items[3].priority").value("HIGH"))
                // Thursday: the untimed task first, then the timed one sized by its estimate
                .andExpect(jsonPath("$.items[4].startTime").doesNotExist())
                .andExpect(jsonPath("$.items[5].startTime").value("18:00"))
                .andExpect(jsonPath("$.items[5].endTime").value("18:45"))
                // Saturday's finished task is still shown, marked done
                .andExpect(jsonPath("$.items[8].done").value(true))
                // How full each day is
                .andExpect(jsonPath("$.load", hasSize(7)))
                .andExpect(jsonPath("$.load[0].classMinutes").value(50))
                .andExpect(jsonPath("$.load[1].exams").value(1))
                .andExpect(jsonPath("$.load[2].classMinutes").value(120))
                .andExpect(jsonPath("$.load[2].deadlines").value(1))
                .andExpect(jsonPath("$.load[3].plannedTaskMinutes").value(75))
                .andExpect(jsonPath("$.load[4].deadlines").value(2))
                .andExpect(jsonPath("$.load[4].classMinutes").value(0))
                .andExpect(jsonPath("$.load[5].plannedTaskMinutes").value(0));
    }

    @Test
    void rejectsRangesThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("cal-invalid"));
        mvc.perform(get("/api/v1/calendar")
                        .param("from", MON.toString())
                        .param("to", MON.minusDays(1).toString())
                        .cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("to"));
        mvc.perform(get("/api/v1/calendar")
                        .param("from", MON.toString())
                        .param("to", MON.plusDays(62).toString())
                        .cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("to"));
        mvc.perform(get("/api/v1/calendar")
                        .param("from", MON.toString())
                        .param("to", MON.plusDays(61).toString())
                        .cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.load", hasSize(62)));
        mvc.perform(get("/api/v1/calendar").param("from", MON.toString()).cookie(session))
                .andExpect(status().isBadRequest());
    }

    @Test
    void showsOnlyYourOwnThings() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("cal-owner"));
        postJson(owner, "/api/v1/tasks", """
                        {"title":"Mine","plannedFor":"%s"}""".formatted(MON))
                .andExpect(status().isCreated());
        Cookie other = registerAndGetSession(uniqueEmail("cal-other"));

        mvc.perform(get("/api/v1/calendar")
                        .param("from", MON.toString())
                        .param("to", MON.plusDays(6).toString())
                        .cookie(other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/calendar").param("from", MON.toString()).param("to", MON.toString()))
                .andExpect(status().isUnauthorized());
    }
}
