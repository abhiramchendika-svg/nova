package dev.nova.auth;

import dev.nova.auth.AuthDtos.CurrentUserResponse;
import dev.nova.auth.AuthDtos.RegisterRequest;
import dev.nova.common.web.ApiException;
import dev.nova.security.LoginRateLimiter;
import dev.nova.user.User;
import dev.nova.user.UserRepository;
import dev.nova.user.UserSettings;
import dev.nova.user.UserSettingsRepository;
import java.util.UUID;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Account business rules: sign-up, credential checks, and the current-user view. */
@Service
public class AuthService {

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final LoginRateLimiter rateLimiter;

    public AuthService(
            UserRepository users,
            UserSettingsRepository settings,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            LoginRateLimiter rateLimiter) {
        this.users = users;
        this.settings = settings;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.rateLimiter = rateLimiter;
    }

    /**
     * Creates the account and its default settings in one transaction.
     * The duplicate-email message is deliberately vague ("may already exist"), and the unique index
     * still protects against two sign-ups racing past the existence check.
     */
    @Transactional
    public User register(RegisterRequest request) {
        String email = User.normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw ApiException.conflict("An account with this email may already exist");
        }
        User user = users.save(new User(email, passwordEncoder.encode(request.password()), request.displayName()));
        settings.save(new UserSettings(user));
        return user;
    }

    /**
     * Checks credentials, rate-limited per client IP + email. Throws BadCredentialsException
     * (→ 401) on a wrong email or password, or ApiException (→ 429) when over the limit.
     */
    public Authentication authenticate(String email, String password, String clientIp) {
        String normalized = User.normalizeEmail(email);
        String limiterKey = clientIp + "|" + normalized;
        rateLimiter.checkAndRecord(limiterKey);
        Authentication authentication =
                authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(normalized, password));
        rateLimiter.reset(limiterKey);
        return authentication;
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse currentUser(UUID userId) {
        User user = users.findById(userId).orElseThrow(ApiException::notFound);
        boolean onboarded = settings.findById(userId).map(UserSettings::isOnboardingCompleted).orElse(false);
        return new CurrentUserResponse(user.getId(), user.getEmail(), user.getDisplayName(), onboarded);
    }
}
