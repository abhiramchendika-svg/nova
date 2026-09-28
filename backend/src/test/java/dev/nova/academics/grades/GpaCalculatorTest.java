package dev.nova.academics.grades;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.academics.course.GradeKind;
import dev.nova.academics.grades.GpaCalculator.CourseInput;
import dev.nova.academics.grades.GpaCalculator.ExclusionReason;
import dev.nova.academics.grades.GpaCalculator.GradeInput;
import dev.nova.academics.grades.GpaCalculator.Result;
import dev.nova.academics.grades.GpaCalculator.SemesterInput;
import dev.nova.academics.grades.GpaCalculator.SemesterResult;
import dev.nova.academics.grades.GpaCalculator.Unavailable;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Every expected value here is worked out by hand in the comment next to it. */
class GpaCalculatorTest {

    private static final BigDecimal TEN = new BigDecimal("10.00");
    private static final BigDecimal FOUR = new BigDecimal("4.00");

    // ───────────── helpers ─────────────

    private static GradeInput counted(String points, GradeKind kind) {
        BigDecimal p = new BigDecimal(points);
        return new GradeInput(p, p.signum() > 0, true, kind);
    }

    private static GradeInput finalGrade(String points) {
        return counted(points, GradeKind.FINAL);
    }

    private static GradeInput expected(String points) {
        return counted(points, GradeKind.EXPECTED);
    }

    private static CourseInput course(String name, String credits, GradeInput grade) {
        return new CourseInput(UUID.randomUUID(), name, new BigDecimal(credits), grade);
    }

    private static SemesterInput semester(BigDecimal scale, CourseInput... courses) {
        return new SemesterInput(UUID.randomUUID(), scale, List.of(courses));
    }

    private static BigDecimal d(String value) {
        return new BigDecimal(value);
    }

    // ───────────── tests ─────────────

    @Test
    void noSemestersMeansNoGpaRatherThanZero() {
        Result r = GpaCalculator.calculate(List.of());

        assertThat(r.cgpa()).isNull();
        assertThat(r.projectedCgpa()).isNull();
        assertThat(r.scale()).isNull();
        assertThat(r.cgpaUnavailableReason()).isNull();
        assertThat(r.totalCredits()).isEqualByComparingTo("0");
        assertThat(r.completedCredits()).isEqualByComparingTo("0");
        assertThat(r.semesters()).isEmpty();
        assertThat(r.excluded()).isEmpty();
    }

    @Test
    void ungradedCoursesCountAsCreditsButNotTowardsGpa() {
        Result r = GpaCalculator.calculate(List.of(semester(TEN, course("DBMS", "4.0", null), course("OS", "3.0", null))));

        SemesterResult s = r.semesters().getFirst();
        assertThat(s.gpa()).isNull();
        assertThat(s.projectedGpa()).isNull();
        assertThat(s.credits()).isEqualTo(d("7.0"));
        assertThat(s.completedCredits()).isEqualTo(d("0.0"));
        assertThat(s.hasExpectedGrades()).isFalse();
        assertThat(r.cgpa()).isNull();
        assertThat(r.excluded()).isEmpty(); // "not graded yet" isn't an exclusion
    }

    @Test
    void semesterGpaIsCreditWeighted() {
        // (4×10 + 3×8 + 4×7) / 11 = 92 / 11 = 8.3636… → 8.36
        Result r = GpaCalculator.calculate(List.of(semester(
                TEN,
                course("DBMS", "4.0", finalGrade("10")),
                course("OS", "3.0", finalGrade("8")),
                course("Maths", "4.0", finalGrade("7")))));

        SemesterResult s = r.semesters().getFirst();
        assertThat(s.gpa()).isEqualTo(d("8.36"));
        assertThat(s.projectedGpa()).isEqualTo(d("8.36"));
        assertThat(s.credits()).isEqualTo(d("11.0"));
        assertThat(s.completedCredits()).isEqualTo(d("11.0"));
        assertThat(r.cgpa()).isEqualTo(d("8.36"));
        assertThat(r.scale()).isEqualByComparingTo("10");
    }

    @Test
    void cgpaIsCreditWeightedNotTheMeanOfSemesterGpas() {
        // S1: 1 credit × 10 → GPA 10. S2: 4 credits × 6 → GPA 6.
        // Mean of GPAs would be 8.00 (wrong). CGPA = (10 + 24) / 5 = 6.80.
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("Lab", "1.0", finalGrade("10"))),
                semester(TEN, course("Theory", "4.0", finalGrade("6")))));

        assertThat(r.semesters().get(0).gpa()).isEqualTo(d("10.00"));
        assertThat(r.semesters().get(1).gpa()).isEqualTo(d("6.00"));
        assertThat(r.cgpa()).isEqualTo(d("6.80"));
        assertThat(r.totalCredits()).isEqualTo(d("5.0"));
    }

    @Test
    void expectedGradesOnlyAffectProjectedFigures() {
        // S1 official: 3 × 8 → 8.00. S2 expected: 4 × 10.
        // CGPA = 24 / 3 = 8.00; projected = (24 + 40) / 7 = 9.142857… → 9.14
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("OS", "3.0", finalGrade("8"))),
                semester(TEN, course("Compilers", "4.0", expected("10")))));

        assertThat(r.cgpa()).isEqualTo(d("8.00"));
        assertThat(r.projectedCgpa()).isEqualTo(d("9.14"));
        SemesterResult current = r.semesters().get(1);
        assertThat(current.gpa()).isNull();
        assertThat(current.projectedGpa()).isEqualTo(d("10.00"));
        assertThat(current.hasExpectedGrades()).isTrue();
        // Expected grades aren't completed credits
        assertThat(r.completedCredits()).isEqualTo(d("3.0"));
        assertThat(r.totalCredits()).isEqualTo(d("7.0"));
    }

    @Test
    void failingGradeCountsAsZeroAndIsNotCompleted() {
        // (3×8 + 3×0) / 6 = 4.00; only the passed course's 3 credits are completed
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("OS", "3.0", finalGrade("8")), course("Physics", "3.0", finalGrade("0")))));

        assertThat(r.cgpa()).isEqualTo(d("4.00"));
        assertThat(r.completedCredits()).isEqualTo(d("3.0"));
        assertThat(r.totalCredits()).isEqualTo(d("6.0"));
    }

    @Test
    void gradesThatDontCountInGpaAreExcludedWithAReason() {
        // Pass (not in GPA) is completed but excluded: GPA = 4×8 / 4 = 8.00
        CourseInput softSkills =
                course("Soft Skills", "2.0", new GradeInput(d("0"), true, false, GradeKind.FINAL));
        SemesterInput s = semester(TEN, course("DBMS", "4.0", finalGrade("8")), softSkills);

        Result r = GpaCalculator.calculate(List.of(s));

        assertThat(r.cgpa()).isEqualTo(d("8.00"));
        assertThat(r.completedCredits()).isEqualTo(d("6.0"));
        assertThat(r.excluded()).singleElement().satisfies(e -> {
            assertThat(e.courseId()).isEqualTo(softSkills.id());
            assertThat(e.courseName()).isEqualTo("Soft Skills");
            assertThat(e.semesterId()).isEqualTo(s.id());
            assertThat(e.reason()).isEqualTo(ExclusionReason.GRADE_NOT_IN_GPA);
        });
    }

    @Test
    void zeroCreditGradedCourseIsExcludedAndDoesNotChangeGpa() {
        Result r = GpaCalculator.calculate(List.of(semester(
                TEN, course("DBMS", "4.0", finalGrade("9")), course("Seminar", "0.0", finalGrade("10")))));

        assertThat(r.cgpa()).isEqualTo(d("9.00"));
        assertThat(r.excluded()).singleElement().extracting(GpaCalculator.Excluded::reason)
                .isEqualTo(ExclusionReason.ZERO_CREDITS);
    }

    @Test
    void semesterWithOnlyNonCountingGradesHasNoGpa() {
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("Yoga", "1.0", new GradeInput(d("0"), true, false, GradeKind.FINAL)))));

        assertThat(r.semesters().getFirst().gpa()).isNull();
        assertThat(r.cgpa()).isNull();
        assertThat(r.scale()).isNull();
        assertThat(r.completedCredits()).isEqualTo(d("1.0"));
    }

    @Test
    void roundsHalfUpOnlyOnce() {
        // (1×8.00 + 1×8.25) / 2 = 8.125 exactly → half-up 8.13 (half-even would give 8.12)
        Result r = GpaCalculator.calculate(
                List.of(semester(TEN, course("A", "1.0", finalGrade("8.00")), course("B", "1.0", finalGrade("8.25")))));

        assertThat(r.cgpa()).isEqualTo(d("8.13"));
    }

    @Test
    void roundsRepeatingDecimals() {
        // (10 + 10 + 9) / 3 = 9.666… → 9.67
        Result r = GpaCalculator.calculate(List.of(semester(
                TEN,
                course("A", "1.0", finalGrade("10")),
                course("B", "1.0", finalGrade("10")),
                course("C", "1.0", finalGrade("9")))));

        assertThat(r.cgpa()).isEqualTo(d("9.67"));
    }

    @Test
    void handlesFractionalCreditsExactly() {
        // (1.5×9 + 2.5×7) / 4 = (13.5 + 17.5) / 4 = 7.75
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("Lab", "1.5", finalGrade("9")), course("Theory", "2.5", finalGrade("7")))));

        assertThat(r.cgpa()).isEqualTo(d("7.75"));
        assertThat(r.totalCredits()).isEqualTo(d("4.0"));
    }

    @Test
    void refusesToAverageDifferentScales() {
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("DBMS", "4.0", finalGrade("9"))),
                semester(FOUR, course("Exchange", "3.0", finalGrade("3.7")))));

        assertThat(r.cgpa()).isNull();
        assertThat(r.projectedCgpa()).isNull();
        assertThat(r.scale()).isNull();
        assertThat(r.cgpaUnavailableReason()).isEqualTo(Unavailable.MIXED_SCALES);
        // Each semester's own GPA is still meaningful on its own scale
        assertThat(r.semesters().get(0).gpa()).isEqualTo(d("9.00"));
        assertThat(r.semesters().get(1).gpa()).isEqualTo(d("3.70"));
    }

    @Test
    void aSemesterOnAnotherScaleWithNothingCountedDoesNotBlockCgpa() {
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("DBMS", "4.0", finalGrade("9"))),
                semester(FOUR, course("Not graded yet", "3.0", null))));

        assertThat(r.cgpa()).isEqualTo(d("9.00"));
        assertThat(r.scale()).isEqualByComparingTo("10");
        assertThat(r.cgpaUnavailableReason()).isNull();
    }

    @Test
    void scalesAreComparedByValueNotByBigDecimalScale() {
        // 10.0 and 10.00 are the same scale: BigDecimal.equals would say otherwise
        Result r = GpaCalculator.calculate(List.of(
                semester(new BigDecimal("10.0"), course("A", "1.0", finalGrade("8"))),
                semester(new BigDecimal("10.00"), course("B", "1.0", finalGrade("9")))));

        assertThat(r.cgpaUnavailableReason()).isNull();
        assertThat(r.cgpa()).isEqualTo(d("8.50"));
    }

    @Test
    void expectedGradeOnADifferentScaleMakesBothFiguresUnavailable() {
        // Conservative on purpose: one figure computed and one missing would be more confusing
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("DBMS", "4.0", finalGrade("9"))),
                semester(FOUR, course("Exchange", "3.0", expected("3.0")))));

        assertThat(r.cgpa()).isNull();
        assertThat(r.projectedCgpa()).isNull();
        assertThat(r.cgpaUnavailableReason()).isEqualTo(Unavailable.MIXED_SCALES);
    }

    @Test
    void whatIfGradeChangesOnlyTheProjection() {
        // DBMS is officially B (6); what if it had been O (10)? Official stays 6.00, projected becomes 10.00.
        CourseInput dbms = new CourseInput(UUID.randomUUID(), "DBMS", d("4.0"), finalGrade("6"), expected("10"));

        Result r = GpaCalculator.calculate(List.of(semester(TEN, dbms)));

        assertThat(r.cgpa()).isEqualTo(d("6.00"));
        assertThat(r.projectedCgpa()).isEqualTo(d("10.00"));
        assertThat(r.completedCredits()).isEqualTo(d("4.0")); // the real pass still counts
        assertThat(r.semesters().getFirst().hasExpectedGrades()).isTrue();
    }

    @Test
    void whatIfGradeOnAnUngradedCourse() {
        // OS isn't graded yet; what if it's A (8)? (4×10 + 4×8) / 8 = 9.00 projected, official 10.00
        Result r = GpaCalculator.calculate(List.of(semester(
                TEN,
                course("DBMS", "4.0", finalGrade("10")),
                new CourseInput(UUID.randomUUID(), "OS", d("4.0"), null, expected("8")))));

        assertThat(r.cgpa()).isEqualTo(d("10.00"));
        assertThat(r.projectedCgpa()).isEqualTo(d("9.00"));
        assertThat(r.completedCredits()).isEqualTo(d("4.0"));
    }

    @Test
    void aCourseExcludedForTwoReasonsIsListedOnce() {
        Result r = GpaCalculator.calculate(List.of(
                semester(TEN, course("Yoga", "1.0", new GradeInput(d("0"), true, false, GradeKind.FINAL)))));

        assertThat(r.excluded()).hasSize(1);
    }

    @Test
    void semesterResultsKeepInputOrder() {
        SemesterInput first = semester(TEN, course("A", "1.0", finalGrade("8")));
        SemesterInput second = semester(TEN, course("B", "1.0", finalGrade("9")));

        Result r = GpaCalculator.calculate(List.of(first, second));

        assertThat(r.semesters()).extracting(SemesterResult::semesterId).containsExactly(first.id(), second.id());
    }
}
