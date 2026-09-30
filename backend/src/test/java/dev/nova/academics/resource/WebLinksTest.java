package dev.nova.academics.resource;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Stored links end up in an href, so anything that isn't a plain web address is refused. */
class WebLinksTest {

    @ParameterizedTest
    @ValueSource(strings = {
        "https://example.edu/cse201/syllabus.pdf",
        "http://example.edu",
        "HTTPS://Example.edu/Path?q=1#frag",
        "https://example.edu:8443/lms/course/42",
    })
    void acceptsWebLinks(String url) {
        assertThat(WebLinks.normalize(url)).contains(url);
    }

    @Test
    void trimsSurroundingWhitespace() {
        assertThat(WebLinks.normalize("  https://example.edu/a  ")).contains("https://example.edu/a");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "ftp://example.edu/file",
        "https:/example.edu",
        "https:example.edu",
        "https://",
        "//example.edu/no-scheme",
        "example.edu",
        "https://exa mple.edu",
        "https://example.edu/\nnext",
        "",
        "   ",
    })
    void refusesAnythingElse(String url) {
        assertThat(WebLinks.normalize(url)).isEmpty();
    }

    @Test
    void refusesOverlongLinks() {
        String longUrl = "https://example.edu/" + "a".repeat(WebLinks.MAX_LENGTH);
        assertThat(WebLinks.normalize(longUrl)).isEmpty();
        assertThat(WebLinks.normalize(null)).isEmpty();
    }
}
