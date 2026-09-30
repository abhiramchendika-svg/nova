package dev.nova.academics.overview;

import dev.nova.academics.assignment.AssignmentService;
import dev.nova.academics.attendance.AttendanceService;
import dev.nova.academics.course.CourseDtos.CourseResponse;
import dev.nova.academics.course.CourseService;
import dev.nova.academics.exam.ExamService;
import dev.nova.academics.resource.CourseResourceService;
import dev.nova.academics.timetable.TimetableService;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Composes the course page from the feature services. It lives in its own package so none of those
 * features depend on each other just to build this view.
 */
@Service
public class CourseOverviewService {

    static final int ASSIGNMENT_PREVIEW = 5;
    static final int EXAM_PREVIEW = 3;

    private final CourseService courses;
    private final AttendanceService attendance;
    private final AssignmentService assignments;
    private final ExamService exams;
    private final CourseResourceService resources;
    private final TimetableService timetable;

    public CourseOverviewService(
            CourseService courses,
            AttendanceService attendance,
            AssignmentService assignments,
            ExamService exams,
            CourseResourceService resources,
            TimetableService timetable) {
        this.courses = courses;
        this.attendance = attendance;
        this.assignments = assignments;
        this.exams = exams;
        this.resources = resources;
        this.timetable = timetable;
    }

    /** One read-only transaction, so every part reflects the same moment. 404 if it isn't the user's course. */
    @Transactional(readOnly = true)
    public CourseOverview overview(UUID userId, UUID courseId) {
        CourseResponse course = courses.get(userId, courseId); // checks ownership first
        return new CourseOverview(
                course,
                attendance.forCourse(userId, courseId),
                assignments.openForCourse(userId, courseId, ASSIGNMENT_PREVIEW),
                assignments.countOpen(userId, courseId),
                assignments.countOverdue(userId, courseId),
                exams.upcomingForCourse(userId, courseId, EXAM_PREVIEW),
                resources.list(userId, courseId),
                timetable.forCourse(userId, courseId));
    }
}
