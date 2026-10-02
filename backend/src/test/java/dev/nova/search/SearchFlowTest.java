package dev.nova.search;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/** Search across everything the user owns, and only that. */
class SearchFlowTest extends AcademicsTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);
    private static final String URL = "/api/v1/search";

    @Test
    void findsMatchesOfEveryKindBestFirst() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("search-all"));
        String semester = createSemester(session, "Semester 3", 3, TEN_POINT, true);
        String dbms = idOf(postJson(session, "/api/v1/courses", """
                        {"semesterId":"%s","code":"CSE 201","name":"Database Systems","credits":4}"""
                        .formatted(semester))
                .andExpect(status().isCreated())
                .andReturn());
        postJson(session, "/api/v1/assignments", """
                        {"courseId":"%s","title":"Normalisation worksheet","dueAt":"%sT18:00:00Z"}"""
                        .formatted(dbms, TODAY.plusDays(3)));
        postJson(session, "/api/v1/exams", """
                        {"courseId":"%s","title":"Database midsem","startsAt":"%sT09:00:00Z"}"""
                        .formatted(dbms, TODAY.plusDays(9)));
        postJson(session, "/api/v1/tasks", "{\"title\":\"Revise database indexes\",\"plannedFor\":\"%s\"}"
                .formatted(TODAY));
        postJson(session, "/api/v1/tasks", "{\"title\":\"Email the database TA\"}");
        postJson(session, "/api/v1/projects", "{\"name\":\"Database visualiser\"}");
        postJson(session, "/api/v1/learning-goals", "{\"title\":\"PostgreSQL internals (database)\"}");
        postJson(session, "/api/v1/hackathons", "{\"name\":\"Database Hack\"}");
        postJson(session, "/api/v1/internships", "{\"company\":\"Acme Databases\",\"role\":\"Backend intern\"}");

        mvc.perform(get(URL).param("q", "  DATABASE ").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.q").value("DATABASE"))
                .andExpect(jsonPath("$.courses[0].title").value("Database Systems"))
                .andExpect(jsonPath("$.courses[0].subtitle").value("CSE 201"))
                .andExpect(jsonPath("$.courses[0].link").value("/app/academics/courses/" + dbms))
                .andExpect(jsonPath("$.assignments", hasSize(0)))
                .andExpect(jsonPath("$.exams[0].title").value("Database midsem"))
                .andExpect(jsonPath("$.exams[0].subtitle").value(org.hamcrest.Matchers.startsWith("CSE 201 · ")))
                // Titles starting with the query come first, then A–Z
                .andExpect(jsonPath("$.tasks[*].title", contains("Email the database TA", "Revise database indexes")))
                .andExpect(jsonPath("$.tasks[1].subtitle").value(org.hamcrest.Matchers.startsWith("Planned ")))
                .andExpect(jsonPath("$.projects[0].link").value(org.hamcrest.Matchers.startsWith("/app/developer/projects/")))
                .andExpect(jsonPath("$.learningGoals[0].title").value("PostgreSQL internals (database)"))
                .andExpect(jsonPath("$.hackathons[0].title").value("Database Hack"))
                .andExpect(jsonPath("$.internships[0].title").value("Backend intern at Acme Databases"));

        // By course code, and an assignment's course in its subtitle
        mvc.perform(get(URL).param("q", "cse 201").cookie(session))
                .andExpect(jsonPath("$.courses[*].title", contains("Database Systems")));
        mvc.perform(get(URL).param("q", "normal").cookie(session))
                .andExpect(jsonPath("$.assignments[0].subtitle").value(org.hamcrest.Matchers.startsWith("CSE 201 · due ")))
                .andExpect(jsonPath("$.assignments[0].link").value("/app/academics/assignments?course=" + dbms));
    }

    @Test
    void ranksStartsWithFirstAndLimits() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("search-rank"));
        for (String title : new String[] {"Read about labs", "Lab 3 report", "Lab 1 report", "Collab notes", "Lab 2"}) {
            postJson(session, "/api/v1/tasks", "{\"title\":\"%s\"}".formatted(title));
        }
        mvc.perform(get(URL).param("q", "lab").param("limit", "3").cookie(session))
                .andExpect(jsonPath("$.tasks[*].title", contains("Lab 1 report", "Lab 2", "Lab 3 report")));
    }

    @Test
    void treatsWildcardsLiterally() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("search-literal"));
        postJson(session, "/api/v1/tasks", "{\"title\":\"Score 50% on mock\"}");
        postJson(session, "/api/v1/tasks", "{\"title\":\"Score 500 points\"}");
        postJson(session, "/api/v1/tasks", "{\"title\":\"snake_case rename\"}");
        postJson(session, "/api/v1/tasks", "{\"title\":\"snakeXcase rename\"}");
        mvc.perform(get(URL).param("q", "50%").cookie(session))
                .andExpect(jsonPath("$.tasks[*].title", contains("Score 50% on mock")));
        mvc.perform(get(URL).param("q", "e_c").cookie(session))
                .andExpect(jsonPath("$.tasks[*].title", contains("snake_case rename")));
    }

    @Test
    void checksTheQuery() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("search-invalid"));
        mvc.perform(get(URL).param("q", " a ").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
        mvc.perform(get(URL).cookie(session)).andExpect(status().isBadRequest());
        mvc.perform(get(URL).param("q", "x".repeat(101)).cookie(session)).andExpect(status().isBadRequest());
        mvc.perform(get(URL).param("q", "lab").param("limit", "11").cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("limit"));
    }

    @Test
    void onlySearchesTheUsersOwnRecords() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("search-owner"));
        postJson(owner, "/api/v1/tasks", "{\"title\":\"Secret plan\"}");
        Cookie other = registerAndGetSession(uniqueEmail("search-other"));
        mvc.perform(get(URL).param("q", "secret").cookie(other)).andExpect(jsonPath("$.tasks", hasSize(0)));
        mvc.perform(get(URL).param("q", "secret").cookie(owner)).andExpect(jsonPath("$.tasks", hasSize(1)));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(URL).param("q", "lab")).andExpect(status().isUnauthorized());
    }
}
