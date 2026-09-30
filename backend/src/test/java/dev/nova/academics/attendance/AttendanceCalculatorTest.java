package dev.nova.academics.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.nova.academics.attendance.AttendanceCalculator.Result;
import dev.nova.academics.attendance.AttendanceCalculator.Status;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Every expected value is worked out by hand in the comment or the table row. */
class AttendanceCalculatorTest {

    private static Result calc(int conducted, int attended, String target) {
        return AttendanceCalculator.calculate(conducted, attended, target == null ? null : new BigDecimal(target));
    }

    @Test
    void docsExampleCanMiss() {
        // A=28, C=34, T=75: 28/0.75 = 37.33 → k = ⌊37.33 − 34⌋ = 3. Check: 28/37 = 75.7% ✓, 28/38 = 73.7% ✗
        Result r = calc(34, 28, "75");

        assertThat(r.percentage()).isEqualTo(new BigDecimal("82.35"));
        assertThat(r.canMiss()).isEqualTo(3);
        assertThat(r.needToAttend()).isZero();
        assertThat(r.status()).isEqualTo(Status.SAFE);
    }

    @Test
    void docsExampleNeedToAttend() {
        // A=20, C=30, T=75: (22.5 − 20) / 0.25 = 10. Check: 30/40 = 75% ✓, 29/39 = 74.4% ✗
        Result r = calc(30, 20, "75");

        assertThat(r.percentage()).isEqualTo(new BigDecimal("66.67"));
        assertThat(r.canMiss()).isZero();
        assertThat(r.needToAttend()).isEqualTo(10);
        assertThat(r.status()).isEqualTo(Status.BELOW);
    }

    @ParameterizedTest(name = "C={0} A={1} T={2} → canMiss {3}, need {4}, {5}")
    @CsvSource({
        // exactly on target: nothing to spare, nothing needed
        "4, 3, 75, 0, 0, AT_RISK",
        // one class of room: 8/10 at 75% → ⌊(800 − 750) / 75⌋ = 0 … 8/11 = 72.7% ✗, so 0
        "10, 8, 75, 0, 0, AT_RISK",
        // 9/10 at 75%: ⌊(900 − 750) / 75⌋ = 2 (9/12 = 75% ✓, 9/13 ✗)
        "10, 9, 75, 2, 0, SAFE",
        // exactly one class of room: 16/20 at 75%: ⌊(1600 − 1500) / 75⌋ = 1 (16/21 = 76.2% ✓, 16/22 = 72.7% ✗)
        "20, 16, 75, 1, 0, AT_RISK",
        // everything attended: 10/10 at 75% → ⌊(1000 − 750) / 75⌋ = 3 (10/13 = 76.9% ✓, 10/14 ✗)
        "10, 10, 75, 3, 0, SAFE",
        // nothing attended: 0/10 at 75% → ⌈750 / 25⌉ = 30 (30/40 = 75% ✓)
        "10, 0, 75, 0, 30, BELOW",
        // just below: 74/100 at 75% → ⌈(7500 − 7400) / 25⌉ = 4 (78/104 = 75% ✓, 77/103 = 74.8% ✗)
        "100, 74, 75, 0, 4, BELOW",
        // a decimal target, exactly met: 151/200 = 75.5%
        "200, 151, 75.5, 0, 0, AT_RISK",
        // a decimal target, just missed: 150/200 at 75.5% → ⌈(15100 − 15000) / 24.5⌉ = ⌈4.08⌉ = 5
        "200, 150, 75.5, 0, 5, BELOW",
        // a high target: 99/100 at 99% → exactly met
        "100, 99, 99, 0, 0, AT_RISK",
        // a high target, 1 short: 98/100 at 99% → ⌈(9900 − 9800) / 1⌉ = 100 (198/200 = 99% ✓)
        "100, 98, 99, 0, 100, BELOW",
        // a low target: 1/10 at 10% → exactly met; 2/10 → ⌊(200 − 100) / 10⌋ = 10 (2/20 = 10% ✓)
        "10, 1, 10, 0, 0, AT_RISK",
        "10, 2, 10, 10, 0, SAFE",
        // large values stay exact: 9001/12000 at 75% → ⌊(900100 − 900000) / 75⌋ = 1
        "12000, 9001, 75, 1, 0, AT_RISK",
    })
    void projectsExactly(int conducted, int attended, String target, int canMiss, int need, Status status) {
        Result r = calc(conducted, attended, target);

        assertThat(r.canMiss()).as("canMiss").isEqualTo(canMiss);
        assertThat(r.needToAttend()).as("needToAttend").isEqualTo(need);
        assertThat(r.status()).isEqualTo(status);
    }

    @Test
    void canMissIsTheLargestSafeNumberOfAbsences() {
        // Brute-force cross-check of the closed form over a grid of inputs
        for (int c = 1; c <= 60; c++) {
            for (int a = 0; a <= c; a++) {
                for (String t : new String[] {"60", "65", "70", "75", "80", "85", "75.5", "66.67"}) {
                    BigDecimal target = new BigDecimal(t);
                    Result r = AttendanceCalculator.calculate(c, a, target);
                    assertThat(r.canMiss()).as("canMiss C=%d A=%d T=%s", c, a, t).isEqualTo(bruteCanMiss(c, a, target));
                    assertThat(r.needToAttend()).as("need C=%d A=%d T=%s", c, a, t).isEqualTo(bruteNeed(c, a, target));
                }
            }
        }
    }

    private static boolean meets(int attended, int conducted, BigDecimal target) {
        // attended / conducted ≥ target / 100, compared exactly
        return BigDecimal.valueOf(attended).multiply(BigDecimal.valueOf(100))
                        .compareTo(target.multiply(BigDecimal.valueOf(conducted)))
                >= 0;
    }

    private static int bruteCanMiss(int c, int a, BigDecimal target) {
        int k = 0;
        while (meets(a, c + k + 1, target)) {
            k++;
        }
        return meets(a, c, target) ? k : 0;
    }

    private static int bruteNeed(int c, int a, BigDecimal target) {
        int n = 0;
        while (!meets(a + n, c + n, target)) {
            n++;
        }
        return n;
    }

    @Test
    void noTargetMeansNoProjectionRatherThanAnAssumedPolicy() {
        Result r = calc(34, 28, null);

        assertThat(r.percentage()).isEqualTo(new BigDecimal("82.35"));
        assertThat(r.canMiss()).isNull();
        assertThat(r.needToAttend()).isNull();
        assertThat(r.status()).isEqualTo(Status.NO_TARGET);
    }

    @Test
    void noClassesYetHasNoPercentage() {
        Result r = calc(0, 0, "75");

        assertThat(r.percentage()).isNull();
        assertThat(r.canMiss()).isZero(); // 0/1 would already be below target
        assertThat(r.needToAttend()).isZero();
        assertThat(r.status()).isEqualTo(Status.NO_CLASSES);
    }

    @Test
    void rejectsImpossibleInputs() {
        assertThatThrownBy(() -> calc(5, 6, "75")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> calc(-1, 0, "75")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> calc(5, 3, "100")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> calc(5, 3, "0")).isInstanceOf(IllegalArgumentException.class);
    }
}
