package dev.nova.developer.learning;

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
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** Learning goals, topics, links and study tasks end to end. */
class LearningFlowTest extends AcademicsTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);
    private static final String BASE = "/api/v1/learning-goals";

    private static String read(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    @Test
    void createsAGoalWithStarterTopics() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("learn-create"));

        String id = idOf(postJson(session, BASE, """
                        {"title":"  Spring Boot  ","description":"  ","targetOn":"%s","topics":[" DI ","Data JPA","Security"]}"""
                        .formatted(TODAY.plusDays(30)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/learning-goals/")))
                .andExpect(jsonPath("$.title").value("Spring Boot"))
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.topics[*].title", contains("DI", "Data JPA", "Security")))
                .andExpect(jsonPath("$.topics[*].position", contains(0, 1, 2)))
                .andExpect(jsonPath("$.progress.total").value(3))
                .andExpect(jsonPath("$.progress.percentage").value(0))
                .andExpect(jsonPath("$.nextTopic.title").value("DI"))
                .andExpect(jsonPath("$.resources", hasSize(0)))
                .andReturn());

        postJson(session, BASE, "{\"title\":\"Rust\",\"status\":\"PAUSED\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.progress.percentage").doesNotExist())
                .andExpect(jsonPath("$.nextTopic").doesNotExist());

        // Starter topics are read on create only; an update keeps them
        putJson(session, BASE + "/" + id, "{\"title\":\"Spring Boot 4\",\"status\":\"DONE\",\"topics\":[\"x\"]}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Spring Boot 4"))
                .andExpect(jsonPath("$.targetOn").doesNotExist())
                .andExpect(jsonPath("$.topics", hasSize(3)));

        mvc.perform(get(BASE).cookie(session)).andExpect(jsonPath("$[*].title", contains("Rust", "Spring Boot 4")));
        mvc.perform(get(BASE).param("status", "PAUSED").cookie(session))
                .andExpect(jsonPath("$[*].title", contains("Rust")));
    }

    @Test
    void rejectsGoalsThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("learn-invalid"));
        postJson(session, BASE, "{\"title\":\" \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        postJson(session, BASE, "{\"title\":\"x\",\"topics\":[\"ok\",\" \"]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field", startsWith("topics")));
        postJson(session, BASE, "{\"title\":\"x\",\"status\":\"STOPPED\"}").andExpect(status().isBadRequest());
        mvc.perform(get(BASE).cookie(session)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void topicsAreAChecklist() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("learn-topics"));
        MvcResult created = postJson(session, BASE, "{\"title\":\"SQL\",\"topics\":[\"Joins\",\"Indexes\"]}")
                .andReturn();
        String id = read(created, "$.id");
        String joins = read(created, "$.topics[0].id");
        String indexes = read(created, "$.topics[1].id");
        String topics = BASE + "/" + id + "/topics";

        String window = read(postJson(session, topics, "{\"title\":\" Window functions \"}")
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.topics[2].title").value("Window functions"))
                        .andReturn(),
                "$.topics[2].id");

        patchJson(session, topics + "/" + joins, "{\"done\":true}")
                .andExpect(jsonPath("$.progress.percentage").value(33))
                .andExpect(jsonPath("$.nextTopic.title").value("Indexes"));
        patchJson(session, topics + "/" + window, "{\"position\":0,\"title\":\"Window fns\"}")
                .andExpect(jsonPath("$.topics[*].title", contains("Window fns", "Joins", "Indexes")))
                .andExpect(jsonPath("$.nextTopic.title").value("Window fns"));
        patchJson(session, topics + "/" + window, "{}").andExpect(status().isBadRequest());
        patchJson(session, topics + "/" + window, "{\"position\":3}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("position"));

        deleteAs(session, topics + "/" + indexes)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topics[*].title", contains("Window fns", "Joins")))
                .andExpect(jsonPath("$.topics[*].position", contains(0, 1)))
                .andExpect(jsonPath("$.progress.percentage").value(50));
    }

    @Test
    void keepsResourceLinks() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("learn-links"));
        String id = idOf(postJson(session, BASE, "{\"title\":\"Spring\"}").andReturn());
        String links = BASE + "/" + id + "/resources";

        MvcResult added = postJson(session, links, "{\"title\":\"Docs\",\"url\":\" https://docs.spring.io \"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.resources[0].url").value("https://docs.spring.io"))
                .andReturn();
        String docs = read(added, "$.resources[0].id");
        postJson(session, links, "{\"title\":\"Course\",\"url\":\"https://example.com/course\"}")
                .andExpect(jsonPath("$.resources[*].title", contains("Docs", "Course")));
        postJson(session, links, "{\"title\":\"Bad\",\"url\":\"javascript:alert(1)\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("url"));

        putJson(session, links + "/" + docs, "{\"title\":\"Reference\",\"url\":\"https://docs.spring.io/boot\"}")
                .andExpect(jsonPath("$.resources[0].title").value("Reference"));
        deleteAs(session, links + "/" + docs)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resources[*].title", contains("Course")));
    }

    @Test
    void studyTasksLinkToGoalsAndOutliveThem() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("learn-tasks"));
        String id = idOf(postJson(session, BASE, """
                        {"title":"Spring Boot","targetOn":"%s","topics":["DI"]}""".formatted(TODAY.plusDays(10)))
                .andReturn());

        postJson(session, "/api/v1/tasks/batch", """
                        {"tasks":[{"title":"Study: DI","learningGoalId":"%s","category":"CODING","plannedFor":"%s"}]}"""
                        .formatted(id, TODAY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tasks[0].learningGoalId").value(id))
                .andExpect(jsonPath("$.tasks[0].learningGoalTitle").value("Spring Boot"));
        String plain = idOf(postJson(session, "/api/v1/tasks", """
                        {"title":"Read the guide","learningGoalId":"%s"}""".formatted(id))
                .andExpect(jsonPath("$.category").value("CODING"))
                .andReturn());

        mvc.perform(get(BASE + "/" + id).cookie(session)).andExpect(jsonPath("$.openTasks").value(2));
        mvc.perform(get("/api/v1/tasks").param("learningGoalId", id).cookie(session))
                .andExpect(jsonPath("$.totalItems").value(2));
        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(jsonPath("$.developer.activeGoals").value(1))
                .andExpect(jsonPath("$.developer.focusGoal.title").value("Spring Boot"))
                .andExpect(jsonPath("$.developer.focusGoal.nextTopic").value("DI"))
                .andExpect(jsonPath("$.developer.focusGoal.percentage").value(0));

        deleteAs(session, BASE + "/" + id).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks/" + plain).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.learningGoalId").doesNotExist());
    }

    @Test
    void usersOnlySeeTheirOwnGoals() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("learn-owner"));
        MvcResult created = postJson(owner, BASE, "{\"title\":\"Mine\",\"topics\":[\"t\"]}").andReturn();
        String id = read(created, "$.id");
        String topic = read(created, "$.topics[0].id");

        Cookie other = registerAndGetSession(uniqueEmail("learn-other"));
        mvc.perform(get(BASE + "/" + id).cookie(other)).andExpect(status().isNotFound());
        putJson(other, BASE + "/" + id, "{\"title\":\"x\"}").andExpect(status().isNotFound());
        patchJson(other, BASE + "/" + id + "/topics/" + topic, "{\"done\":true}").andExpect(status().isNotFound());
        postJson(other, BASE + "/" + id + "/resources", "{\"title\":\"x\",\"url\":\"https://x.dev\"}")
                .andExpect(status().isNotFound());
        deleteAs(other, BASE + "/" + id).andExpect(status().isNotFound());
        postJson(other, "/api/v1/tasks", "{\"title\":\"x\",\"learningGoalId\":\"%s\"}".formatted(id))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("learningGoalId"));
        mvc.perform(get(BASE + "/" + id).cookie(owner)).andExpect(jsonPath("$.title").value("Mine"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }
}
