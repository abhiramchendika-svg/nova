package dev.nova.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/**
 * Request and response bodies for /api/v1/auth (docs/api.md §2.1).
 * DTOs are separate from the User entity so the API exposes exactly these fields and nothing else:
 * no password hash can leak out, and no client can set fields it shouldn't (mass assignment).
 */
public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Enter your email.")
                    @Email(message = "Enter a valid email address.")
                    @Size(max = 254, message = "Use at most 254 characters.")
                    String email,
            @NotBlank(message = "Choose a password.")
                    @Size(min = 10, max = 128, message = "Use between 10 and 128 characters.")
                    String password,
            @NotBlank(message = "Tell us what to call you.")
                    @Size(max = 80, message = "Keep it under 80 characters.")
                    String displayName) {

        /** Never print the password, e.g. if a request object ends up in a log line. */
        @Override
        public String toString() {
            return "RegisterRequest[email=" + email + ", displayName=" + displayName + "]";
        }
    }

    public record LoginRequest(
            @NotBlank(message = "Enter your email.") String email,
            @NotBlank(message = "Enter your password.") String password) {

        @Override
        public String toString() {
            return "LoginRequest[email=" + email + "]";
        }
    }

    /** {@code demoExpiresAt} is set only for a "Try the demo" account: when it will be deleted. */
    public record CurrentUserResponse(
            UUID id, String email, String displayName, boolean onboardingCompleted, Instant demoExpiresAt) {}
}
