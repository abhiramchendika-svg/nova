package dev.nova.academics.overview;

import dev.nova.academics.assignment.AssignmentDtos.AssignmentResponse;
import dev.nova.academics.attendance.AttendanceDtos.CourseAttendance;
import dev.nova.academics.course.CourseDtos.CourseResponse;
import dev.nova.academics.exam.ExamDtos.ExamSummary;
import dev.nova.academics.resource.CourseResourceDtos.ResourceResponse;
import java.util.List;

/**
 * Everything the course page needs in one response (docs/api.md §2.4). The lists are short previews:
 * the next {@value CourseOverviewService#ASSIGNMENT_PREVIEW} open assignments and the next
 * {@value CourseOverviewService#EXAM_PREVIEW} exams; the counts say how many there are in total.
 */
public record CourseOverview(
        CourseResponse course,
        CourseAttendance attendance,
        List<AssignmentResponse> openAssignments,
        long openAssignmentCount,
        long overdueCount,
        List<ExamSummary> upcomingExams,
        List<ResourceResponse> resources) {}
