package dev.nova.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.nova.TestcontainersConfiguration;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Repository tests against real PostgreSQL (Testcontainers), with the real Flyway migrations.
 * Each test runs in a transaction that is rolled back afterwards, so tests don't affect each other.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfiguration.class)
class UserRepositoryTest {

    @Autowired
    private UserRepository users;

    @Autowired
    private UserSettingsRepository settings;

    @Test
    void savesAndFindsUserByNormalisedEmail() {
        User saved = users.saveAndFlush(new User("  Abhi@Example.COM ", "{bcrypt}hash", " Abhi "));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(users.findByEmail("abhi@example.com")).get().extracting(User::getDisplayName).isEqualTo("Abhi");
        assertThat(users.existsByEmail(User.normalizeEmail("ABHI@example.com"))).isTrue();
    }

    @Test
    void emailIsUniqueRegardlessOfCase() {
        users.saveAndFlush(new User("riya@example.com", "{bcrypt}a", "Riya"));

        assertThatThrownBy(() -> users.saveAndFlush(new User("RIYA@example.com", "{bcrypt}b", "Riya 2")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void settingsShareTheUsersIdAndStartWithNeutralDefaults() {
        User user = users.saveAndFlush(new User("sam@example.com", "{bcrypt}h", "Sam"));
        UserSettings saved = settings.saveAndFlush(new UserSettings(user));

        assertThat(saved.getUserId()).isEqualTo(user.getId());
        assertThat(saved.getTimezone()).isEqualTo("UTC");
        assertThat(saved.getWeekStart()).isEqualTo(UserSettings.WeekStart.MON);
        assertThat(saved.getTheme()).isEqualTo(UserSettings.ThemePreference.SYSTEM);
        assertThat(saved.getDefaultAttendanceTarget()).isNull(); // no assumed attendance policy
        assertThat(saved.isOnboardingCompleted()).isFalse();
    }

    @Test
    void databaseRejectsAnAttendanceTargetOutsideZeroToHundred() {
        User user = users.saveAndFlush(new User("lee@example.com", "{bcrypt}h", "Lee"));
        UserSettings s = new UserSettings(user);
        s.setDefaultAttendanceTarget(new BigDecimal("100.00"));

        assertThatThrownBy(() -> settings.saveAndFlush(s)).isInstanceOf(DataIntegrityViolationException.class);
    }
}
