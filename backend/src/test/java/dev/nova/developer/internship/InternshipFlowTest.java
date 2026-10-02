package dev.nova.developer.internship;

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
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

/** Internship applications end to end: history, analytics, prep tasks, the calendar and Home. */
class InternshipFlowTest extends AcademicsTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);
    private static final String BASE = "/api/v1/internships";

    private static String inHours(long hours) {
        return Instant.now().truncatedTo(ChronoUnit.SECONDS).plus(hours, ChronoUnit.HOURS).toString();
    }

    @Test
    void createsMovesAndRemembersEveryStage() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("intern-create"));

        String id = idOf(postJson(session, BASE, """
                        {"company":"  Acme ","role":" SDE intern ","jobUrl":" https://jobs.example.com/1 ",
                         "source":"LinkedIn","status":"SAVED","notes":"  "}""")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/internships/")))
                .andExpect(jsonPath("$.company").value("Acme"))
                .andExpect(jsonPath("$.role").value("SDE intern"))
                .andExpect(jsonPath("$.jobUrl").value("https://jobs.example.com/1"))
                .andExpect(jsonPath("$.status").value("SAVED"))
                .andExpect(jsonPath("$.appliedOn").doesNotExist())
                .andExpect(jsonPath("$.notes").doesNotExist())
                .andExpect(jsonPath("$.history[*].toStatus", contains("SAVED")))
                .andReturn());

        // Sending it fills in today as the applied date
        patchJson(session, BASE + "/" + id + "/status", "{\"status\":\"APPLIED\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appliedOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.history[1].fromStatus").value("SAVED"))
                .andExpect(jsonPath("$.history[1].toStatus").value("APPLIED"));
        // The same status again records nothing
        patchJson(session, BASE + "/" + id + "/status", "{\"status\":\"APPLIED\"}")
                .andExpect(jsonPath("$.history", hasSize(2)));

        // A full update can move it on too, and keeps the applied date when none is sent
        putJson(session, BASE + "/" + id, """
                        {"company":"Acme","role":"SDE intern","status":"INTERVIEW","nextStep":"Technical round",
                         "nextStepAt":"%s"}""".formatted(inHours(30)))
                .andExpect(jsonPath("$.status").value("INTERVIEW"))
                .andExpect(jsonPath("$.appliedOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.jobUrl").doesNotExist())
                .andExpect(jsonPath("$.nextStep").value("Technical round"))
                .andExpect(jsonPath("$.history[*].toStatus", contains("SAVED", "APPLIED", "INTERVIEW")));
    }

    @Test
    void rejectsApplicationsThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("intern-invalid"));
        postJson(session, BASE, "{\"company\":\" \",\"role\":\"x\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("company"));
        postJson(session, BASE, "{\"company\":\"x\",\"role\":\"\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("role"));
        postJson(session, BASE, "{\"company\":\"x\",\"role\":\"y\",\"jobUrl\":\"javascript:alert(1)\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("jobUrl"));
        postJson(session, BASE, "{\"company\":\"x\",\"role\":\"y\",\"status\":\"GHOSTED\"}")
                .andExpect(status().isBadRequest());
        String id = idOf(postJson(session, BASE, "{\"company\":\"x\",\"role\":\"y\"}").andReturn());
        patchJson(session, BASE + "/" + id + "/status", "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("status"));
        mvc.perform(get(BASE + "/analytics").param("month", "Sept").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("month"));
    }

    @Test
    void listsAPageAndFiltersByStatus() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("intern-list"));
        postJson(session, BASE, "{\"company\":\"Old\",\"role\":\"r\",\"appliedOn\":\"%s\"}".formatted(TODAY.minusDays(20)));
        postJson(session, BASE, "{\"company\":\"New\",\"role\":\"r\",\"appliedOn\":\"%s\"}".formatted(TODAY));
        postJson(session, BASE, "{\"company\":\"Maybe\",\"role\":\"r\",\"status\":\"SAVED\"}");

        mvc.perform(get(BASE).cookie(session))
                .andExpect(jsonPath("$.items[*].company", contains("New", "Old", "Maybe")))
                .andExpect(jsonPath("$.totalItems").value(3));
        mvc.perform(get(BASE).param("status", "SAVED").cookie(session))
                .andExpect(jsonPath("$.items[*].company", contains("Maybe")));
        mvc.perform(get(BASE).param("size", "1").param("page", "1").cookie(session))
                .andExpect(jsonPath("$.items[*].company", contains("Old")))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void reportsTheMonthAndTheFunnel() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("intern-analytics"));
        String a = idOf(postJson(session, BASE, "{\"company\":\"A\",\"role\":\"r\",\"appliedOn\":\"%s\"}"
                        .formatted(TODAY))
                .andReturn());
        String b = idOf(postJson(session, BASE, "{\"company\":\"B\",\"role\":\"r\",\"appliedOn\":\"%s\"}"
                        .formatted(TODAY))
                .andReturn());
        postJson(session, BASE, "{\"company\":\"C\",\"role\":\"r\",\"appliedOn\":\"%s\"}".formatted(TODAY));
        postJson(session, BASE, "{\"company\":\"D\",\"role\":\"r\",\"status\":\"SAVED\"}");
        patchJson(session, BASE + "/" + a + "/status", "{\"status\":\"INTERVIEW\"}");
        patchJson(session, BASE + "/" + a + "/status", "{\"status\":\"REJECTED\"}");
        patchJson(session, BASE + "/" + b + "/status", "{\"status\":\"WITHDRAWN\"}");

        mvc.perform(get(BASE + "/analytics").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value(YearMonth.from(TODAY).toString()))
                .andExpect(jsonPath("$.applied").value(3))
                .andExpect(jsonPath("$.interviews").value(1))
                .andExpect(jsonPath("$.rejected").value(1))
                .andExpect(jsonPath("$.responseRate.responded").value(1))
                .andExpect(jsonPath("$.responseRate.value").value(33.3))
                .andExpect(jsonPath("$.responseRate.formula").value("responded / applied"))
                .andExpect(jsonPath("$.allTime.saved").value(1))
                .andExpect(jsonPath("$.allTime.applied").value(3))
                .andExpect(jsonPath("$.allTime.interview").value(1))
                .andExpect(jsonPath("$.allTime.withdrawn").value(1));
        mvc.perform(get(BASE + "/analytics").param("month", "2020-01").cookie(session))
                .andExpect(jsonPath("$.applied").value(0))
                .andExpect(jsonPath("$.responseRate.value").doesNotExist());
    }

    @Test
    void showsDeadlinesAndStepsOnTheCalendarAndHome() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("intern-home"));
        String saved = idOf(postJson(session, BASE, """
                        {"company":"Acme","role":"SDE intern","status":"SAVED","deadlineAt":"%s"}"""
                        .formatted(inHours(20)))
                .andReturn());
        postJson(session, BASE, """
                        {"company":"Globex","role":"Data intern","status":"INTERVIEW","nextStep":"HR call",
                         "nextStepAt":"%sT10:00:00Z"}""".formatted(TODAY.plusDays(3)));

        mvc.perform(get("/api/v1/calendar")
                        .param("from", TODAY.toString())
                        .param("to", TODAY.plusDays(6).toString())
                        .cookie(session))
                .andExpect(jsonPath("$.items[?(@.type == 'INTERNSHIP_DEADLINE')].title",
                        contains("Apply: SDE intern at Acme")))
                .andExpect(jsonPath("$.items[?(@.type == 'INTERNSHIP_STEP')].title", contains("Globex: HR call")))
                .andExpect(jsonPath("$.items[?(@.type == 'INTERNSHIP_STEP')].startTime", contains("10:00")))
                .andExpect(jsonPath("$.load[3].internshipSteps").value(1));

        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(jsonPath("$.needsAttention[*].kind", hasItem("INTERNSHIP_DEADLINE")))
                .andExpect(jsonPath("$.needsAttention[?(@.kind == 'INTERNSHIP_DEADLINE')].link",
                        contains("/app/developer/internships/" + saved)))
                .andExpect(jsonPath("$.developer.activeApplications").value(1))
                .andExpect(jsonPath("$.developer.nextInternshipStep.company").value("Globex"))
                .andExpect(jsonPath("$.developer.nextInternshipStep.step").value("HR call"));

        // Once applied, the apply-by date stops mattering
        patchJson(session, BASE + "/" + saved + "/status", "{\"status\":\"APPLIED\"}");
        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(jsonPath("$.needsAttention[?(@.kind == 'INTERNSHIP_DEADLINE')]", hasSize(0)))
                .andExpect(jsonPath("$.developer.activeApplications").value(2));
    }

    @Test
    void prepTasksLinkToItAndOutliveIt() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("intern-tasks"));
        String id = idOf(postJson(session, BASE, "{\"company\":\"Acme\",\"role\":\"SDE intern\"}").andReturn());
        String task = idOf(postJson(session, "/api/v1/tasks", "{\"title\":\"Revise DSA\",\"internshipId\":\"%s\"}"
                        .formatted(id))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("INTERNSHIP"))
                .andExpect(jsonPath("$.internshipName").value("SDE intern at Acme"))
                .andReturn());
        mvc.perform(get(BASE + "/" + id).cookie(session)).andExpect(jsonPath("$.openTasks").value(1));
        mvc.perform(get("/api/v1/tasks").param("internshipId", id).cookie(session))
                .andExpect(jsonPath("$.totalItems").value(1));

        deleteAs(session, BASE + "/" + id).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks/" + task).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.internshipId").doesNotExist());
    }

    @Test
    void usersOnlySeeTheirOwnApplications() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("intern-owner"));
        String id = idOf(postJson(owner, BASE, "{\"company\":\"Mine\",\"role\":\"r\"}").andReturn());

        Cookie other = registerAndGetSession(uniqueEmail("intern-other"));
        mvc.perform(get(BASE + "/" + id).cookie(other)).andExpect(status().isNotFound());
        putJson(other, BASE + "/" + id, "{\"company\":\"x\",\"role\":\"y\"}").andExpect(status().isNotFound());
        patchJson(other, BASE + "/" + id + "/status", "{\"status\":\"OFFER\"}").andExpect(status().isNotFound());
        deleteAs(other, BASE + "/" + id).andExpect(status().isNotFound());
        postJson(other, "/api/v1/tasks", "{\"title\":\"x\",\"internshipId\":\"%s\"}".formatted(id))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("internshipId"));
        mvc.perform(get(BASE).cookie(other)).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get(BASE + "/" + id).cookie(owner)).andExpect(jsonPath("$.status").value("APPLIED"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }
}
