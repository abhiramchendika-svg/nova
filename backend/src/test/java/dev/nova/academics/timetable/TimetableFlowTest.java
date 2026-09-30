package dev.nova.academics.timetable;

import static org.hamcrest.Matchers.contains;
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

/** The weekly timetable and a day's classes. Overlap and slot rules are covered by TimetableRulesTest. */
class TimetableFlowTest extends AcademicsTestSupport {

    /** The test user's timezone is UTC (the default). */
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private static String entry(String courseId, int day, String start, String end) {
        return """
                {"courseId":"%s","dayOfWeek":%d,"startsAt":"%s","endsAt":"%s"}""".formatted(courseId, day, start, end);
    }

    private String add(Cookie session, String courseId, int day, String start, String end) throws Exception {
        return idOf(postJson(session, "/api/v1/timetable", entry(courseId, day, start, end))
                .andExpect(status().isCreated())
                .andReturn());
    }

    @Test
    void buildsTheWeekAndFlagsOverlaps() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-week"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        String os = createCourse(session, semesterId, "Operating Systems", "4");

        String lecture = idOf(postJson(session, "/api/v1/timetable", entry(dbms, 1, "09:00", "09:50"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/timetable/")))
                .andExpect(jsonPath("$.courseName").value("Database Systems"))
                .andExpect(jsonPath("$.startsAt").value("09:00"))
                .andExpect(jsonPath("$.endsAt").value("09:50"))
                .andExpect(jsonPath("$.kind").value("LECTURE"))
                .andExpect(jsonPath("$.overlapsWith", hasSize(0)))
                .andReturn());
        String lab = idOf(postJson(session, "/api/v1/timetable", """
                        {"courseId":"%s","dayOfWeek":1,"startsAt":"09:30","endsAt":"11:00","kind":"LAB","location":" Lab 2 "}"""
                        .formatted(os))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("LAB"))
                .andExpect(jsonPath("$.location").value("Lab 2"))
                .andExpect(jsonPath("$.overlapsWith", contains(lecture)))
                .andReturn());
        // Starting exactly when the lab ends is not a clash
        String after = add(session, dbms, 1, "11:00", "11:50");
        String tuesday = add(session, dbms, 2, "09:00", "09:50");

        mvc.perform(get("/api/v1/timetable").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].id").value(lecture))
                .andExpect(jsonPath("$[0].overlapsWith", contains(lab)))
                .andExpect(jsonPath("$[1].id").value(lab))
                .andExpect(jsonPath("$[2].id").value(after))
                .andExpect(jsonPath("$[2].overlapsWith", hasSize(0)))
                .andExpect(jsonPath("$[3].id").value(tuesday))
                .andExpect(jsonPath("$[3].dayOfWeek").value(2));
    }

    @Test
    void rejectsClassesThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-invalid"));
        String course = createCourse(session, createSemester(session, "Semester 1", 1, TEN_POINT, true), "DB", "4");

        postJson(session, "/api/v1/timetable", entry(course, 1, "10:00", "09:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("endsAt"));
        postJson(session, "/api/v1/timetable", entry(course, 1, "10:00", "10:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("endsAt"));
        postJson(session, "/api/v1/timetable", entry(course, 8, "09:00", "10:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("dayOfWeek"));
        postJson(session, "/api/v1/timetable", entry(course, 1, "9:00", "10:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("startsAt"));
        postJson(session, "/api/v1/timetable", entry(course, 1, "09:00", "24:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("endsAt"));
        postJson(session, "/api/v1/timetable", """
                        {"courseId":"%s","dayOfWeek":1,"startsAt":"09:00","endsAt":"10:00","kind":"SEMINAR"}"""
                        .formatted(course))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/timetable").cookie(session)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void updatesAndDeletesAClass() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-update"));
        String course = createCourse(session, createSemester(session, "Semester 1", 1, TEN_POINT, true), "DB", "4");
        String id = add(session, course, 1, "09:00", "09:50");

        putJson(session, "/api/v1/timetable/" + id, """
                        {"courseId":"%s","dayOfWeek":3,"startsAt":"14:00","endsAt":"16:00","kind":"LAB","instructor":"Dr. Rao"}"""
                        .formatted(course))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dayOfWeek").value(3))
                .andExpect(jsonPath("$.startsAt").value("14:00"))
                .andExpect(jsonPath("$.kind").value("LAB"))
                .andExpect(jsonPath("$.instructor").value("Dr. Rao"));

        deleteAs(session, "/api/v1/timetable/" + id).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/timetable").cookie(session)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void aDaysClassesCarryTheirSlotAndAnyMark() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-day"));
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        String os = createCourse(session, semesterId, "Operating Systems", "4");
        int weekday = TODAY.getDayOfWeek().getValue();
        String lab = add(session, dbms, weekday, "14:00", "16:00");
        String lecture = add(session, dbms, weekday, "09:00", "09:50");
        String osClass = add(session, os, weekday, "11:00", "11:50");
        add(session, os, weekday == 7 ? 1 : weekday + 1, "09:00", "09:50"); // another day

        // The afternoon lab is DBMS's 2nd class today; mark it absent
        String record = idOf(postJson(session, "/api/v1/courses/" + dbms + "/attendance/records", """
                        {"heldOn":"%s","slot":2,"status":"ABSENT"}""".formatted(TODAY))
                .andExpect(status().isCreated())
                .andReturn());

        mvc.perform(get("/api/v1/timetable/day").cookie(session)) // today by default
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(TODAY.toString()))
                .andExpect(jsonPath("$.dayOfWeek").value(weekday))
                .andExpect(jsonPath("$.semesterId").value(semesterId))
                .andExpect(jsonPath("$.inTerm").value(true))
                .andExpect(jsonPath("$.classes", hasSize(3)))
                .andExpect(jsonPath("$.classes[0].entry.id").value(lecture))
                .andExpect(jsonPath("$.classes[0].slot").value(1))
                .andExpect(jsonPath("$.classes[0].attendance").doesNotExist())
                .andExpect(jsonPath("$.classes[1].entry.id").value(osClass))
                .andExpect(jsonPath("$.classes[1].slot").value(1))
                .andExpect(jsonPath("$.classes[2].entry.id").value(lab))
                .andExpect(jsonPath("$.classes[2].slot").value(2))
                .andExpect(jsonPath("$.classes[2].attendance.recordId").value(record))
                .andExpect(jsonPath("$.classes[2].attendance.status").value("ABSENT"));

        mvc.perform(get("/api/v1/timetable/day").param("date", TODAY.plusDays(7).toString()).cookie(session))
                .andExpect(jsonPath("$.classes", hasSize(3)))
                .andExpect(jsonPath("$.classes[2].attendance").doesNotExist()); // marks are per date
    }

    @Test
    void noClassesOutsideTheSemestersDates() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-term"));
        String semesterId = idOf(postJson(session, "/api/v1/semesters", """
                        {"name":"Semester 1","ordinal":1,"gradingSchemeId":"%s","current":true,"startsOn":"%s","endsOn":"%s"}"""
                        .formatted(TEN_POINT, TODAY.minusDays(100), TODAY.minusDays(10)))
                .andExpect(status().isCreated())
                .andReturn());
        String course = createCourse(session, semesterId, "DB", "4");
        add(session, course, TODAY.getDayOfWeek().getValue(), "09:00", "10:00");

        mvc.perform(get("/api/v1/timetable/day").cookie(session))
                .andExpect(jsonPath("$.inTerm").value(false))
                .andExpect(jsonPath("$.classes", hasSize(0)));
        mvc.perform(get("/api/v1/timetable/day").param("date", TODAY.minusDays(14).toString()).cookie(session))
                .andExpect(jsonPath("$.inTerm").value(true))
                .andExpect(jsonPath("$.classes", hasSize(1)));
    }

    @Test
    void showsTheCurrentSemesterUnlessAskedForAnother() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-semesters"));
        String old = createSemester(session, "Semester 1", 1, TEN_POINT, false);
        String current = createSemester(session, "Semester 2", 2, TEN_POINT, true);
        add(session, createCourse(session, old, "Old course", "3"), 1, "09:00", "10:00");
        add(session, createCourse(session, current, "New course", "3"), 1, "09:00", "10:00");

        // Same time, different semesters: not an overlap
        mvc.perform(get("/api/v1/timetable").cookie(session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].courseName").value("New course"))
                .andExpect(jsonPath("$[0].overlapsWith", hasSize(0)));
        mvc.perform(get("/api/v1/timetable").param("semesterId", old).cookie(session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].courseName").value("Old course"));
    }

    @Test
    void aNewStudentHasNoTimetableYet() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-new"));

        mvc.perform(get("/api/v1/timetable").cookie(session)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/v1/timetable/day").cookie(session))
                .andExpect(jsonPath("$.semesterId").doesNotExist())
                .andExpect(jsonPath("$.inTerm").value(false))
                .andExpect(jsonPath("$.classes", hasSize(0)));
    }

    @Test
    void otherUsersClassesLookLikeTheyDontExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("tt-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("tt-other"));
        String semesterId = createSemester(owner, "Semester 1", 1, TEN_POINT, true);
        String course = createCourse(owner, semesterId, "DB", "4");
        String id = add(owner, course, 1, "09:00", "10:00");

        putJson(other, "/api/v1/timetable/" + id, entry(course, 2, "09:00", "10:00")).andExpect(status().isNotFound());
        deleteAs(other, "/api/v1/timetable/" + id).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/timetable").param("semesterId", semesterId).cookie(other))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/timetable").cookie(other)).andExpect(jsonPath("$", hasSize(0)));
        postJson(other, "/api/v1/timetable", entry(course, 1, "09:00", "10:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("courseId"));

        mvc.perform(get("/api/v1/timetable").cookie(owner))
                .andExpect(jsonPath("$[0].dayOfWeek").value(1)); // untouched
    }

    @Test
    void deletingACourseDeletesItsClasses() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("tt-cascade"));
        String course = createCourse(session, createSemester(session, "Semester 1", 1, TEN_POINT, true), "DB", "4");
        String id = add(session, course, 1, "09:00", "10:00");

        deleteAs(session, "/api/v1/courses/" + course).andExpect(status().isNoContent());

        deleteAs(session, "/api/v1/timetable/" + id).andExpect(status().isNotFound());
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/timetable")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/timetable/day")).andExpect(status().isUnauthorized());
    }
}
