package dev.nova.academics.grading;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GradingSchemeServiceTest {

    @Test
    void copyNameAddsASuffix() {
        assertThat(GradingSchemeService.copyName("10-point scale")).isEqualTo("10-point scale (copy)");
    }

    @Test
    void copyNameStaysWithinTheColumnLimit() {
        String longName = "x".repeat(60);

        String copy = GradingSchemeService.copyName(longName);

        assertThat(copy).hasSize(60).endsWith(" (copy)");
    }
}
