package dev.nova.developer.hackathon;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

/** Hackathons end to end: deadlines by status, exam clashes, prep tasks, the calendar and Home. */
class HackathonFlowTest extends AcademicsTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);
    private static final String BASE = "/api/v1/hackathons";

    private static String inHours(long hours) {
        return Instant.now().truncatedTo(ChronoUnit.SECONDS).plus(hours, ChronoUnit.HOURS).toString();
    }

    @Test
    void createsAndEditsAHackathon() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("hack-create"));

        String id = idOf(postJson(session, BASE, """
                        {"name":"  Hack the Campus ","organizer":" IEEE ","mode":"OFFLINE","location":"Main hall",
                         "websiteUrl":" https://hack.example.com ","startsOn":"%s","endsOn":"%s",
                         "teamName":"Null Pointers","teamMembers":"Asha, Ravi","notes":"  "}"""
                        .formatted(TODAY.plusDays(10), TODAY.plusDays(11)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/hackathons/")))
                .andExpect(jsonPath("$.name").value("Hack the Campus"))
                .andExpect(jsonPath("$.organizer").value("IEEE"))
                .andExpect(jsonPath("$.websiteUrl").value("https://hack.example.com"))
                .andExpect(jsonPath("$.status").value("INTERESTED"))
                .andExpect(jsonPath("$.notes").doesNotExist())
                .andExpect(jsonPath("$.past").value(false))
                .andExpect(jsonPath("$.daysUntil").value(10))
                .andExpect(jsonPath("$.deadline").doesNotExist())
                .andExpect(jsonPath("$.examClashes", hasSize(0)))
                .andExpect(jsonPath("$.openTasks").value(0))
                .andReturn());

        // The result is only ever what the user writes
        putJson(session, BASE + "/" + id, """
                        {"name":"Hack the Campus","status":"FINISHED","startsOn":"%s","result":" Top 10 of 80 ",
                         "certificateUrl":"https://example.com/cert.pdf"}""".formatted(TODAY.minusDays(3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("Top 10 of 80"))
                .andExpect(jsonPath("$.organizer").doesNotExist())
                .andExpect(jsonPath("$.past").value(true));
    }

    @Test
    void rejectsHackathonsThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("hack-invalid"));
        postJson(session, BASE, "{\"name\":\" \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"));
        postJson(session, BASE, "{\"name\":\"x\",\"endsOn\":\"%s\"}".formatted(TODAY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("startsOn"));
        postJson(session, BASE, "{\"name\":\"x\",\"startsOn\":\"%s\",\"endsOn\":\"%s\"}"
                        .formatted(TODAY, TODAY.minusDays(1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("endsOn"));
        postJson(session, BASE, "{\"name\":\"x\",\"registrationDeadline\":\"%s\",\"submissionDeadline\":\"%s\"}"
                        .formatted(inHours(48), inHours(24)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("registrationDeadline"));
        postJson(session, BASE, "{\"name\":\"x\",\"repoUrl\":\"javascript:alert(1)\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("repoUrl"));
        postJson(session, BASE, "{\"name\":\"x\",\"status\":\"WON\"}").andExpect(status().isBadRequest());
        mvc.perform(get(BASE).cookie(session)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void listsUpcomingFirstAndFollowsTheDeadlineThatMatters() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("hack-list"));
        postJson(session, BASE, "{\"name\":\"Old one\",\"startsOn\":\"%s\"}".formatted(TODAY.minusDays(40)));
        postJson(session, BASE, "{\"name\":\"Later\",\"startsOn\":\"%s\"}".formatted(TODAY.plusDays(30)));
        String soon = idOf(postJson(session, BASE, """
                        {"name":"Soon","startsOn":"%s","registrationDeadline":"%s","submissionDeadline":"%s"}"""
                        .formatted(TODAY.plusDays(3), inHours(-2), inHours(72)))
                .andExpect(jsonPath("$.deadline.kind").value("REGISTRATION"))
                .andExpect(jsonPath("$.deadline.missed").value(true))
                .andReturn());
        postJson(session, BASE, "{\"name\":\"Someday\"}");

        mvc.perform(get(BASE).cookie(session))
                .andExpect(jsonPath("$[*].name", contains("Soon", "Later", "Someday", "Old one")))
                .andExpect(jsonPath("$[3].past").value(true));
        mvc.perform(get(BASE).param("status", "INTERESTED").cookie(session)).andExpect(jsonPath("$", hasSize(4)));

        // Once registered, the submission deadline is the one that matters
        putJson(session, BASE + "/" + soon, """
                        {"name":"Soon","status":"REGISTERED","startsOn":"%s","registrationDeadline":"%s",
                         "submissionDeadline":"%s"}""".formatted(TODAY.plusDays(3), inHours(-2), inHours(72)))
                .andExpect(jsonPath("$.deadline.kind").value("SUBMISSION"))
                .andExpect(jsonPath("$.deadline.missed").value(false));
    }

    @Test
    void flagsExamsTooCloseAndShowsOnTheCalendarAndHome() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("hack-clash"));
        String semester = createSemester(session, "Semester 3", 3, TEN_POINT, true);
        String dbms = createCourse(session, semester, "Database Systems", "4");
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Mid-semester 1","startsAt":"%sT09:00:00Z"}"""
                        .formatted(dbms, TODAY.plusDays(7)))
                .andExpect(status().isCreated());
        String id = idOf(postJson(session, BASE, """
                        {"name":"Weekend hack","status":"REGISTERED","startsOn":"%s","endsOn":"%s",
                         "submissionDeadline":"%s"}"""
                        .formatted(TODAY.plusDays(5), TODAY.plusDays(6), inHours(30)))
                .andExpect(jsonPath("$.examClashes[0].title").value("Mid-semester 1"))
                .andExpect(jsonPath("$.examClashes[0].on").value(TODAY.plusDays(7).toString()))
                .andReturn());

        mvc.perform(get("/api/v1/calendar")
                        .param("from", TODAY.toString())
                        .param("to", TODAY.plusDays(6).toString())
                        .cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.type == 'HACKATHON')].date",
                        contains(TODAY.plusDays(5).toString(), TODAY.plusDays(6).toString())))
                .andExpect(jsonPath("$.items[?(@.type == 'HACKATHON_DEADLINE')].title",
                        contains("Submit: Weekend hack")))
                .andExpect(jsonPath("$.load[5].hackathons").value(1));

        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(jsonPath("$.needsAttention[*].kind", hasItem("HACKATHON_DEADLINE")))
                .andExpect(jsonPath("$.needsAttention[?(@.kind == 'HACKATHON_EXAM_CLASH')].reason",
                        contains("Mid-semester 1 on " + day(TODAY.plusDays(7)) + " · 1 day after it")))
                .andExpect(jsonPath("$.needsAttention[?(@.kind == 'HACKATHON_EXAM_CLASH')].link",
                        contains("/app/developer/hackathons/" + id)))
                .andExpect(jsonPath("$.developer.upcomingHackathons").value(1))
                .andExpect(jsonPath("$.developer.nextHackathon.name").value("Weekend hack"))
                .andExpect(jsonPath("$.developer.nextHackathon.daysUntil").value(5));

        // Skipping it takes it off the calendar and Home
        putJson(session, BASE + "/" + id, "{\"name\":\"Weekend hack\",\"status\":\"SKIPPED\",\"startsOn\":\"%s\"}"
                        .formatted(TODAY.plusDays(5)))
                .andExpect(jsonPath("$.examClashes", hasSize(0)));
        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(jsonPath("$.developer.upcomingHackathons").value(0))
                .andExpect(jsonPath("$.needsAttention[?(@.refId == '%s')]".formatted(id), hasSize(0)));
    }

    private static String day(LocalDate date) {
        return date.format(java.time.format.DateTimeFormatter.ofPattern("EEE d MMM", java.util.Locale.ENGLISH));
    }

    @Test
    void prepTasksAndAProjectLinkToIt() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("hack-tasks"));
        String project = idOf(postJson(session, "/api/v1/projects", "{\"name\":\"Bus tracker\"}").andReturn());
        String id = idOf(postJson(session, BASE, "{\"name\":\"Smart city hack\",\"projectId\":\"%s\"}".formatted(project))
                .andExpect(jsonPath("$.projectName").value("Bus tracker"))
                .andReturn());

        String task = idOf(postJson(session, "/api/v1/tasks", "{\"title\":\"Set up repo\",\"hackathonId\":\"%s\"}"
                        .formatted(id))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("PROJECT"))
                .andExpect(jsonPath("$.hackathonName").value("Smart city hack"))
                .andReturn());
        mvc.perform(get(BASE + "/" + id).cookie(session)).andExpect(jsonPath("$.openTasks").value(1));
        mvc.perform(get("/api/v1/tasks").param("hackathonId", id).cookie(session))
                .andExpect(jsonPath("$.totalItems").value(1));

        // Deleting the project keeps the hackathon; deleting the hackathon keeps the task
        deleteAs(session, "/api/v1/projects/" + project).andExpect(status().isNoContent());
        mvc.perform(get(BASE + "/" + id).cookie(session)).andExpect(jsonPath("$.projectId").doesNotExist());
        deleteAs(session, BASE + "/" + id).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks/" + task).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hackathonId").doesNotExist());
    }

    @Test
    void usersOnlySeeTheirOwnHackathons() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("hack-owner"));
        String id = idOf(postJson(owner, BASE, "{\"name\":\"Mine\"}").andReturn());
        String project = idOf(postJson(owner, "/api/v1/projects", "{\"name\":\"Mine too\"}").andReturn());

        Cookie other = registerAndGetSession(uniqueEmail("hack-other"));
        mvc.perform(get(BASE + "/" + id).cookie(other)).andExpect(status().isNotFound());
        putJson(other, BASE + "/" + id, "{\"name\":\"x\"}").andExpect(status().isNotFound());
        deleteAs(other, BASE + "/" + id).andExpect(status().isNotFound());
        postJson(other, BASE, "{\"name\":\"x\",\"projectId\":\"%s\"}".formatted(project))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("projectId"));
        postJson(other, "/api/v1/tasks", "{\"title\":\"x\",\"hackathonId\":\"%s\"}".formatted(id))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("hackathonId"));
        mvc.perform(get(BASE + "/" + id).cookie(owner)).andExpect(jsonPath("$.name").value("Mine"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }
}
