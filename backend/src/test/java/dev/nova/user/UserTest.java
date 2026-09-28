package dev.nova.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

class UserTest {

    @ParameterizedTest(name = "\"{0}\" → \"{1}\"")
    @CsvSource({
        "abhi@example.com, abhi@example.com",
        "Abhi@Example.COM, abhi@example.com",
        "'  spaced@example.com  ', spaced@example.com",
        // Locale.ROOT: in a Turkish locale "I".toLowerCase() would become a dotless ı
        "INFO@EXAMPLE.COM, info@example.com",
    })
    void normalisesEmail(String input, String expected) {
        assertThat(User.normalizeEmail(input)).isEqualTo(expected);
    }

    @Test
    void trimsDisplayName() {
        assertThat(new User("a@b.co", "{bcrypt}h", "  Abhi  ").getDisplayName()).isEqualTo("Abhi");
    }

    @Test
    void onboardingCompletionIsRecordedOnce() {
        UserSettings settings = new UserSettings(new User("a@b.co", "{bcrypt}h", "A"));
        Instant first = Instant.parse("2026-09-28T04:00:00Z");
        settings.completeOnboarding(first);
        settings.completeOnboarding(first.plusSeconds(60));
        assertThat(settings.getOnboardingCompletedAt()).isEqualTo(first);
    }
}
