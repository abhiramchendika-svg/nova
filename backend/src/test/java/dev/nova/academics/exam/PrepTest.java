package dev.nova.academics.exam;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.academics.exam.ExamDtos.Prep;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Prep % is a whole number, rounded half-up from the exact fraction. */
class PrepTest {

    @ParameterizedTest(name = "{0} of {1} → {2}%")
    @CsvSource({
        "0, 4, 0",
        "1, 3, 33", // 33.33
        "2, 3, 67", // 66.67
        "1, 8, 13", // 12.5 rounds up
        "3, 8, 38", // 37.5 rounds up
        "1, 200, 1", // 0.5 rounds up
        "4, 4, 100",
    })
    void roundsHalfUp(int done, int total, int expected) {
        Prep prep = Prep.of(done, total);
        assertThat(prep.percentage()).isEqualTo(expected);
        assertThat(prep.done()).isEqualTo(done);
        assertThat(prep.total()).isEqualTo(total);
    }

    @Test
    void anEmptyChecklistHasNoPercentage() {
        assertThat(Prep.of(0, 0).percentage()).isNull();
    }
}
