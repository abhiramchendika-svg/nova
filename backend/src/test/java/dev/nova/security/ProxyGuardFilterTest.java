package dev.nova.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** The shared-secret check in front of the API, without Spring: a request in, a status out. */
class ProxyGuardFilterTest {

    private static final String SECRET = "a-long-random-secret-for-the-proxy-0123456789";

    private static MockHttpServletResponse call(ProxyGuardFilter filter, String path, String header) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        if (header != null) {
            request.addHeader(ProxyGuardFilter.HEADER, header);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        if (chain.getRequest() != null) {
            response.setStatus(299); // marks "went on to the application"
        }
        return response;
    }

    @Test
    void withTheRightSecretTheCallGoesThrough() throws Exception {
        var filter = new ProxyGuardFilter(SECRET, true);
        assertThat(call(filter, "/api/v1/tasks", SECRET).getStatus()).isEqualTo(299);
    }

    @Test
    void withoutItOrWithAWrongOneTheApiAnswers403() throws Exception {
        var filter = new ProxyGuardFilter(SECRET, true);
        MockHttpServletResponse missing = call(filter, "/api/v1/tasks", null);
        assertThat(missing.getStatus()).isEqualTo(403);
        assertThat(missing.getContentType()).isEqualTo("application/problem+json");
        assertThat(missing.getContentAsString()).contains("\"code\":\"FORBIDDEN\"");
        assertThat(call(filter, "/api/v1/tasks", SECRET + "x").getStatus()).isEqualTo(403);
        assertThat(call(filter, "/api/v1/auth/login", "guess").getStatus()).isEqualTo(403);
    }

    @Test
    void healthChecksAndNonApiPathsNeedNoSecret() throws Exception {
        var filter = new ProxyGuardFilter(SECRET, true);
        assertThat(call(filter, "/api/v1/health", null).getStatus()).isEqualTo(299);
        assertThat(call(filter, "/actuator/health", null).getStatus()).isEqualTo(299);
    }

    @Test
    void withoutASecretConfiguredNothingIsChecked() throws Exception {
        var filter = new ProxyGuardFilter("", false);
        assertThat(filter.enabled()).isFalse();
        assertThat(call(filter, "/api/v1/tasks", null).getStatus()).isEqualTo(299);
    }

    @Test
    void productionRefusesToStartWithoutAStrongSecret() {
        assertThatThrownBy(() -> new ProxyGuardFilter("", true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("NOVA_PROXY_SECRET");
        assertThatThrownBy(() -> new ProxyGuardFilter("short", true)).isInstanceOf(IllegalStateException.class);
        assertThatCode(() -> new ProxyGuardFilter(SECRET, true)).doesNotThrowAnyException();
    }
}
