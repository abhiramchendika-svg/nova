package dev.nova.academics.attendance;

import dev.nova.academics.attendance.AttendanceCalculator.Result;
import dev.nova.academics.attendance.AttendanceDtos.BaselineRequest;
import dev.nova.academics.attendance.AttendanceDtos.CourseAttendance;
import dev.nova.academics.attendance.AttendanceDtos.MarkRequest;
import dev.nova.academics.attendance.AttendanceDtos.RecordResponse;
import dev.nova.academics.attendance.AttendanceDtos.StatusRequest;
import dev.nova.academics.attendance.AttendanceDtos.TargetSource;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.semester.Semester;
import dev.nova.academics.semester.SemesterRepository;
import dev.nova.common.web.ApiException;
import dev.nova.common.web.PageResponse;
import dev.nova.user.UserSettings;
import dev.nova.user.UserSettingsRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Attendance per course: baseline counts plus marked classes, projected by {@link AttendanceCalculator}.
 * The target comes from the course, else its semester, else the user's default; if none is set, NOVA
 * shows the percentage but makes no projection (it never assumes a policy).
 */
@Service
public class AttendanceService {

    private static final Sort NEWEST_FIRST =
            Sort.by(Sort.Order.desc("heldOn"), Sort.Order.desc("slot"), Sort.Order.desc("createdAt"));

    private final AttendanceRecordRepository records;
    private final CourseRepository courses;
    private final SemesterRepository semesters;
    private final UserSettingsRepository settings;
    private final Clock clock;

    public AttendanceService(
            AttendanceRecordRepository records,
            CourseRepository courses,
            SemesterRepository semesters,
            UserSettingsRepository settings,
            Clock clock) {
        this.records = records;
        this.courses = courses;
        this.semesters = semesters;
        this.settings = settings;
        this.clock = clock;
    }

    /** Every course in a semester (the current one if none is given; empty if there's none). */
    @Transactional(readOnly = true)
    public List<CourseAttendance> forSemester(UUID userId, UUID semesterId) {
        Semester semester = semesterId == null
                ? semesters.findByUserIdAndCurrentTrue(userId).orElse(null)
                : semesters.findByIdAndUserId(semesterId, userId).orElseThrow(ApiException::notFound);
        if (semester == null) {
            return List.of();
        }
        return stats(userId, semester, courses.findBySemesterIdAndUserIdOrderByNameAsc(semester.getId(), userId));
    }

    @Transactional(readOnly = true)
    public CourseAttendance forCourse(UUID userId, UUID courseId) {
        Course course = requireCourse(userId, courseId);
        return stats(userId, semesterOf(course), List.of(course)).getFirst();
    }

    @Transactional(readOnly = true)
    public PageResponse<RecordResponse> history(UUID userId, UUID courseId, int page, int size) {
        PageResponse.validate(page, size);
        requireCourse(userId, courseId);
        return PageResponse.of(
                records.findByCourseIdAndUserId(courseId, userId, PageRequest.of(page, size, NEWEST_FIRST)),
                RecordResponse::from);
    }

    @Transactional
    public RecordResponse mark(UUID userId, UUID courseId, MarkRequest request) {
        Course course = requireCourse(userId, courseId);
        int slot = request.slot() == null ? 1 : request.slot();
        if (request.heldOn().isAfter(today(userId))) {
            throw ApiException.invalidField("heldOn", "You can’t mark a class that hasn’t happened yet.");
        }
        if (records.existsByCourseIdAndHeldOnAndSlot(course.getId(), request.heldOn(), slot)) {
            throw ApiException.conflict("You’ve already marked this class. Change or delete that mark instead.");
        }
        AttendanceRecord record = new AttendanceRecord(userId, course.getId(), request.heldOn(), slot, request.status());
        return RecordResponse.from(records.saveAndFlush(record));
    }

    @Transactional
    public RecordResponse changeStatus(UUID userId, UUID recordId, StatusRequest request) {
        AttendanceRecord record = records.findByIdAndUserId(recordId, userId).orElseThrow(ApiException::notFound);
        record.changeStatus(request.status());
        records.flush();
        return RecordResponse.from(record);
    }

    @Transactional
    public void delete(UUID userId, UUID recordId) {
        records.delete(records.findByIdAndUserId(recordId, userId).orElseThrow(ApiException::notFound));
    }

    /** Sets the "28 of 34" a student starts from and returns the recalculated attendance. */
    @Transactional
    public CourseAttendance setBaseline(UUID userId, UUID courseId, BaselineRequest request) {
        Course course = requireCourse(userId, courseId);
        if (request.attended() > request.conducted()) {
            throw ApiException.ruleViolation("attended", "You can’t have attended more classes than were held.");
        }
        course.setAttendanceBaseline(request.conducted(), request.attended());
        courses.flush();
        return stats(userId, semesterOf(course), List.of(course)).getFirst();
    }

    // ───────────── helpers ─────────────

    private List<CourseAttendance> stats(UUID userId, Semester semester, List<Course> list) {
        if (list.isEmpty()) {
            return List.of();
        }
        BigDecimal userDefault = settings.findById(userId).map(UserSettings::getDefaultAttendanceTarget).orElse(null);

        Map<UUID, Map<AttendanceStatus, Long>> counts = new HashMap<>();
        for (StatusCount row : records.countByStatus(userId, list.stream().map(Course::getId).toList())) {
            counts.computeIfAbsent(row.courseId(), id -> new EnumMap<>(AttendanceStatus.class))
                    .put(row.status(), row.total());
        }

        return list.stream()
                .map(course -> {
                    Map<AttendanceStatus, Long> byStatus = counts.getOrDefault(course.getId(), Map.of());
                    int present = Math.toIntExact(byStatus.getOrDefault(AttendanceStatus.PRESENT, 0L));
                    int absent = Math.toIntExact(byStatus.getOrDefault(AttendanceStatus.ABSENT, 0L));
                    int cancelled = Math.toIntExact(byStatus.getOrDefault(AttendanceStatus.CANCELLED, 0L));
                    int conducted = course.getBaselineConducted() + present + absent;
                    int attended = course.getBaselineAttended() + present;

                    BigDecimal target;
                    TargetSource source;
                    if (course.getAttendanceTarget() != null) {
                        target = course.getAttendanceTarget();
                        source = TargetSource.COURSE;
                    } else if (semester.getAttendanceTarget() != null) {
                        target = semester.getAttendanceTarget();
                        source = TargetSource.SEMESTER;
                    } else if (userDefault != null) {
                        target = userDefault;
                        source = TargetSource.DEFAULT;
                    } else {
                        target = null;
                        source = null;
                    }

                    Result r = AttendanceCalculator.calculate(conducted, attended, target);
                    return new CourseAttendance(
                            course.getId(),
                            course.getCode(),
                            course.getName(),
                            course.getBaselineConducted(),
                            course.getBaselineAttended(),
                            present,
                            absent,
                            cancelled,
                            r.conducted(),
                            r.attended(),
                            r.percentage(),
                            target,
                            source,
                            r.canMiss(),
                            r.needToAttend(),
                            r.status());
                })
                .toList();
    }

    /** "Today" in the user's own timezone, so a class at 11 pm isn't "in the future" for someone in IST. */
    private LocalDate today(UUID userId) {
        String zone = settings.findById(userId).map(UserSettings::getTimezone).orElse("UTC");
        return LocalDate.now(clock.withZone(ZoneId.of(zone)));
    }

    private Course requireCourse(UUID userId, UUID courseId) {
        return courses.findByIdAndUserId(courseId, userId).orElseThrow(ApiException::notFound);
    }

    private Semester semesterOf(Course course) {
        return semesters.findById(course.getSemesterId()).orElseThrow(ApiException::notFound);
    }
}
