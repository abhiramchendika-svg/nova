package dev.nova.academics.attendance;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/** Attendance through the API. The projection maths is covered exhaustively by AttendanceCalculatorTest. */
class AttendanceFlowTest extends AcademicsTestSupport {

    /** The test user's timezone is UTC (the default), so "today" is today in UTC. */
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private static String mark(LocalDate day, int slot, String status) {
        return """
                {"heldOn":"%s","slot":%d,"status":"%s"}""".formatted(day, slot, status);
    }

    private static String baseline(int conducted, int attended) {
        return """
                {"conducted":%d,"attended":%d}""".formatted(conducted, attended);
    }

    private void setDefaultTarget(Cookie session, String target) throws Exception {
        putJson(session, "/api/v1/settings", """
                        {"timezone":"UTC","weekStart":"MON","defaultAttendanceTarget":%s,"theme":"SYSTEM"}"""
                        .formatted(target))
                .andExpect(status().isOk());
    }

    /** A user with one course in a current 10-point semester; returns the course id. */
    private String courseFor(Cookie session) throws Exception {
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        return createCourse(session, semesterId, "Database Systems", "4");
    }

    @Test
    void baselineAndMarkedClassesDriveTheProjection() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-flow"));
        setDefaultTarget(session, "75");
        String course = courseFor(session);
        String base = "/api/v1/courses/" + course + "/attendance";

        // 28 of 34 at 75% → 82.35%, can miss 3
        putJson(session, base + "/baseline", baseline(34, 28))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conducted").value(34))
                .andExpect(jsonPath("$.attended").value(28))
                .andExpect(jsonPath("$.percentage").value(82.35))
                .andExpect(jsonPath("$.target").value(75.0))
                .andExpect(jsonPath("$.targetSource").value("DEFAULT"))
                .andExpect(jsonPath("$.canMiss").value(3))
                .andExpect(jsonPath("$.status").value("SAFE"));

        // An absence: 28 of 35 = 80%, can miss ⌊(2800 − 2625) / 75⌋ = 2
        postJson(session, base + "/records", mark(TODAY, 1, "ABSENT"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/attendance/records/")))
                .andExpect(jsonPath("$.heldOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.slot").value(1))
                .andExpect(jsonPath("$.status").value("ABSENT"));
        // A cancelled class is recorded but changes nothing
        postJson(session, base + "/records", mark(TODAY.minusDays(1), 1, "CANCELLED"))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/attendance").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].courseName").value("Database Systems"))
                .andExpect(jsonPath("$[0].baselineConducted").value(34))
                .andExpect(jsonPath("$[0].absent").value(1))
                .andExpect(jsonPath("$[0].cancelled").value(1))
                .andExpect(jsonPath("$[0].conducted").value(35))
                .andExpect(jsonPath("$[0].attended").value(28))
                .andExpect(jsonPath("$[0].percentage").value(80.0))
                .andExpect(jsonPath("$[0].canMiss").value(2))
                .andExpect(jsonPath("$[0].needToAttend").value(0));
    }

    @Test
    void targetComesFromCourseThenSemesterThenDefault() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-target"));
        setDefaultTarget(session, "75");
        String semesterId = idOf(postJson(session, "/api/v1/semesters", """
                        {"name":"Semester 1","ordinal":1,"gradingSchemeId":"%s","current":true,"attendanceTarget":80}"""
                        .formatted(TEN_POINT))
                .andReturn());
        String plain = createCourse(session, semesterId, "Compilers", "3");
        String strict = idOf(postJson(session, "/api/v1/courses", """
                        {"semesterId":"%s","name":"Lab","credits":2,"attendanceTarget":90}""".formatted(semesterId))
                .andReturn());

        mvc.perform(get("/api/v1/courses/" + plain + "/attendance").cookie(session))
                .andExpect(jsonPath("$.target").value(80.0))
                .andExpect(jsonPath("$.targetSource").value("SEMESTER"));
        mvc.perform(get("/api/v1/courses/" + strict + "/attendance").cookie(session))
                .andExpect(jsonPath("$.target").value(90.0))
                .andExpect(jsonPath("$.targetSource").value("COURSE"));
    }

    @Test
    void withoutATargetThereIsNoProjection() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-notarget"));
        String course = courseFor(session);

        putJson(session, "/api/v1/courses/" + course + "/attendance/baseline", baseline(10, 8))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.percentage").value(80.0))
                .andExpect(jsonPath("$.target").doesNotExist())
                .andExpect(jsonPath("$.canMiss").doesNotExist())
                .andExpect(jsonPath("$.status").value("NO_TARGET"));
    }

    @Test
    void aNewCourseHasNoClassesYet() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-empty"));
        setDefaultTarget(session, "75");
        String course = courseFor(session);

        mvc.perform(get("/api/v1/courses/" + course + "/attendance").cookie(session))
                .andExpect(jsonPath("$.conducted").value(0))
                .andExpect(jsonPath("$.percentage").doesNotExist())
                .andExpect(jsonPath("$.status").value("NO_CLASSES"));
    }

    @Test
    void rejectsMarksThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-invalid"));
        String records = "/api/v1/courses/" + courseFor(session) + "/attendance/records";
        postJson(session, records, mark(TODAY, 1, "PRESENT")).andExpect(status().isCreated());

        // The same class twice
        postJson(session, records, mark(TODAY, 1, "ABSENT"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        // A second class the same day is fine
        postJson(session, records, mark(TODAY, 2, "ABSENT")).andExpect(status().isCreated());
        // A class that hasn't happened yet
        postJson(session, records, mark(TODAY.plusDays(2), 1, "PRESENT"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("heldOn"));
        // Slot out of range
        postJson(session, records, mark(TODAY, 13, "PRESENT"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("slot"));
        // Missing status
        postJson(session, records, """
                        {"heldOn":"%s"}""".formatted(TODAY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("status"));
    }

    @Test
    void slotDefaultsToOne() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-slot"));
        String records = "/api/v1/courses/" + courseFor(session) + "/attendance/records";

        postJson(session, records, """
                        {"heldOn":"%s","status":"PRESENT"}""".formatted(TODAY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slot").value(1));
    }

    @Test
    void historyIsNewestFirstAndPaged() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-history"));
        String records = "/api/v1/courses/" + courseFor(session) + "/attendance/records";
        postJson(session, records, mark(TODAY.minusDays(2), 1, "PRESENT"));
        postJson(session, records, mark(TODAY, 1, "ABSENT"));
        postJson(session, records, mark(TODAY.minusDays(1), 1, "PRESENT"));

        mvc.perform(get(records).param("size", "2").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].heldOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.items[1].heldOn").value(TODAY.minusDays(1).toString()))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get(records).param("page", "1").param("size", "2").cookie(session))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].heldOn").value(TODAY.minusDays(2).toString()));

        mvc.perform(get(records).param("size", "101").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("size"));
    }

    @Test
    void changesAndDeletesAMark() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-edit"));
        String course = courseFor(session);
        String recordId = idOf(postJson(session, "/api/v1/courses/" + course + "/attendance/records", mark(TODAY, 1, "ABSENT"))
                .andReturn());

        putJson(session, "/api/v1/attendance/records/" + recordId, """
                        {"status":"PRESENT"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PRESENT"));
        mvc.perform(get("/api/v1/courses/" + course + "/attendance").cookie(session))
                .andExpect(jsonPath("$.attended").value(1))
                .andExpect(jsonPath("$.absent").value(0));

        deleteAs(session, "/api/v1/attendance/records/" + recordId).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/courses/" + course + "/attendance").cookie(session))
                .andExpect(jsonPath("$.conducted").value(0));
    }

    @Test
    void refusesABaselineWithMoreAttendedThanHeld() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-baseline"));
        String course = courseFor(session);

        putJson(session, "/api/v1/courses/" + course + "/attendance/baseline", baseline(10, 11))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("RULE_VIOLATION"))
                .andExpect(jsonPath("$.errors[0].field").value("attended"));
        putJson(session, "/api/v1/courses/" + course + "/attendance/baseline", baseline(-1, 0))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("conducted"));
    }

    @Test
    void otherUsersAttendanceLooksLikeItDoesntExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("att-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("att-other"));
        String course = courseFor(owner);
        String recordId = idOf(postJson(owner, "/api/v1/courses/" + course + "/attendance/records", mark(TODAY, 1, "PRESENT"))
                .andReturn());
        String semesterId = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(get("/api/v1/courses/" + course).cookie(owner)).andReturn().getResponse().getContentAsString(),
                "$.semesterId");

        mvc.perform(get("/api/v1/courses/" + course + "/attendance").cookie(other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/courses/" + course + "/attendance/records").cookie(other))
                .andExpect(status().isNotFound());
        postJson(other, "/api/v1/courses/" + course + "/attendance/records", mark(TODAY.minusDays(1), 1, "ABSENT"))
                .andExpect(status().isNotFound());
        putJson(other, "/api/v1/courses/" + course + "/attendance/baseline", baseline(10, 1))
                .andExpect(status().isNotFound());
        putJson(other, "/api/v1/attendance/records/" + recordId, """
                        {"status":"ABSENT"}""")
                .andExpect(status().isNotFound());
        deleteAs(other, "/api/v1/attendance/records/" + recordId).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/attendance").param("semesterId", semesterId).cookie(other))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/attendance").cookie(other)).andExpect(jsonPath("$", hasSize(0)));

        mvc.perform(get("/api/v1/courses/" + course + "/attendance").cookie(owner))
                .andExpect(jsonPath("$.attended").value(1)); // untouched
    }

    @Test
    void deletingACourseDeletesItsMarks() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("att-cascade"));
        String course = courseFor(session);
        String recordId = idOf(postJson(session, "/api/v1/courses/" + course + "/attendance/records", mark(TODAY, 1, "PRESENT"))
                .andReturn());

        deleteAs(session, "/api/v1/courses/" + course).andExpect(status().isNoContent());

        deleteAs(session, "/api/v1/attendance/records/" + recordId).andExpect(status().isNotFound());
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/attendance")).andExpect(status().isUnauthorized());
    }
}
