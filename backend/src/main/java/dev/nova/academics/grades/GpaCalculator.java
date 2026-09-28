package dev.nova.academics.grades;

import dev.nova.academics.course.GradeKind;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Pure GPA/CGPA arithmetic (docs/database.md §6). No Spring, no database: just inputs in, numbers out,
 * which is why it can be tested exhaustively.
 *
 * <pre>
 * GPA = Σ(credits × points) / Σ credits, over courses whose grade counts towards GPA and credits &gt; 0
 * </pre>
 *
 * <ul>
 *   <li>Official figures use FINAL grades only; projected figures also use EXPECTED grades and any
 *       what-if grade (which never touches the official figures).
 *   <li>CGPA is the credit-weighted mean over all courses, <b>not</b> the mean of semester GPAs.
 *   <li>Everything is exact {@link BigDecimal} arithmetic. Credits have 1 decimal and points 2, so
 *       the weighted sum is exact; the one division rounds once, to 2 decimals, half-up.
 *   <li>If semesters that count use different scales (e.g. 10-point and 4.0), there is no meaningful
 *       CGPA, so it is {@code null} with reason {@link Unavailable#MIXED_SCALES}.
 * </ul>
 */
public final class GpaCalculator {

    static final int DISPLAY_SCALE = 2;

    private GpaCalculator() {}

    // ───────────── Inputs ─────────────

    /** A course's grade as the calculator sees it. */
    public record GradeInput(BigDecimal points, boolean passing, boolean countsInGpa, GradeKind kind) {
        public GradeInput {
            Objects.requireNonNull(points, "points");
            Objects.requireNonNull(kind, "kind");
        }
    }

    /**
     * {@code grade} is the stored grade (null if ungraded). {@code whatIf}, when set, replaces it for the
     * <em>projected</em> figures only: official figures always use the stored grade.
     */
    public record CourseInput(UUID id, String name, BigDecimal credits, GradeInput grade, GradeInput whatIf) {
        public CourseInput {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(credits, "credits");
        }

        public CourseInput(UUID id, String name, BigDecimal credits, GradeInput grade) {
            this(id, name, credits, grade, null);
        }
    }

    /** {@code scale} is the semester's grading scheme maximum (10.00, 4.00 ...). */
    public record SemesterInput(UUID id, BigDecimal scale, List<CourseInput> courses) {
        public SemesterInput {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(scale, "scale");
            courses = List.copyOf(courses);
        }
    }

    // ───────────── Outputs ─────────────

    public enum ExclusionReason {
        /** The grade doesn't count towards GPA (Pass/Fail, Withdrawn, Audit ...). */
        GRADE_NOT_IN_GPA,
        /** Graded, but a 0-credit course has no weight. */
        ZERO_CREDITS
    }

    public enum Unavailable {
        MIXED_SCALES
    }

    public record Excluded(UUID semesterId, UUID courseId, String courseName, ExclusionReason reason) {}

    /**
     * Per semester. {@code gpa}/{@code projectedGpa} are null when nothing counts yet.
     * {@code credits} = all courses; {@code completedCredits} = courses with a FINAL, passing grade.
     */
    public record SemesterResult(
            UUID semesterId,
            BigDecimal gpa,
            BigDecimal projectedGpa,
            BigDecimal credits,
            BigDecimal completedCredits,
            boolean hasExpectedGrades) {}

    /**
     * {@code scale} is the common scale of the semesters that count (null if none count, or mixed).
     * {@code cgpaUnavailableReason} is set only when CGPA can't be computed for a reason other than
     * "no grades yet".
     */
    public record Result(
            BigDecimal cgpa,
            BigDecimal projectedCgpa,
            BigDecimal scale,
            Unavailable cgpaUnavailableReason,
            BigDecimal totalCredits,
            BigDecimal completedCredits,
            List<SemesterResult> semesters,
            List<Excluded> excluded) {}

    // ───────────── Calculation ─────────────

    public static Result calculate(List<SemesterInput> semesters) {
        List<SemesterResult> semesterResults = new ArrayList<>();
        List<Excluded> excluded = new ArrayList<>();
        Sums official = new Sums();
        Sums projected = new Sums();
        BigDecimal totalCredits = BigDecimal.ZERO;
        BigDecimal completedCredits = BigDecimal.ZERO;
        // BigDecimal.equals is scale-sensitive (10.0 ≠ 10.00); compareTo-based set avoids that trap
        TreeSet<BigDecimal> countingScales = new TreeSet<>();

        for (SemesterInput semester : semesters) {
            Sums semOfficial = new Sums();
            Sums semProjected = new Sums();
            BigDecimal semCredits = BigDecimal.ZERO;
            BigDecimal semCompleted = BigDecimal.ZERO;
            boolean hasExpected = false;

            for (CourseInput course : semester.courses()) {
                semCredits = semCredits.add(course.credits());
                GradeInput stored = course.grade();
                GradeInput projectedGrade = course.whatIf() != null ? course.whatIf() : stored;

                // Official: FINAL stored grades only
                ExclusionReason officialExclusion = null;
                if (stored != null && stored.kind() == GradeKind.FINAL) {
                    if (stored.passing()) {
                        semCompleted = semCompleted.add(course.credits());
                    }
                    officialExclusion = exclusion(course, stored);
                    if (officialExclusion == null) {
                        semOfficial.add(course.credits(), course.credits().multiply(stored.points()));
                    }
                }

                // Projected: the what-if grade if there is one, else the stored grade (FINAL or EXPECTED)
                ExclusionReason projectedExclusion = null;
                if (projectedGrade != null) {
                    if (course.whatIf() != null || projectedGrade.kind() == GradeKind.EXPECTED) {
                        hasExpected = true;
                    }
                    projectedExclusion = exclusion(course, projectedGrade);
                    if (projectedExclusion == null) {
                        semProjected.add(course.credits(), course.credits().multiply(projectedGrade.points()));
                    }
                }

                ExclusionReason reason = projectedExclusion != null ? projectedExclusion : officialExclusion;
                if (reason != null) {
                    excluded.add(new Excluded(semester.id(), course.id(), course.name(), reason));
                }
            }

            if (semProjected.hasCredits()) {
                countingScales.add(semester.scale());
            }
            official.add(semOfficial);
            projected.add(semProjected);
            totalCredits = totalCredits.add(semCredits);
            completedCredits = completedCredits.add(semCompleted);
            semesterResults.add(new SemesterResult(
                    semester.id(),
                    semOfficial.average(),
                    semProjected.average(),
                    credits(semCredits),
                    credits(semCompleted),
                    hasExpected));
        }

        boolean mixed = countingScales.size() > 1;
        return new Result(
                mixed ? null : official.average(),
                mixed ? null : projected.average(),
                countingScales.size() == 1 ? countingScales.first() : null,
                mixed ? Unavailable.MIXED_SCALES : null,
                credits(totalCredits),
                credits(completedCredits),
                List.copyOf(semesterResults),
                List.copyOf(excluded));
    }

    /** Why a graded course carries no weight in GPA, or null if it counts. */
    private static ExclusionReason exclusion(CourseInput course, GradeInput grade) {
        if (!grade.countsInGpa()) {
            return ExclusionReason.GRADE_NOT_IN_GPA;
        }
        return course.credits().signum() == 0 ? ExclusionReason.ZERO_CREDITS : null;
    }

    /** Credits are stored with one decimal; keep that shape in the output (3 → 3.0). */
    private static BigDecimal credits(BigDecimal value) {
        return value.setScale(Math.max(1, value.stripTrailingZeros().scale()), RoundingMode.UNNECESSARY);
    }

    /** Running Σ credits and Σ credits × points. */
    private static final class Sums {
        private BigDecimal credits = BigDecimal.ZERO;
        private BigDecimal weighted = BigDecimal.ZERO;

        void add(BigDecimal c, BigDecimal w) {
            credits = credits.add(c);
            weighted = weighted.add(w);
        }

        void add(Sums other) {
            add(other.credits, other.weighted);
        }

        boolean hasCredits() {
            return credits.signum() > 0;
        }

        /** Null when there's nothing to divide by: "no GPA yet", never 0.00. */
        BigDecimal average() {
            return hasCredits() ? weighted.divide(credits, DISPLAY_SCALE, RoundingMode.HALF_UP) : null;
        }
    }
}
