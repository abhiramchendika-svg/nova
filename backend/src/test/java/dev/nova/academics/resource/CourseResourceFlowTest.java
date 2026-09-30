package dev.nova.academics.resource;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.academics.AcademicsTestSupport;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/** Course links through the API. Which URLs are accepted is covered in detail by WebLinksTest. */
class CourseResourceFlowTest extends AcademicsTestSupport {

    private static String link(String title, String url) {
        return """
                {"title":"%s","url":"%s"}""".formatted(title, url);
    }

    private String courseFor(Cookie session) throws Exception {
        String semesterId = createSemester(session, "Semester 1", 1, TEN_POINT, true);
        return createCourse(session, semesterId, "Database Systems", "4");
    }

    @Test
    void addsListsUpdatesAndRemovesLinks() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("res-flow"));
        String links = "/api/v1/courses/" + courseFor(session) + "/resources";

        String syllabus = idOf(postJson(session, links, link(" Syllabus ", " https://example.edu/cse201/syllabus.pdf "))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith(links + "/")))
                .andExpect(jsonPath("$.title").value("Syllabus"))
                .andExpect(jsonPath("$.url").value("https://example.edu/cse201/syllabus.pdf"))
                .andReturn());
        postJson(session, links, link("Lectures", "https://example.edu/cse201/videos")).andExpect(status().isCreated());

        mvc.perform(get(links).cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].title").value("Syllabus"))
                .andExpect(jsonPath("$[1].title").value("Lectures"));

        putJson(session, links + "/" + syllabus, link("Syllabus (v2)", "https://example.edu/cse201/syllabus-v2.pdf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Syllabus (v2)"))
                .andExpect(jsonPath("$.url").value("https://example.edu/cse201/syllabus-v2.pdf"));

        deleteAs(session, links + "/" + syllabus).andExpect(status().isNoContent());
        mvc.perform(get(links).cookie(session)).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void acceptsOnlyWebLinks() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("res-invalid"));
        String links = "/api/v1/courses/" + courseFor(session) + "/resources";

        postJson(session, links, link("XSS", "javascript:alert(1)"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("url"));
        postJson(session, links, link("Local", "file:///C:/notes.txt"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("url"));
        postJson(session, links, link("", "https://example.edu"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        postJson(session, links, link("No link", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("url"));
        mvc.perform(get(links).cookie(session)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void otherUsersLinksLookLikeTheyDontExist() throws Exception {
        Cookie owner = registerAndGetSession(uniqueEmail("res-owner"));
        Cookie other = registerAndGetSession(uniqueEmail("res-other"));
        String course = courseFor(owner);
        String links = "/api/v1/courses/" + course + "/resources";
        String id = idOf(postJson(owner, links, link("Syllabus", "https://example.edu/s.pdf")).andReturn());

        mvc.perform(get(links).cookie(other)).andExpect(status().isNotFound());
        postJson(other, links, link("Mine", "https://example.edu/x")).andExpect(status().isNotFound());
        putJson(other, links + "/" + id, link("Mine", "https://example.edu/x")).andExpect(status().isNotFound());
        deleteAs(other, links + "/" + id).andExpect(status().isNotFound());

        // A link is only reachable through its own course
        String otherCourse = createCourse(owner, createSemester(owner, "Semester 2", 2, TEN_POINT, false), "OS", "4");
        deleteAs(owner, "/api/v1/courses/" + otherCourse + "/resources/" + id).andExpect(status().isNotFound());

        mvc.perform(get(links).cookie(owner))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("Syllabus")); // untouched
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/v1/courses/00000000-0000-4000-8000-00000000abcd/resources"))
                .andExpect(status().isUnauthorized());
    }
}
