package dev.nova.security;

import dev.nova.user.User;
import dev.nova.user.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loads an account by email for Spring Security's password check. */
@Service
public class NovaUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public NovaUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        return users.findByEmail(User.normalizeEmail(email))
                .map(NovaUserDetails::from)
                // Spring turns this into the same BadCredentialsException as a wrong password
                .orElseThrow(() -> new UsernameNotFoundException("No account for that email"));
    }
}
