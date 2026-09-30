package dev.nova.academics.timetable;

import dev.nova.academics.attendance.AttendanceRecord;
import dev.nova.academics.attendance.AttendanceRecordRepository;
import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.semester.Semester;
import dev.nova.academics.semester.SemesterRepository;
import dev.nova.academics.timetable.TimetableDtos.DayClass;
import dev.nova.academics.timetable.TimetableDtos.DayResponse;
import dev.nova.academics.timetable.TimetableDtos.EntryRequest;
import dev.nova.academics.timetable.TimetableDtos.EntryResponse;
import dev.nova.academics.timetable.TimetableDtos.MarkedAttendance;
import dev.nova.academics.timetable.TimetableRules.ClassTime;
import dev.nova.common.web.ApiException;
import dev.nova.user.UserClock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly timetable. Overlapping classes are allowed (labs clash with lectures in real
 * timetables) and flagged with {@code overlapsWith}; overlaps are only checked within a semester.
 */
@Service
public class TimetableService {

    static final int MAX_PER_COURSE = 20;
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final Comparator<TimetableEntry> BY_TIME = Comparator.comparingInt(TimetableEntry::getDayOfWeek)
            .thenComparing(TimetableEntry::getStartsAt)
            .thenComparing(TimetableEntry::getEndsAt)
            .thenComparing(TimetableEntry::getId);

    private final TimetableRepository entries;
    private final CourseRepository courses;
    private final SemesterRepository semesters;
    private final AttendanceRecordRepository records;
    private final UserClock userClock;

    public TimetableService(
            TimetableRepository entries,
            CourseRepository courses,
            SemesterRepository semesters,
            AttendanceRecordRepository records,
            UserClock userClock) {
        this.entries = entries;
        this.courses = courses;
        this.semesters = semesters;
        this.records = records;
        this.userClock = userClock;
    }

    /** Every class in a semester's week (the current semester by default; empty if there's none). */
    @Transactional(readOnly = true)
    public List<EntryResponse> week(UUID userId, UUID semesterId) {
        Semester semester = semesterId == null
                ? semesters.findByUserIdAndCurrentTrue(userId).orElse(null)
                : semesters.findByIdAndUserId(semesterId, userId).orElseThrow(ApiException::notFound);
        if (semester == null) {
            return List.of();
        }
        Week week = weekOf(userId, semester.getId());
        return week.all().stream().map(week::response).toList();
    }

    /** One course's weekly classes (the course page). */
    @Transactional(readOnly = true)
    public List<EntryResponse> forCourse(UUID userId, UUID courseId) {
        Course course = courses.findByIdAndUserId(courseId, userId).orElseThrow(ApiException::notFound);
        Week week = weekOf(userId, course.getSemesterId());
        return week.all().stream()
                .filter(e -> e.getCourseId().equals(courseId))
                .map(week::response)
                .toList();
    }

    /**
     * A date's classes (today in the user's timezone by default), each with its attendance slot and
     * any mark already made, so Home can offer one-tap marking.
     */
    @Transactional(readOnly = true)
    public DayResponse day(UUID userId, LocalDate requested) {
        LocalDate date = requested != null ? requested : userClock.today(userId);
        int dayOfWeek = date.getDayOfWeek().getValue();
        Semester semester = semesters.findByUserIdAndCurrentTrue(userId).orElse(null);
        if (semester == null) {
            return new DayResponse(date, dayOfWeek, null, false, List.of());
        }
        boolean inTerm = (semester.getStartsOn() == null || !date.isBefore(semester.getStartsOn()))
                && (semester.getEndsOn() == null || !date.isAfter(semester.getEndsOn()));
        if (!inTerm) {
            return new DayResponse(date, dayOfWeek, semester.getId(), false, List.of());
        }
        Week week = weekOf(userId, semester.getId());
        List<TimetableEntry> today =
                week.all().stream().filter(e -> e.getDayOfWeek() == dayOfWeek).toList();
        Map<UUID, Integer> slots = TimetableRules.slotNumbers(today.stream().map(TimetableService::time).toList());
        List<UUID> courseIds = today.stream().map(TimetableEntry::getCourseId).distinct().toList();
        Map<String, AttendanceRecord> marks = courseIds.isEmpty()
                ? Map.of()
                : records.findByUserIdAndHeldOnAndCourseIdIn(userId, date, courseIds).stream()
                        .collect(Collectors.toMap(r -> r.getCourseId() + "#" + r.getSlot(), Function.identity()));
        List<DayClass> classes = today.stream()
                .map(e -> {
                    int slot = slots.get(e.getId());
                    AttendanceRecord mark = marks.get(e.getCourseId() + "#" + slot);
                    return new DayClass(
                            week.response(e),
                            slot,
                            mark == null ? null : new MarkedAttendance(mark.getId(), mark.getStatus()));
                })
                .toList();
        return new DayResponse(date, dayOfWeek, semester.getId(), true, classes);
    }

    @Transactional
    public EntryResponse create(UUID userId, EntryRequest request) {
        Course course = requireCourse(userId, request);
        requireRoomIn(course);
        TimetableEntry entry = new TimetableEntry(userId);
        apply(entry, course, request);
        entries.saveAndFlush(entry);
        return weekOf(userId, course.getSemesterId()).response(entry);
    }

    @Transactional
    public EntryResponse update(UUID userId, UUID entryId, EntryRequest request) {
        TimetableEntry entry = entries.findByIdAndUserId(entryId, userId).orElseThrow(ApiException::notFound);
        Course course = requireCourse(userId, request);
        if (!course.getId().equals(entry.getCourseId())) {
            requireRoomIn(course);
        }
        apply(entry, course, request);
        entries.flush();
        return weekOf(userId, course.getSemesterId()).response(entry);
    }

    @Transactional
    public void delete(UUID userId, UUID entryId) {
        entries.delete(entries.findByIdAndUserId(entryId, userId).orElseThrow(ApiException::notFound));
    }

    // ───────────── helpers ─────────────

    private void apply(TimetableEntry entry, Course course, EntryRequest request) {
        LocalTime start = LocalTime.parse(request.startsAt(), HH_MM);
        LocalTime end = LocalTime.parse(request.endsAt(), HH_MM);
        if (!end.isAfter(start)) {
            throw ApiException.invalidField("endsAt", "A class must end after it starts.");
        }
        entry.edit(
                course.getId(),
                request.dayOfWeek(),
                start,
                end,
                request.kind() == null ? ClassKind.LECTURE : request.kind(),
                blankToNull(request.location()),
                blankToNull(request.instructor()));
    }

    /** Someone else's course gets the same answer as a missing one. */
    private Course requireCourse(UUID userId, EntryRequest request) {
        return courses.findByIdAndUserId(request.courseId(), userId)
                .orElseThrow(() -> ApiException.invalidField("courseId", "Choose one of your courses."));
    }

    private void requireRoomIn(Course course) {
        if (entries.countByCourseId(course.getId()) >= MAX_PER_COURSE) {
            throw ApiException.ruleViolation(
                    "courseId", "A course can have up to " + MAX_PER_COURSE + " weekly classes.");
        }
    }

    /** A semester's classes with their courses and overlaps worked out once. */
    private Week weekOf(UUID userId, UUID semesterId) {
        Map<UUID, Course> byId = courses.findBySemesterIdAndUserIdOrderByNameAsc(semesterId, userId).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));
        List<TimetableEntry> all = byId.isEmpty()
                ? List.of()
                : entries.findByUserIdAndCourseIdIn(userId, byId.keySet()).stream()
                        .sorted(BY_TIME)
                        .toList();
        Map<UUID, List<UUID>> overlaps = TimetableRules.overlaps(all.stream().map(TimetableService::time).toList());
        return new Week(all, byId, overlaps);
    }

    private record Week(List<TimetableEntry> all, Map<UUID, Course> courses, Map<UUID, List<UUID>> overlaps) {

        EntryResponse response(TimetableEntry e) {
            Course course = courses.get(e.getCourseId());
            return new EntryResponse(
                    e.getId(),
                    e.getCourseId(),
                    course == null ? null : course.getCode(),
                    course == null ? null : course.getName(),
                    course == null ? null : course.getColorHue(),
                    e.getDayOfWeek(),
                    e.getStartsAt().format(HH_MM),
                    e.getEndsAt().format(HH_MM),
                    e.getKind(),
                    e.getLocation(),
                    e.getInstructor(),
                    overlaps.getOrDefault(e.getId(), List.of()));
        }
    }

    private static ClassTime time(TimetableEntry e) {
        return new ClassTime(e.getId(), e.getCourseId(), e.getDayOfWeek(), e.getStartsAt(), e.getEndsAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
