package dev.nova.auth;

import dev.nova.auth.AuthDtos.CurrentUserResponse;
import dev.nova.auth.AuthDtos.LoginRequest;
import dev.nova.auth.AuthDtos.RegisterRequest;
import dev.nova.security.NovaUserDetails;
import dev.nova.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * /api/v1/auth — HTTP concerns only (status codes, session). Rules live in {@link AuthService}.
 * Logout is handled by Spring Security itself (POST /api/v1/auth/logout, see SecurityConfig).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final SecurityContextRepository securityContextRepository;
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    public AuthController(AuthService authService, SecurityContextRepository securityContextRepository) {
        this.authService = authService;
        this.securityContextRepository = securityContextRepository;
    }

    /**
     * Issues the XSRF-TOKEN cookie. Tokens are created lazily, so reading it here is what makes
     * Spring Security write the cookie. The SPA calls this before its first state-changing request.
     */
    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        token.getToken();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/register")
    public ResponseEntity<CurrentUserResponse> register(
            @Valid @RequestBody RegisterRequest body, HttpServletRequest request, HttpServletResponse response) {
        User user = authService.register(body);
        NovaUserDetails principal = NovaUserDetails.withoutCredentials(user);
        startSession(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()),
                request,
                response);
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.currentUser(user.getId()));
    }

    @PostMapping("/login")
    public CurrentUserResponse login(
            @Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        Authentication authentication = authService.authenticate(body.email(), body.password(), request.getRemoteAddr());
        startSession(authentication, request, response);
        return authService.currentUser(((NovaUserDetails) authentication.getPrincipal()).id());
    }

    @GetMapping("/me")
    public CurrentUserResponse me(@AuthenticationPrincipal NovaUserDetails principal) {
        return authService.currentUser(principal.id());
    }

    /**
     * Stores the authenticated context in the session. If a session already existed (e.g. from an
     * earlier anonymous visit), its id is rotated first so a planted session id can't be reused
     * (session fixation).
     */
    private void startSession(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        contextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}
