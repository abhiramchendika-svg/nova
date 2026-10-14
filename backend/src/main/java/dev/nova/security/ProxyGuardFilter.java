package dev.nova.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(ProxyGuardFilter.class);
    private static final long LOG_EVERY_MS = 10_000;

    private final byte[] secret;
    private final AtomicLong lastLogged = new AtomicLong();

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

    /**
     * Says why a call was refused, for setting up the proxy, without ever logging the secret itself:
     * only whether the header came, its length and whether it looks like an unexpanded "$VARIABLE".
     * At most once every ten seconds, so a flood of direct calls can't flood the logs.
     */
    private void logRejection(String sent) {
        long now = System.currentTimeMillis();
        long last = lastLogged.get();
        if (now - last < LOG_EVERY_MS || !lastLogged.compareAndSet(last, now)) {
            return;
        }
        if (sent == null) {
            log.warn("Proxy guard: refused an API call without the {} header", HEADER);
        } else {
            log.warn(
                    "Proxy guard: refused an API call with a wrong {} ({} characters, expected {}{})",
                    HEADER,
                    sent.length(),
                    secret.length,
                    sent.startsWith("$") ? "; it looks like an unexpanded variable name" : "");
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return secret == null || !path.startsWith("/api/") || path.equals(HEALTH);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String raw = request.getHeader(HEADER);
        String sent = raw == null ? null : raw.strip(); // a pasted value may carry a stray space or newline
        // Constant-time comparison: the time taken doesn't reveal how much of the secret matched
        if (sent != null && MessageDigest.isEqual(secret, sent.getBytes(StandardCharsets.UTF_8))) {
            chain.doFilter(request, response);
            return;
        }
        logRejection(sent);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/problem+json");
        response.getOutputStream().write(FORBIDDEN);
    }
}
