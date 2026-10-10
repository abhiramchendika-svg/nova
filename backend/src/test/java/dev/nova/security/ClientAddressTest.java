package dev.nova.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientAddressTest {

    private static MockHttpServletRequest from(String peer, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(peer);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        return request;
    }

    @Test
    void behindTheProxyTheFirstForwardedAddressIsTheVisitor() {
        var address = new ClientAddress(true);
        assertThat(address.of(from("10.0.0.5", "203.0.113.9, 76.76.21.1"))).isEqualTo("203.0.113.9");
        assertThat(address.of(from("10.0.0.5", "2001:db8::1"))).isEqualTo("2001:db8::1");
    }

    @Test
    void behindTheProxyAMissingOrOddHeaderFallsBackToThePeer() {
        var address = new ClientAddress(true);
        assertThat(address.of(from("10.0.0.5", null))).isEqualTo("10.0.0.5");
        assertThat(address.of(from("10.0.0.5", "<script>, 1.2.3.4"))).isEqualTo("10.0.0.5");
        assertThat(address.of(from("10.0.0.5", ""))).isEqualTo("10.0.0.5");
    }

    @Test
    void withoutTheProxyForwardedHeadersAreIgnoredBecauseAnyoneCanSendThem() {
        var address = new ClientAddress(false);
        assertThat(address.of(from("198.51.100.7", "203.0.113.9"))).isEqualTo("198.51.100.7");
    }
}
