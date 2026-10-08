package dev.nova.demo;

import dev.nova.auth.AuthDtos.CurrentUserResponse;
import dev.nova.auth.AuthService;
import dev.nova.auth.SessionStarter;
import dev.nova.demo.DemoDtos.StartRequest;
import dev.nova.security.NovaUserDetails;
import dev.nova.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** /api/v1/demo — starts a temporary demo account and logs the browser in to it. */
@RestController
@RequestMapping("/api/v1/demo")
public class DemoController {

    private final DemoService demos;
    private final AuthService auth;
    private final SessionStarter sessions;

    public DemoController(DemoService demos, AuthService auth, SessionStarter sessions) {
        this.demos = demos;
        this.auth = auth;
        this.sessions = sessions;
    }

    @PostMapping
    public ResponseEntity<CurrentUserResponse> start(
            @Valid @RequestBody(required = false) StartRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        User user = demos.start(body == null ? null : body.timezone(), request.getRemoteAddr());
        NovaUserDetails principal = NovaUserDetails.withoutCredentials(user);
        sessions.start(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()),
                request,
                response);
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.currentUser(user.getId()));
    }
}
