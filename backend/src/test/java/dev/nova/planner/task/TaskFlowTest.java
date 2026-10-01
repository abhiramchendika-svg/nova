package dev.nova.planner.task;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** Tasks end to end. Ordering and repeat-day rules are covered by TaskRankingTest and RecurrenceTest. */
class TaskFlowTest extends AcademicsTestSupport {

    /** The test user's timezone is UTC (the default). */
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private static String at(LocalDate day, int hour) {
        return OffsetDateTime.of(day.atTime(hour, 0), ZoneOffset.UTC).toString();
    }

    private String create(Cookie session, String json) throws Exception {
        return idOf(postJson(session, "/api/v1/tasks", json).andExpect(status().isCreated()).andReturn());
    }

    private String createCourse(Cookie session, String name) throws Exception {
        return createCourse(session, createSemester(session, "Semester 1", 1, TEN_POINT, true), name, "4");
    }

    private String createExam(Cookie session, String courseId, String title) throws Exception {
        return idOf(postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"%s","startsAt":"%s"}"""
                        .formatted(courseId, title, at(TODAY.plusDays(10), 9)))
                .andExpect(status().isCreated())
                .andReturn());
    }

    private static String read(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    @Test
    void createsATaskWithSensibleDefaults() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-create"));

        String id = idOf(postJson(session, "/api/v1/tasks", """
                        {"title":"  Renew library card  ","description":"   "}""")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/tasks/")))
                .andExpect(jsonPath("$.title").value("Renew library card"))
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.category").value("PERSONAL"))
                .andExpect(jsonPath("$.priority").value("MEDIUM"))
                .andExpect(jsonPath("$.status").value("TODO"))
                .andExpect(jsonPath("$.recurrence").value("NONE"))
                .andExpect(jsonPath("$.seriesId").doesNotExist())
                .andExpect(jsonPath("$.plannedFor").doesNotExist())
                .andExpect(jsonPath("$.overdue").value(false))
                .andExpect(jsonPath("$.urgency").doesNotExist())
                .andReturn());

        mvc.perform(get("/api/v1/tasks/" + id).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Renew library card"));

        postJson(session, "/api/v1/tasks", """
                        {"title":"Gym","category":"PERSONAL","priority":"LOW","plannedFor":"%s","plannedStart":"07:30",
                         "estimatedMinutes":45}""".formatted(TODAY.plusDays(1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.priority").value("LOW"))
                .andExpect(jsonPath("$.plannedFor").value(TODAY.plusDays(1).toString()))
                .andExpect(jsonPath("$.plannedStart").value("07:30"))
                .andExpect(jsonPath("$.estimatedMinutes").value(45));
    }

    @Test
    void linksCoursesAndExams() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-links"));
        String dbms = createCourse(session, "Database Systems");
        String exam = createExam(session, dbms, "Mid-semester 1");

        // A course makes it academic by default
        postJson(session, "/api/v1/tasks", """
                        {"title":"Lab record","courseId":"%s"}""".formatted(dbms))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("ACADEMIC"))
                .andExpect(jsonPath("$.courseId").value(dbms))
                .andExpect(jsonPath("$.courseName").value("Database Systems"));

        // An exam alone brings its course along
        postJson(session, "/api/v1/tasks", """
                        {"title":"Revise normalization","examId":"%s"}""".formatted(exam))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.examId").value(exam))
                .andExpect(jsonPath("$.examTitle").value("Mid-semester 1"))
                .andExpect(jsonPath("$.courseId").value(dbms))
                .andExpect(jsonPath("$.category").value("ACADEMIC"));

        // An explicit category wins
        postJson(session, "/api/v1/tasks", """
                        {"title":"Build the DB project","category":"PROJECT","courseId":"%s"}""".formatted(dbms))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("PROJECT"));
    }

    @Test
    void rejectsTasksThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-invalid"));
        String dbms = createCourse(session, "Database Systems");
        String semesterId = createSemester(session, "Semester 2", 2, TEN_POINT, false);
        String os = createCourse(session, semesterId, "Operating Systems", "4");
        String osExam = createExam(session, os, "OS mid");

        postJson(session, "/api/v1/tasks", """
                        {"title":"   "}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        postJson(session, "/api/v1/tasks", """
                        {"title":"x","plannedFor":"%s","plannedStart":"7:30"}""".formatted(TODAY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("plannedStart"));
        postJson(session, "/api/v1/tasks", """
                        {"title":"x","plannedStart":"07:30"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("plannedStart"));
        postJson(session, "/api/v1/tasks", """
                        {"title":"x","recurrence":"DAILY"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("plannedFor"));
        postJson(session, "/api/v1/tasks", """
                        {"title":"x","estimatedMinutes":0}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("estimatedMinutes"));
        postJson(session, "/api/v1/tasks", """
                        {"title":"x","category":"CHORES"}""")
                .andExpect(status().isBadRequest());
        // The exam must belong to the linked course
        postJson(session, "/api/v1/tasks", """
                        {"title":"x","courseId":"%s","examId":"%s"}""".formatted(dbms, osExam))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("examId"));

        mvc.perform(get("/api/v1/tasks").cookie(session)).andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    void todayShowsWhatNeedsDoingInOrder() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-today"));
        create(session, """
                {"title":"Today, high","priority":"HIGH","plannedFor":"%s"}""".formatted(TODAY));
        create(session, """
                {"title":"Carried over","plannedFor":"%s"}""".formatted(TODAY.minusDays(1)));
        create(session, """
                {"title":"Overdue","priority":"LOW","dueAt":"%s"}""".formatted(at(TODAY.minusDays(2), 9)));
        create(session, """
                {"title":"Tomorrow","plannedFor":"%s"}""".formatted(TODAY.plusDays(1)));
        create(session, """
                {"title":"Someday"}""");
        String done = create(session, """
                {"title":"Done today","plannedFor":"%s"}""".formatted(TODAY));
        patchJson(session, "/api/v1/tasks/" + done + "/status", """
                        {"status":"DONE"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.task.status").value("DONE"))
                .andExpect(jsonPath("$.task.completedAt").exists())
                .andExpect(jsonPath("$.nextInstance").doesNotExist());

        mvc.perform(get("/api/v1/tasks/today").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(TODAY.toString()))
                .andExpect(jsonPath("$.tasks[*].title").value(contains("Overdue", "Today, high", "Carried over")))
                .andExpect(jsonPath("$.tasks[0].overdue").value(true))
                .andExpect(jsonPath("$.tasks[0].urgency").value("OVERDUE"))
                .andExpect(jsonPath("$.completed[*].title").value(contains("Done today")));

        // Another day can be asked for; open work planned up to it is included
        mvc.perform(get("/api/v1/tasks/today").param("date", TODAY.plusDays(1).toString()).cookie(session))
                .andExpect(jsonPath("$.date").value(TODAY.plusDays(1).toString()))
                .andExpect(jsonPath("$.tasks", hasSize(4)))
                .andExpect(jsonPath("$.completed", hasSize(0)));
    }

    @Test
    void upcomingGroupsByDayAndListsUnscheduledWork() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-upcoming"));
        create(session, """
                {"title":"Today","plannedFor":"%s"}""".formatted(TODAY));
        create(session, """
                {"title":"Evening","plannedFor":"%s","plannedStart":"18:00"}""".formatted(TODAY.plusDays(2)));
        create(session, """
                {"title":"Morning","plannedFor":"%s","plannedStart":"07:00"}""".formatted(TODAY.plusDays(2)));
        create(session, """
                {"title":"Due in five","dueAt":"%s"}""".formatted(at(TODAY.plusDays(5), 12)));
        create(session, """
                {"title":"Far away","plannedFor":"%s"}""".formatted(TODAY.plusDays(20)));
        create(session, """
                {"title":"Someday"}""");

        mvc.perform(get("/api/v1/tasks/upcoming").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(TODAY.plusDays(1).toString()))
                .andExpect(jsonPath("$.to").value(TODAY.plusDays(14).toString()))
                .andExpect(jsonPath("$.days", hasSize(2)))
                .andExpect(jsonPath("$.days[0].date").value(TODAY.plusDays(2).toString()))
                .andExpect(jsonPath("$.days[0].tasks[*].title").value(contains("Morning", "Evening")))
                .andExpect(jsonPath("$.days[1].date").value(TODAY.plusDays(5).toString()))
                .andExpect(jsonPath("$.days[1].tasks[*].title").value(contains("Due in five")))
                .andExpect(jsonPath("$.unscheduled[*].title").value(contains("Someday")));

        mvc.perform(get("/api/v1/tasks/upcoming").param("days", "30").cookie(session))
                .andExpect(jsonPath("$.days", hasSize(3)));
        mvc.perform(get("/api/v1/tasks/upcoming").param("days", "0").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("days"));
        mvc.perform(get("/api/v1/tasks/upcoming").param("days", "63").cookie(session))
                .andExpect(status().isBadRequest());
    }

    @Test
    void completingARepeatingTaskPlansTheNextOneOnce() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-repeat"));
        MvcResult created = postJson(session, "/api/v1/tasks", """
                        {"title":"Leetcode","recurrence":"DAILY","plannedFor":"%s","plannedStart":"21:00","dueAt":"%s"}"""
                        .formatted(TODAY, at(TODAY, 23)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seriesId").exists())
                .andReturn();
        String id = read(created, "$.id");
        String series = read(created, "$.seriesId");

        MvcResult completed = patchJson(session, "/api/v1/tasks/" + id + "/status", """
                        {"status":"DONE"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.task.status").value("DONE"))
                .andExpect(jsonPath("$.nextInstance.seriesId").value(series))
                .andExpect(jsonPath("$.nextInstance.plannedFor").value(TODAY.plusDays(1).toString()))
                .andExpect(jsonPath("$.nextInstance.plannedStart").value("21:00"))
                .andExpect(jsonPath("$.nextInstance.dueAt", startsWith(TODAY.plusDays(1) + "T23:00")))
                .andExpect(jsonPath("$.nextInstance.status").value("TODO"))
                .andReturn();
        String next = read(completed, "$.nextInstance.id");

        // Reopen and complete again: tomorrow's repeat already exists, so no duplicate
        patchJson(session, "/api/v1/tasks/" + id + "/status", """
                        {"status":"TODO"}""")
                .andExpect(jsonPath("$.task.completedAt").doesNotExist());
        patchJson(session, "/api/v1/tasks/" + id + "/status", """
                        {"status":"DONE"}""")
                .andExpect(jsonPath("$.nextInstance").doesNotExist());
        mvc.perform(get("/api/v1/tasks").cookie(session)).andExpect(jsonPath("$.totalItems").value(2));

        // Two repeats can't share a day
        putJson(session, "/api/v1/tasks/" + next, """
                        {"title":"Leetcode","recurrence":"DAILY","plannedFor":"%s"}""".formatted(TODAY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        putJson(session, "/api/v1/tasks/" + next, """
                        {"title":"Leetcode (2 problems)","recurrence":"DAILY","plannedFor":"%s"}"""
                        .formatted(TODAY.plusDays(2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Leetcode (2 problems)"))
                .andExpect(jsonPath("$.seriesId").value(series));
    }

    @Test
    void deletesOneTaskOrTheRestOfASeries() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-delete"));
        String first = create(session, """
                {"title":"Journal","recurrence":"DAILY","plannedFor":"%s"}""".formatted(TODAY));
        String second = read(
                patchJson(session, "/api/v1/tasks/" + first + "/status", "{\"status\":\"DONE\"}").andReturn(),
                "$.nextInstance.id");
        String third = read(
                patchJson(session, "/api/v1/tasks/" + second + "/status", "{\"status\":\"DONE\"}").andReturn(),
                "$.nextInstance.id");
        String fourth = read(
                patchJson(session, "/api/v1/tasks/" + third + "/status", "{\"status\":\"DONE\"}").andReturn(),
                "$.nextInstance.id");
        patchJson(session, "/api/v1/tasks/" + third + "/status", "{\"status\":\"TODO\"}").andExpect(status().isOk());
        String single = create(session, """
                {"title":"One-off"}""");

        // Deleting the second repeat with its series: it and the open repeats after it go; done history stays
        deleteAs(session, "/api/v1/tasks/" + second + "?series=true").andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks/" + third).cookie(session)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/tasks/" + fourth).cookie(session)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/tasks/" + first).cookie(session)).andExpect(status().isOk());

        deleteAs(session, "/api/v1/tasks/" + single).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks").cookie(session))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first));
    }

    @Test
    void listsWithFiltersSortingAndCompletedHistory() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-list"));
        String dbms = createCourse(session, "Database Systems");
        create(session, """
                {"title":"Later","category":"CODING","plannedFor":"%s"}""".formatted(TODAY.plusDays(3)));
        create(session, """
                {"title":"Sooner","category":"CODING","plannedFor":"%s"}""".formatted(TODAY.plusDays(1)));
        create(session, """
                {"title":"Undated","category":"CODING"}""");
        String course = create(session, """
                {"title":"Course work","courseId":"%s"}""".formatted(dbms));
        patchJson(session, "/api/v1/tasks/" + course + "/status", "{\"status\":\"IN_PROGRESS\"}")
                .andExpect(jsonPath("$.task.completedAt").doesNotExist());

        mvc.perform(get("/api/v1/tasks").param("category", "CODING").param("sort", "plannedFor,asc").cookie(session))
                .andExpect(jsonPath("$.items[*].title").value(contains("Sooner", "Later", "Undated")));
        mvc.perform(get("/api/v1/tasks").param("courseId", dbms).cookie(session))
                .andExpect(jsonPath("$.items[*].title").value(contains("Course work")));
        mvc.perform(get("/api/v1/tasks").param("status", "IN_PROGRESS", "DONE").cookie(session))
                .andExpect(jsonPath("$.items[*].title").value(contains("Course work")));
        mvc.perform(get("/api/v1/tasks").param("sort", "title,asc").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("sort"));

        patchJson(session, "/api/v1/tasks/" + course + "/status", "{\"status\":\"DONE\"}");
        mvc.perform(get("/api/v1/tasks/completed").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title").value(contains("Course work")))
                .andExpect(jsonPath("$.items[0].urgency").doesNotExist())
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/v1/tasks/completed").param("size", "101").cookie(session))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deletingACourseOrExamKeepsTheTask() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("task-unlink"));
        String dbms = createCourse(session, "Database Systems");
        String exam = createExam(session, dbms, "Mid-semester 1");
        String task = create(session, """
                {"title":"Revise","examId":"%s"}""".formatted(exam));

        deleteAs(session, "/api/v1/exams/" + exam).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks/" + task).cookie(session))
                .andExpect(jsonPath("$.examId").doesNotExist())
                .andExpect(jsonPath("$.courseId").value(dbms));

        deleteAs(session, "/api/v1/courses/" + dbms).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks/" + task).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.courseId").doesNotExist())
                .andExpect(jsonPath("$.category").value("ACADEMIC"));
    }

    @Test
    void usersOnlySeeTheirOwnTasks() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("task-owner"));
        String dbms = createCourse(owner, "Database Systems");
        String exam = createExam(owner, dbms, "Mid-semester 1");
        String task = create(owner, """
                {"title":"Mine","plannedFor":"%s"}""".formatted(TODAY));

        Cookie other = registerAndGetSession(uniqueEmail("task-other"));
        mvc.perform(get("/api/v1/tasks/" + task).cookie(other)).andExpect(status().isNotFound());
        putJson(other, "/api/v1/tasks/" + task, "{\"title\":\"Stolen\"}").andExpect(status().isNotFound());
        patchJson(other, "/api/v1/tasks/" + task + "/status", "{\"status\":\"DONE\"}")
                .andExpect(status().isNotFound());
        deleteAs(other, "/api/v1/tasks/" + task).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/tasks/today").cookie(other)).andExpect(jsonPath("$.tasks", hasSize(0)));

        // Someone else's course or exam can't be linked
        postJson(other, "/api/v1/tasks", """
                        {"title":"x","courseId":"%s"}""".formatted(dbms))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("courseId"));
        postJson(other, "/api/v1/tasks", """
                        {"title":"x","examId":"%s"}""".formatted(exam))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("examId"));

        mvc.perform(get("/api/v1/tasks/" + task).cookie(owner)).andExpect(jsonPath("$.title").value("Mine"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/tasks/today")).andExpect(status().isUnauthorized());
    }
}
