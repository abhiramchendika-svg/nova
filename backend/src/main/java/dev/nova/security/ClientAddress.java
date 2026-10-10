package dev.nova.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * The visitor's IP address, for rate limits. Behind the website's proxy every request arrives from
 * the proxy, so the real address is the first X-Forwarded-For entry: Vercel overwrites that header
 * with the client's IP (callers can't plant their own), and later hops only append. That is trusted
 * only while {@link ProxyGuardFilter} is on, i.e. only calls that came through the proxy reach the API.
 * Otherwise (local development, tests) the TCP peer address is used.
 */
@Component
public class ClientAddress {

    /** IPv4 or IPv6 characters only: anything else in the header is ignored rather than used as a key. */
    private static final Pattern IP = Pattern.compile("[0-9A-Fa-f:.]{2,45}");

    private final boolean behindProxy;

    @Autowired
    public ClientAddress(ProxyGuardFilter guard) {
        this.behindProxy = guard.enabled();
    }

    /** For tests. */
    ClientAddress(boolean behindProxy) {
        this.behindProxy = behindProxy;
    }

    public String of(HttpServletRequest request) {
        if (behindProxy) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null) {
                String first = forwarded.split(",", 2)[0].strip();
                if (IP.matcher(first).matches()) {
                    return first;
                }
            }
        }
        return request.getRemoteAddr();
    }
}
