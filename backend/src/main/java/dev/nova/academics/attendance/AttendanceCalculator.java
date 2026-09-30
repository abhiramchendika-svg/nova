package dev.nova.academics.attendance;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Pure attendance arithmetic (docs/database.md §6). No Spring, no database.
 *
 * <pre>
 * C = classes conducted, A = classes attended, T = target % (0 &lt; T &lt; 100)
 * percentage   = 100·A / C                                   (undefined when C = 0)
 * canMiss      = largest k ≥ 0 with A / (C + k) ≥ T/100  →  ⌊(100·A − T·C) / T⌋, never negative
 * needToAttend = smallest n ≥ 0 with (A + n) / (C + n) ≥ T/100  →  ⌈(T·C − 100·A) / (100 − T)⌉, never negative
 * </pre>
 *
 * Multiplying through by 100 keeps everything in exact {@link BigDecimal} arithmetic (T has at most
 * 2 decimals), so a floor or ceiling is never off by one because of floating-point error.
 */
public final class AttendanceCalculator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private AttendanceCalculator() {}

    public enum Status {
        /** Above target with room to miss more than one class. */
        SAFE,
        /** At or above target, but missing more than one class would drop below it. */
        AT_RISK,
        /** Below target. */
        BELOW,
        /** No target set anywhere: NOVA never assumes a policy. */
        NO_TARGET,
        /** A target is set but no class has been held yet. */
        NO_CLASSES
    }

    /** {@code percentage}, {@code canMiss} and {@code needToAttend} are null when they can't be defined. */
    public record Result(
            int conducted, int attended, BigDecimal percentage, Integer canMiss, Integer needToAttend, Status status) {}

    /**
     * @param conducted classes held (baseline + PRESENT/ABSENT records; cancelled classes excluded)
     * @param attended classes attended (baseline + PRESENT records)
     * @param target target percentage in (0, 100), or null if none is set
     */
    public static Result calculate(int conducted, int attended, BigDecimal target) {
        if (conducted < 0 || attended < 0 || attended > conducted) {
            throw new IllegalArgumentException("Need 0 ≤ attended ≤ conducted, got " + attended + " / " + conducted);
        }
        if (target != null && (target.signum() <= 0 || target.compareTo(HUNDRED) >= 0)) {
            throw new IllegalArgumentException("Target must be between 0 and 100, got " + target);
        }

        BigDecimal c = BigDecimal.valueOf(conducted);
        BigDecimal a = BigDecimal.valueOf(attended);
        BigDecimal percentage = conducted == 0 ? null : a.multiply(HUNDRED).divide(c, 2, RoundingMode.HALF_UP);

        if (target == null) {
            return new Result(conducted, attended, percentage, null, null, Status.NO_TARGET);
        }

        BigDecimal hundredA = a.multiply(HUNDRED);
        BigDecimal targetC = target.multiply(c);

        // ⌊(100A − TC) / T⌋, or 0 when already below target
        BigDecimal missRoom = hundredA.subtract(targetC);
        int canMiss = missRoom.signum() <= 0 ? 0 : missRoom.divide(target, 0, RoundingMode.FLOOR).intValueExact();

        // ⌈(TC − 100A) / (100 − T)⌉, or 0 when already at or above target
        BigDecimal shortfall = targetC.subtract(hundredA);
        int needToAttend = shortfall.signum() <= 0
                ? 0
                : shortfall.divide(HUNDRED.subtract(target), 0, RoundingMode.CEILING).intValueExact();

        Status status;
        if (conducted == 0) {
            status = Status.NO_CLASSES;
        } else if (hundredA.compareTo(targetC) < 0) {
            status = Status.BELOW;
        } else if (canMiss <= 1) {
            status = Status.AT_RISK;
        } else {
            status = Status.SAFE;
        }
        return new Result(conducted, attended, percentage, canMiss, needToAttend, status);
    }
}
