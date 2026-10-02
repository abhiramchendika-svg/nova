package dev.nova.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The generator against real data, then the API the bell and the page use. The test user's timezone
 * is UTC (the default). The scheduler is off in tests, so each test runs the generator itself.
 */
class NotificationFlowTest extends AcademicsTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    @Autowired
    NotificationGenerator generator;

    @Autowired
    NotificationService service;

    private static String from(Duration offset) {
        return Instant.now().truncatedTo(ChronoUnit.MINUTES).plus(offset).toString();
    }

    private UUID userId(Cookie session) throws Exception {
        String json = mvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return UUID.fromString(JsonPath.read(json, "$.id"));
    }

    /** A current semester with a 75% target and one course; returns the course id. */
    private String courseWithAttendance(Cookie session, int conducted, int attended) throws Exception {
        String semesterId = idOf(postJson(session, "/api/v1/semesters", """
                        {"name":"Semester 3","ordinal":3,"gradingSchemeId":"%s","current":true,"attendanceTarget":75}"""
                        .formatted(TEN_POINT))
                .andExpect(status().isCreated())
                .andReturn());
        String courseId = createCourse(session, semesterId, "Database Systems", "4");
        setAttendance(session, courseId, conducted, attended);
        return courseId;
    }

    private void setAttendance(Cookie session, String courseId, int conducted, int attended) throws Exception {
        putJson(session, "/api/v1/courses/" + courseId + "/attendance/baseline", """
                        {"conducted":%d,"attended":%d}""".formatted(conducted, attended))
                .andExpect(status().isOk());
    }

    @Test
    void createsEachReminderOnceAndListsThemNewestFirst() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("notify"));
        UUID me = userId(session);
        String dbms = courseWithAttendance(session, 10, 6); // 60%: below 75%

        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"ER diagram","dueAt":"%s","priority":"HIGH"}"""
                        .formatted(dbms, from(Duration.ofHours(10))))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Next week","dueAt":"%s"}"""
                        .formatted(dbms, from(Duration.ofDays(5))))
                .andExpect(status().isCreated());
        String taskId = idOf(postJson(session, "/api/v1/tasks", """
                        {"title":"Pay hostel fee","dueAt":"%s"}""".formatted(from(Duration.ofHours(5))))
                .andExpect(status().isCreated())
                .andReturn());
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Mid-semester 1","startsAt":"%sT09:00:00Z","topics":["Joins","Indexing"]}"""
                        .formatted(dbms, TODAY.plusDays(2)))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/hackathons", """
                        {"name":"HackSRM","status":"INTERESTED","startsOn":"%s","registrationDeadline":"%s"}"""
                        .formatted(TODAY.plusDays(6), from(Duration.ofHours(6))))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/internships", """
                        {"company":"Acme","role":"Backend intern","status":"SAVED","deadlineAt":"%s"}"""
                        .formatted(from(Duration.ofHours(3))))
                .andExpect(status().isCreated());
        postJson(session, "/api/v1/internships", """
                        {"company":"Globex","role":"SDE intern","status":"INTERVIEW","appliedOn":"%s",
                         "nextStep":"Technical interview","nextStepAt":"%sT10:00:00Z"}"""
                        .formatted(TODAY, TODAY.plusDays(1)))
                .andExpect(status().isCreated());

        assertThat(generator.generateFor(me)).isEqualTo(7);
        // Running again (the next hour, or a second instance) creates nothing new
        assertThat(generator.generateFor(me)).isZero();

        mvc.perform(get("/api/v1/notifications/unread-count").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(7));
        mvc.perform(get("/api/v1/notifications?size=10").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(7))
                .andExpect(jsonPath("$.items[*].type", hasItem("ASSIGNMENT_DUE")))
                .andExpect(jsonPath("$.items[*].type", hasItem("TASK_DUE")))
                .andExpect(jsonPath("$.items[*].type", hasItem("EXAM_SOON")))
                .andExpect(jsonPath("$.items[*].type", hasItem("ATTENDANCE_AT_RISK")))
                .andExpect(jsonPath("$.items[*].type", hasItem("HACKATHON_DEADLINE")))
                .andExpect(jsonPath("$.items[*].type", hasItem("INTERNSHIP_DEADLINE")))
                .andExpect(jsonPath("$.items[*].type", hasItem("INTERNSHIP_STEP")))
                .andExpect(jsonPath("$.items[*].title", hasItem("Mid-semester 1 is in 2 days")))
                .andExpect(jsonPath("$.items[*].title", hasItem("Database Systems attendance is below your target")))
                .andExpect(jsonPath("$.items[*].body", hasItem("Technical interview tomorrow at 10:00")))
                .andExpect(jsonPath("$.items[*].link", hasItem("/app/planner/tasks?task=" + taskId)))
                .andExpect(jsonPath("$.items[0].read").value(false));
    }

    @Test
    void marksReadOneAtATimeOrAllAtOnceAndKeepsOthersOut() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("read"));
        UUID me = userId(session);
        for (String title : List.of("One", "Two", "Three")) {
            postJson(session, "/api/v1/tasks", """
                            {"title":"%s","dueAt":"%s"}""".formatted(title, from(Duration.ofHours(4))))
                    .andExpect(status().isCreated());
        }
        assertThat(generator.generateFor(me)).isEqualTo(3);
        String json = mvc.perform(get("/api/v1/notifications").cookie(session))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String first = JsonPath.read(json, "$.items[0].id");

        patchJson(session, "/api/v1/notifications/" + first, """
                        {"read":true}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.readAt").isNotEmpty());
        mvc.perform(get("/api/v1/notifications?unread=true").cookie(session))
                .andExpect(jsonPath("$.totalItems").value(2));
        patchJson(session, "/api/v1/notifications/" + first, """
                        {"read":false}""")
                .andExpect(jsonPath("$.read").value(false));
        patchJson(session, "/api/v1/notifications/" + first, "{}").andExpect(status().isBadRequest());

        // Someone else's notification doesn't exist for you
        Cookie other = registerAndGetSession(uniqueEmail("other"));
        patchJson(other, "/api/v1/notifications/" + first, """
                        {"read":true}""")
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/notifications").cookie(other)).andExpect(jsonPath("$.totalItems").value(0));

        mvc.perform(post("/api/v1/notifications/read-all").cookie(session).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(3));
        mvc.perform(get("/api/v1/notifications/unread-count").cookie(session))
                .andExpect(jsonPath("$.count").value(0));

        // The clean-up deletes read notifications past the retention, never unread ones
        postJson(session, "/api/v1/tasks", """
                        {"title":"Four","dueAt":"%s"}""".formatted(from(Duration.ofHours(4))))
                .andExpect(status().isCreated());
        assertThat(generator.generateFor(me)).isEqualTo(1);
        service.deleteReadBefore(Instant.now().plusSeconds(60));
        mvc.perform(get("/api/v1/notifications").cookie(session))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Four"));
    }

    @Test
    void typesSwitchedOffInSettingsAreSkipped() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("mute"));
        UUID me = userId(session);

        mvc.perform(get("/api/v1/settings/notifications").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.types.length()").value(NotificationType.values().length))
                .andExpect(jsonPath("$.types[0].type").value("ASSIGNMENT_DUE"))
                .andExpect(jsonPath("$.types[?(@.enabled == false)]").isEmpty());

        patchJson(session, "/api/v1/settings/notifications", """
                        {"enabled":{"TASK_DUE":false}}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.types[?(@.type == 'TASK_DUE')].enabled").value(false))
                .andExpect(jsonPath("$.types[?(@.type == 'TASK_OVERDUE')].enabled").value(true));
        patchJson(session, "/api/v1/settings/notifications", """
                        {"enabled":{"NOT_A_TYPE":false}}""")
                .andExpect(status().isBadRequest());
        patchJson(session, "/api/v1/settings/notifications", """
                        {"enabled":{}}""")
                .andExpect(status().isBadRequest());

        postJson(session, "/api/v1/tasks", """
                        {"title":"Quiet","dueAt":"%s"}""".formatted(from(Duration.ofHours(2))))
                .andExpect(status().isCreated());
        assertThat(generator.generateFor(me)).isZero();

        // Back on: the next run catches up
        patchJson(session, "/api/v1/settings/notifications", """
                        {"enabled":{"TASK_DUE":true}}""")
                .andExpect(status().isOk());
        assertThat(generator.generateFor(me)).isEqualTo(1);
    }

    @Test
    void attendanceNotifiesAgainOnlyAfterItRecoversAndSlipsBack() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("attend"));
        UUID me = userId(session);
        String course = courseWithAttendance(session, 10, 6); // below

        assertThat(generator.generateFor(me)).isEqualTo(1);
        setAttendance(session, course, 11, 6); // still below: no repeat
        assertThat(generator.generateFor(me)).isZero();
        setAttendance(session, course, 20, 20); // safe again
        assertThat(generator.generateFor(me)).isZero();
        setAttendance(session, course, 20, 12); // below again: a new notification
        assertThat(generator.generateFor(me)).isEqualTo(1);

        mvc.perform(get("/api/v1/notifications/unread-count").cookie(session))
                .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void needsALogin() throws Exception {
        mvc.perform(get("/api/v1/notifications/unread-count")).andExpect(status().isUnauthorized());
    }
}
