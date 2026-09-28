package dev.nova.security;

import dev.nova.user.User;
import java.io.Serial;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * The logged-in principal. It is serialised into the session (stored in PostgreSQL), so it holds
 * only what every request needs: the user's id and email. {@link #eraseCredentials()} drops the
 * password hash right after authentication, so the hash never ends up in the session table.
 */
public final class NovaUserDetails implements UserDetails, CredentialsContainer {

    @Serial
    private static final long serialVersionUID = 1L;

    private static final List<GrantedAuthority> AUTHORITIES = List.of(new SimpleGrantedAuthority("ROLE_USER"));

    private final UUID id;
    private final String email;
    private String passwordHash;

    public NovaUserDetails(UUID id, String email, String passwordHash) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public static NovaUserDetails from(User user) {
        return new NovaUserDetails(user.getId(), user.getEmail(), user.getPasswordHash());
    }

    /** Principal for a session created right after sign-up (no password check needed). */
    public static NovaUserDetails withoutCredentials(User user) {
        return new NovaUserDetails(user.getId(), user.getEmail(), null);
    }

    public UUID id() {
        return id;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return AUTHORITIES;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public void eraseCredentials() {
        passwordHash = null;
    }
}
