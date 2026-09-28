package dev.nova.academics.semester;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.nova.TestcontainersConfiguration;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.grading.GradeDefinition;
import dev.nova.academics.grading.GradingScheme;
import dev.nova.academics.grading.GradingSchemeRepository;
import dev.nova.user.User;
import dev.nova.user.UserRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * The database's own guarantees (docs/database.md §1), tested directly against PostgreSQL. These hold
 * even if a service forgets a check, which is the point of defence in depth.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfiguration.class)
class AcademicsSchemaTest {

    private static final UUID TEN_POINT = UUID.fromString("00000000-0000-4000-8000-000000000001");

    @Autowired
    private UserRepository users;

    @Autowired
    private SemesterRepository semesters;

    @Autowired
    private CourseRepository courses;

    @Autowired
    private GradingSchemeRepository schemes;

    private User user(String name) {
        return users.saveAndFlush(new User(name + "-" + UUID.randomUUID() + "@example.com", "{bcrypt}h", name));
    }

    private Semester semester(User owner, int ordinal, boolean current) {
        Semester s = new Semester(owner.getId());
        s.apply("Semester " + ordinal, ordinal, null, null, TEN_POINT, null);
        s.setCurrent(current);
        return s;
    }

    @Test
    void presetsAreSeededWithTheirGrades() {
        GradingScheme tenPoint = schemes.findVisible(TEN_POINT, UUID.randomUUID()).orElseThrow();

        assertThat(tenPoint.isBuiltIn()).isTrue();
        assertThat(tenPoint.getMaxPoints()).isEqualByComparingTo("10");
        assertThat(tenPoint.getGrades()).extracting(GradeDefinition::getLabel)
                .containsExactly("O", "A+", "A", "B+", "B", "C", "P", "F");
    }

    @Test
    void aCourseCannotPointAtAnotherUsersSemester() {
        User owner = user("owner");
        User intruder = user("intruder");
        Semester ownersSemester = semesters.saveAndFlush(semester(owner, 1, false));

        Course course = new Course(intruder.getId());
        course.apply(ownersSemester.getId(), null, "Sneaky", new BigDecimal("3.0"), null, null, null, null);

        assertThatThrownBy(() -> courses.saveAndFlush(course)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aUserCanHaveOnlyOneCurrentSemester() {
        User owner = user("current");
        semesters.saveAndFlush(semester(owner, 1, true));

        assertThatThrownBy(() -> semesters.saveAndFlush(semester(owner, 2, true)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void differentUsersEachHaveTheirOwnCurrentSemester() {
        semesters.saveAndFlush(semester(user("a"), 1, true));
        semesters.saveAndFlush(semester(user("b"), 1, true)); // no conflict across users

        assertThat(semesters.count()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void semesterNumbersAreUniquePerUser() {
        User owner = user("ordinal");
        semesters.saveAndFlush(semester(owner, 1, false));

        assertThatThrownBy(() -> semesters.saveAndFlush(semester(owner, 1, false)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void newCoursesStartUngradedWithAnEmptyAttendanceBaseline() {
        User owner = user("grade-pair");
        Semester s = semesters.saveAndFlush(semester(owner, 1, false));
        Course course = new Course(owner.getId());
        course.apply(s.getId(), null, "DBMS", new BigDecimal("4.0"), null, null, null, null);
        Course saved = courses.saveAndFlush(course);

        assertThat(saved.isGraded()).isFalse();
        assertThat(saved.getBaselineConducted()).isZero();
        assertThat(saved.getBaselineAttended()).isZero();
    }
}
