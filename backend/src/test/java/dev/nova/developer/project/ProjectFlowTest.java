package dev.nova.developer.project;

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

/** Projects, milestones and the task link end to end. Stack tidying is covered by TechStackTest. */
class ProjectFlowTest extends AcademicsTestSupport {

    /** The test user's timezone is UTC (the default). */
    private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

    private String createProject(Cookie session, String json) throws Exception {
        return idOf(postJson(session, "/api/v1/projects", json).andExpect(status().isCreated()).andReturn());
    }

    private static String milestoneId(MvcResult result, int index) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.milestones[" + index + "].id");
    }

    @Test
    void createsAProjectWithTidiedDetails() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("proj-create"));

        String id = idOf(postJson(session, "/api/v1/projects", """
                        {"name":"  NOVA  ","description":"  Student OS  ","techStack":[" Java ","React","java",""],
                         "repoUrl":" https://github.com/example/nova ","status":"DEVELOPMENT",
                         "startedOn":"2026-09-01","targetOn":"2026-12-01"}""")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/projects/")))
                .andExpect(jsonPath("$.name").value("NOVA"))
                .andExpect(jsonPath("$.description").value("Student OS"))
                .andExpect(jsonPath("$.techStack", contains("Java", "React")))
                .andExpect(jsonPath("$.repoUrl").value("https://github.com/example/nova"))
                .andExpect(jsonPath("$.demoUrl").doesNotExist())
                .andExpect(jsonPath("$.status").value("DEVELOPMENT"))
                .andExpect(jsonPath("$.progress.total").value(0))
                .andExpect(jsonPath("$.progress.percentage").doesNotExist())
                .andExpect(jsonPath("$.nextMilestone").doesNotExist())
                .andExpect(jsonPath("$.openTasks").value(0))
                .andExpect(jsonPath("$.milestones", hasSize(0)))
                .andReturn());

        // A minimal project starts as an idea
        postJson(session, "/api/v1/projects", """
                        {"name":"Side quest"}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("IDEA"))
                .andExpect(jsonPath("$.techStack", hasSize(0)));

        putJson(session, "/api/v1/projects/" + id, """
                        {"name":"NOVA","techStack":["Java"],"status":"COMPLETED","demoUrl":"http://nova.example.dev"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.repoUrl").doesNotExist())
                .andExpect(jsonPath("$.demoUrl").value("http://nova.example.dev"));

        mvc.perform(get("/api/v1/projects").cookie(session))
                .andExpect(jsonPath("$[*].name", contains("Side quest", "NOVA")));
        mvc.perform(get("/api/v1/projects").param("status", "COMPLETED", "ARCHIVED").cookie(session))
                .andExpect(jsonPath("$[*].name", contains("NOVA")));
    }

    @Test
    void rejectsProjectsThatCantBeRight() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("proj-invalid"));

        postJson(session, "/api/v1/projects", "{\"name\":\"  \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"));
        postJson(session, "/api/v1/projects", """
                        {"name":"x","repoUrl":"javascript:alert(1)"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("repoUrl"));
        postJson(session, "/api/v1/projects", """
                        {"name":"x","demoUrl":"github.com/example"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("demoUrl"));
        postJson(session, "/api/v1/projects", """
                        {"name":"x","techStack":["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p"]}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("techStack"));
        postJson(session, "/api/v1/projects", """
                        {"name":"x","startedOn":"2026-10-10","targetOn":"2026-10-01"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("targetOn"));
        postJson(session, "/api/v1/projects", """
                        {"name":"x","status":"SHIPPED"}""")
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/v1/projects").cookie(session)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void milestonesDriveProgress() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("proj-milestones"));
        String id = createProject(session, "{\"name\":\"NOVA\"}");
        String base = "/api/v1/projects/" + id + "/milestones";

        postJson(session, base, "{\"title\":\"Design\",\"dueOn\":\"%s\"}".formatted(TODAY.minusDays(1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.milestones[0].overdue").value(true));
        postJson(session, base, "{\"title\":\"Build\"}").andExpect(status().isCreated());
        MvcResult three = postJson(session, base, "{\"title\":\" Ship \",\"dueOn\":\"%s\"}".formatted(TODAY.plusDays(30)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.milestones[*].title", contains("Design", "Build", "Ship")))
                .andExpect(jsonPath("$.milestones[*].position", contains(0, 1, 2)))
                .andExpect(jsonPath("$.progress.total").value(3))
                .andExpect(jsonPath("$.progress.percentage").value(0))
                .andExpect(jsonPath("$.nextMilestone.title").value("Design"))
                .andReturn();
        String design = milestoneId(three, 0);
        String build = milestoneId(three, 1);
        String ship = milestoneId(three, 2);

        // Ticking the first moves "next" on and counts towards progress (1 of 3 → 33%)
        patchJson(session, base + "/" + design, "{\"done\":true}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones[0].done").value(true))
                .andExpect(jsonPath("$.milestones[0].overdue").value(false))
                .andExpect(jsonPath("$.progress.percentage").value(33))
                .andExpect(jsonPath("$.nextMilestone.title").value("Build"));

        // Move "Ship" to the top
        patchJson(session, base + "/" + ship, "{\"position\":0}")
                .andExpect(jsonPath("$.milestones[*].title", contains("Ship", "Design", "Build")))
                .andExpect(jsonPath("$.milestones[*].position", contains(0, 1, 2)))
                .andExpect(jsonPath("$.nextMilestone.title").value("Ship"));
        patchJson(session, base + "/" + ship, "{\"position\":3}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("position"));
        patchJson(session, base + "/" + ship, "{}")
                .andExpect(status().isBadRequest());

        // Rename and clear the due date
        putJson(session, base + "/" + ship, "{\"title\":\"Launch\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones[0].title").value("Launch"))
                .andExpect(jsonPath("$.milestones[0].dueOn").doesNotExist());

        // Delete renumbers the rest
        deleteAs(session, base + "/" + design)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones[*].title", contains("Launch", "Build")))
                .andExpect(jsonPath("$.milestones[*].position", contains(0, 1)))
                .andExpect(jsonPath("$.progress.done").value(0));

        postJson(session, base, "{\"title\":\"  \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        mvc.perform(get("/api/v1/projects/" + id).cookie(session))
                .andExpect(jsonPath("$.milestones[1].id").value(build));
    }

    @Test
    void tasksLinkToProjectsAndOutliveThem() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("proj-tasks"));
        String id = createProject(session, "{\"name\":\"NOVA\",\"status\":\"DEVELOPMENT\"}");

        String task = idOf(postJson(session, "/api/v1/tasks", """
                        {"title":"Write the README","projectId":"%s","plannedFor":"%s"}""".formatted(id, TODAY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projectId").value(id))
                .andExpect(jsonPath("$.projectName").value("NOVA"))
                .andExpect(jsonPath("$.category").value("PROJECT"))
                .andReturn());
        String done = idOf(postJson(session, "/api/v1/tasks", """
                        {"title":"Set up CI","projectId":"%s"}""".formatted(id))
                .andExpect(status().isCreated())
                .andReturn());
        patchJson(session, "/api/v1/tasks/" + done + "/status", "{\"status\":\"DONE\"}").andExpect(status().isOk());

        mvc.perform(get("/api/v1/projects/" + id).cookie(session)).andExpect(jsonPath("$.openTasks").value(1));
        mvc.perform(get("/api/v1/tasks").param("projectId", id).cookie(session))
                .andExpect(jsonPath("$.totalItems").value(2));

        // A course outranks the project for the default category
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        String dbms = createCourse(session, semesterId, "Database Systems", "4");
        postJson(session, "/api/v1/tasks", """
                        {"title":"DB schema","projectId":"%s","courseId":"%s"}""".formatted(id, dbms))
                .andExpect(jsonPath("$.category").value("ACADEMIC"));

        // Milestones with a due date show on the calendar
        postJson(session, "/api/v1/projects/" + id + "/milestones",
                        "{\"title\":\"Beta\",\"dueOn\":\"%s\"}".formatted(TODAY.plusDays(2)))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/v1/calendar")
                        .param("from", TODAY.toString())
                        .param("to", TODAY.plusDays(6).toString())
                        .cookie(session))
                .andExpect(jsonPath("$.items[?(@.type == 'MILESTONE')].title", contains("Beta")))
                .andExpect(jsonPath("$.items[?(@.type == 'MILESTONE')].refId", contains(id)))
                .andExpect(jsonPath("$.items[?(@.type == 'MILESTONE')].projectName", contains("NOVA")))
                .andExpect(jsonPath("$.load[2].deadlines").value(1));
        // …and on Home
        mvc.perform(get("/api/v1/dashboard").cookie(session))
                .andExpect(jsonPath("$.developer.inDevelopment").value(1))
                .andExpect(jsonPath("$.developer.activeProjects").value(1))
                .andExpect(jsonPath("$.developer.nextMilestone.title").value("Beta"))
                .andExpect(jsonPath("$.developer.nextMilestone.projectName").value("NOVA"))
                .andExpect(jsonPath("$.developer.nextMilestone.overdue").value(false));

        deleteAs(session, "/api/v1/projects/" + id).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/tasks/" + task).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").doesNotExist())
                .andExpect(jsonPath("$.category").value("PROJECT"));
        mvc.perform(get("/api/v1/projects/" + id).cookie(session)).andExpect(status().isNotFound());
    }

    @Test
    void usersOnlySeeTheirOwnProjects() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("proj-owner"));
        String id = createProject(owner, "{\"name\":\"Mine\"}");
        MvcResult withMilestone = postJson(owner, "/api/v1/projects/" + id + "/milestones", "{\"title\":\"M\"}")
                .andReturn();
        String milestone = milestoneId(withMilestone, 0);

        Cookie other = registerAndGetSession(uniqueEmail("proj-other"));
        mvc.perform(get("/api/v1/projects/" + id).cookie(other)).andExpect(status().isNotFound());
        putJson(other, "/api/v1/projects/" + id, "{\"name\":\"Stolen\"}").andExpect(status().isNotFound());
        deleteAs(other, "/api/v1/projects/" + id).andExpect(status().isNotFound());
        postJson(other, "/api/v1/projects/" + id + "/milestones", "{\"title\":\"x\"}")
                .andExpect(status().isNotFound());
        patchJson(other, "/api/v1/projects/" + id + "/milestones/" + milestone, "{\"done\":true}")
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/projects").cookie(other)).andExpect(jsonPath("$", hasSize(0)));
        postJson(other, "/api/v1/tasks", "{\"title\":\"x\",\"projectId\":\"%s\"}".formatted(id))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("projectId"));

        mvc.perform(get("/api/v1/projects/" + id).cookie(owner)).andExpect(jsonPath("$.name").value("Mine"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/projects")).andExpect(status().isUnauthorized());
    }
}
