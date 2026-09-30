package dev.nova.academics.exam;

import static org.hamcrest.Matchers.hasSize;
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

/** Exams and their prep checklist through the API. Prep rounding is covered by PrepTest. */
class ExamFlowTest extends AcademicsTestSupport {

    /** The test user's timezone is UTC (the default). */
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private static String at(LocalDate day, int hour) {
        return OffsetDateTime.of(day.atTime(hour, 0), ZoneOffset.UTC).toString();
    }

    private static String exam(String courseId, String title, String startsAt) {
        return """
                {"courseId":"%s","title":"%s","startsAt":"%s"}""".formatted(courseId, title, startsAt);
    }

    private String courseFor(Cookie session) throws Exception {
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        return createCourse(session, semesterId, "Database Systems", "4");
    }

    private String create(Cookie session, String courseId, String title, String startsAt) throws Exception {
        return idOf(postJson(session, "/api/v1/exams", exam(courseId, title, startsAt))
                .andExpect(status().isCreated())
                .andReturn());
    }

    private static String topicId(MvcResult result, int index) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.topics[" + index + "].id");
    }

    @Test
    void createsAnExamWithAStarterChecklist() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-create"));
        String course = courseFor(session);

        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Mid-semester 1","kind":"MIDTERM","startsAt":"%s",
                         "durationMinutes":90,"location":"Hall B","topics":["Normalization"," Transactions ","Indexing"]}"""
                        .formatted(course, at(TODAY.plusDays(5), 10)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.title").value("Mid-semester 1"))
                .andExpect(jsonPath("$.kind").value("MIDTERM"))
                .andExpect(jsonPath("$.courseName").value("Database Systems"))
                .andExpect(jsonPath("$.durationMinutes").value(90))
                .andExpect(jsonPath("$.location").value("Hall B"))
                .andExpect(jsonPath("$.daysUntil").value(5))
                .andExpect(jsonPath("$.prep.total").value(3))
                .andExpect(jsonPath("$.prep.done").value(0))
                .andExpect(jsonPath("$.prep.percentage").value(0))
                .andExpect(jsonPath("$.topics", hasSize(3)))
                .andExpect(jsonPath("$.topics[1].title").value("Transactions"))
                .andExpect(jsonPath("$.topics[1].position").value(1))
                .andExpect(jsonPath("$.topics[1].done").value(false));

        // Kind defaults to OTHER; no topics means no percentage yet
        postJson(session, "/api/v1/exams", exam(course, "Quiz", at(TODAY.plusDays(1), 9)))
                .andExpect(jsonPath("$.kind").value("OTHER"))
                .andExpect(jsonPath("$.daysUntil").value(1))
                .andExpect(jsonPath("$.prep.total").value(0))
                .andExpect(jsonPath("$.prep.percentage").doesNotExist())
                .andExpect(jsonPath("$.topics", hasSize(0)));
    }

    @Test
    void ticksMovesRenamesAndRemovesTopics() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-topics"));
        MvcResult created = postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Final","startsAt":"%s","topics":["A","B","C"]}"""
                        .formatted(courseFor(session), at(TODAY.plusDays(10), 9)))
                .andReturn();
        String exam = "/api/v1/exams/" + idOf(created);
        String a = topicId(created, 0);
        String b = topicId(created, 1);
        String c = topicId(created, 2);

        // Tick one of three: 33%
        patchJson(session, exam + "/topics/" + a, """
                        {"done":true}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prep.done").value(1))
                .andExpect(jsonPath("$.prep.percentage").value(33))
                .andExpect(jsonPath("$.topics[0].done").value(true))
                .andExpect(jsonPath("$.topics[0].doneAt").exists());

        // Move C to the top: C, A, B
        patchJson(session, exam + "/topics/" + c, """
                        {"position":0}""")
                .andExpect(jsonPath("$.topics[0].title").value("C"))
                .andExpect(jsonPath("$.topics[1].title").value("A"))
                .andExpect(jsonPath("$.topics[2].title").value("B"))
                .andExpect(jsonPath("$.topics[2].position").value(2));

        patchJson(session, exam + "/topics/" + b, """
                        {"title":" Joins ","done":true}""")
                .andExpect(jsonPath("$.topics[2].title").value("Joins"))
                .andExpect(jsonPath("$.prep.percentage").value(67));

        // Add at the end, then remove from the middle: positions stay 0..n-1
        postJson(session, exam + "/topics", """
                        {"title":"Recovery"}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.topics[3].title").value("Recovery"))
                .andExpect(jsonPath("$.prep.total").value(4))
                .andExpect(jsonPath("$.prep.percentage").value(50));
        deleteAs(session, exam + "/topics/" + a).andExpect(status().isNoContent());
        mvc.perform(get(exam).cookie(session))
                .andExpect(jsonPath("$.topics", hasSize(3)))
                .andExpect(jsonPath("$.topics[0].title").value("C"))
                .andExpect(jsonPath("$.topics[1].title").value("Joins"))
                .andExpect(jsonPath("$.topics[1].position").value(1))
                .andExpect(jsonPath("$.topics[2].title").value("Recovery"))
                .andExpect(jsonPath("$.topics[2].position").value(2))
                .andExpect(jsonPath("$.prep.done").value(1));

        // Unticking clears the time
        patchJson(session, exam + "/topics/" + b, """
                        {"done":false}""")
                .andExpect(jsonPath("$.topics[1].done").value(false))
                .andExpect(jsonPath("$.topics[1].doneAt").doesNotExist());
    }

    @Test
    void rejectsTopicChangesThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-topic-invalid"));
        String course = courseFor(session);
        MvcResult created = postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Final","startsAt":"%s","topics":["A","B"]}"""
                        .formatted(course, at(TODAY.plusDays(10), 9)))
                .andReturn();
        String exam = "/api/v1/exams/" + idOf(created);
        String a = topicId(created, 0);

        patchJson(session, exam + "/topics/" + a, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("done"));
        patchJson(session, exam + "/topics/" + a, """
                        {"title":"  "}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        patchJson(session, exam + "/topics/" + a, """
                        {"position":2}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("position"));
        patchJson(session, exam + "/topics/" + a, """
                        {"position":-1}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("position"));
        postJson(session, exam + "/topics", """
                        {"title":""}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));

        // A topic id from another exam doesn't belong to this one
        String otherExam = "/api/v1/exams/" + create(session, course, "Quiz", at(TODAY.plusDays(2), 9));
        patchJson(session, otherExam + "/topics/" + a, """
                        {"done":true}""")
                .andExpect(status().isNotFound());
        deleteAs(session, otherExam + "/topics/" + a).andExpect(status().isNotFound());
    }

    @Test
    void listsSoonestFirstAndUpcomingIncludesToday() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-list"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        String os = createCourse(session, semesterId, "Operating Systems", "4");
        create(session, dbms, "Final", at(TODAY.plusDays(30), 9));
        create(session, dbms, "Last week", at(TODAY.minusDays(7), 9));
        // Midnight today has already passed, but it's still today's exam
        create(session, os, "This morning", OffsetDateTime.of(TODAY.atStartOfDay(), ZoneOffset.UTC).toString());

        mvc.perform(get("/api/v1/exams").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].title").value("Last week"))
                .andExpect(jsonPath("$[0].daysUntil").value(-7))
                .andExpect(jsonPath("$[1].title").value("This morning"))
                .andExpect(jsonPath("$[1].daysUntil").value(0))
                .andExpect(jsonPath("$[2].title").value("Final"));

        mvc.perform(get("/api/v1/exams").param("upcoming", "true").cookie(session))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].title").value("This morning"))
                .andExpect(jsonPath("$[0].courseName").value("Operating Systems"))
                .andExpect(jsonPath("$[1].daysUntil").value(30));
        mvc.perform(get("/api/v1/exams").param("upcoming", "true").param("courseId", dbms).cookie(session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("Final"));
    }

    @Test
    void listShowsPrepWithoutLoadingTopics() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-list-prep"));
        MvcResult created = postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Final","startsAt":"%s","topics":["A","B","C","D"]}"""
                        .formatted(courseFor(session), at(TODAY.plusDays(3), 9)))
                .andReturn();
        String exam = "/api/v1/exams/" + idOf(created);
        patchJson(session, exam + "/topics/" + topicId(created, 0), """
                        {"done":true}""");

        mvc.perform(get("/api/v1/exams").cookie(session))
                .andExpect(jsonPath("$[0].prep.done").value(1))
                .andExpect(jsonPath("$[0].prep.total").value(4))
                .andExpect(jsonPath("$[0].prep.percentage").value(25))
                .andExpect(jsonPath("$[0].topics").doesNotExist());
    }

    @Test
    void updateKeepsTheChecklist() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-update"));
        String course = courseFor(session);
        String id = idOf(postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Mid","startsAt":"%s","topics":["A"]}"""
                        .formatted(course, at(TODAY.plusDays(3), 9)))
                .andReturn());

        putJson(session, "/api/v1/exams/" + id, """
                        {"courseId":"%s","title":"Mid-semester","kind":"QUIZ","startsAt":"%s","topics":["ignored"]}"""
                        .formatted(course, at(TODAY.plusDays(4), 9)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Mid-semester"))
                .andExpect(jsonPath("$.kind").value("QUIZ"))
                .andExpect(jsonPath("$.daysUntil").value(4))
                .andExpect(jsonPath("$.topics", hasSize(1)))
                .andExpect(jsonPath("$.topics[0].title").value("A"));

        deleteAs(session, "/api/v1/exams/" + id).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/exams/" + id).cookie(session)).andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidExams() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-invalid"));
        String course = courseFor(session);

        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"No time"}""".formatted(course))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("startsAt"));
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Long","startsAt":"%s","durationMinutes":1441}"""
                        .formatted(course, at(TODAY, 9)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("durationMinutes"));
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Blank topic","startsAt":"%s","topics":["A"," "]}"""
                        .formatted(course, at(TODAY, 9)))
                .andExpect(status().isBadRequest());
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Bad kind","startsAt":"%s","kind":"VIVA"}"""
                        .formatted(course, at(TODAY, 9)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void otherUsersExamsLookLikeTheyDontExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("exam-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("exam-other"));
        String course = courseFor(owner);
        MvcResult created = postJson(owner, "/api/v1/exams", """
                        {"courseId":"%s","title":"Final","startsAt":"%s","topics":["A"]}"""
                        .formatted(course, at(TODAY.plusDays(3), 9)))
                .andReturn();
        String exam = "/api/v1/exams/" + idOf(created);
        String topic = exam + "/topics/" + topicId(created, 0);

        mvc.perform(get(exam).cookie(other)).andExpect(status().isNotFound());
        putJson(other, exam, exam(course, "Mine now", at(TODAY, 9))).andExpect(status().isNotFound());
        deleteAs(other, exam).andExpect(status().isNotFound());
        postJson(other, exam + "/topics", """
                        {"title":"Sneaky"}""")
                .andExpect(status().isNotFound());
        patchJson(other, topic, """
                        {"done":true}""")
                .andExpect(status().isNotFound());
        deleteAs(other, topic).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/exams").cookie(other)).andExpect(jsonPath("$", hasSize(0)));
        postJson(other, "/api/v1/exams", exam(course, "Sneaky", at(TODAY, 9)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("courseId"));

        mvc.perform(get(exam).cookie(owner))
                .andExpect(jsonPath("$.title").value("Final"))
                .andExpect(jsonPath("$.prep.done").value(0)); // untouched
    }

    @Test
    void deletingACourseDeletesItsExams() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("exam-cascade"));
        String course = courseFor(session);
        String id = create(session, course, "Final", at(TODAY.plusDays(3), 9));

        deleteAs(session, "/api/v1/courses/" + course).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/exams/" + id).cookie(session)).andExpect(status().isNotFound());
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/exams")).andExpect(status().isUnauthorized());
    }
}
