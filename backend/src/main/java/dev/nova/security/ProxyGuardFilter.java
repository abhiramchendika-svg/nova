package dev.nova.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * In production the API is only reachable through the website's own proxy (Vercel rewrites /api to
 * Render and adds a secret header). Calls straight to the backend's public URL are refused, so the
 * client IP the proxy reports can be trusted (see {@link ClientAddress}) and nobody can skip it.
 *
 * Off when {@code nova.proxy.secret} is empty (local development, tests). With
 * {@code nova.proxy.required=true} (the prod profile) the app refuses to start without a strong
 * secret, so a misconfigured deploy fails loudly instead of running unprotected.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ProxyGuardFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Nova-Proxy-Secret";
    static final int MIN_SECRET_LENGTH = 32;

    /** Liveness checks (Render's health check, the keep-warm ping) need no secret and reveal nothing. */
    private static final String HEALTH = "/api/v1/health";

    private static final byte[] FORBIDDEN = """
            {"type":"about:blank","title":"Use the NOVA website","status":403,"code":"FORBIDDEN"}"""
            .getBytes(StandardCharsets.UTF_8);

    private final byte[] secret;

    public ProxyGuardFilter(
            @Value("${nova.proxy.secret:}") String secret, @Value("${nova.proxy.required:false}") boolean required) {
        String trimmed = secret.strip();
        if (required && trimmed.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException("NOVA_PROXY_SECRET must be set to at least " + MIN_SECRET_LENGTH
                    + " random characters in production (the website's proxy sends it with every API call)");
        }
        this.secret = trimmed.isEmpty() ? null : trimmed.getBytes(StandardCharsets.UTF_8);
    }

    /** Whether API calls must carry the proxy secret (and so whether forwarded client IPs are trusted). */
    public boolean enabled() {
        return secret != null;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return secret == null || !path.startsWith("/api/") || path.equals(HEALTH);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String sent = request.getHeader(HEADER);
        // Constant-time comparison: the time taken doesn't reveal how much of the secret matched
        if (sent != null && MessageDigest.isEqual(secret, sent.getBytes(StandardCharsets.UTF_8))) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/problem+json");
        response.getOutputStream().write(FORBIDDEN);
    }
}
