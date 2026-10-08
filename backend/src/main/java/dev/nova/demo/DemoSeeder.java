package dev.nova.demo;

import dev.nova.academics.assignment.AssignmentDtos.AssignmentRequest;
import dev.nova.academics.assignment.AssignmentDtos.ProgressRequest;
import dev.nova.academics.assignment.AssignmentPriority;
import dev.nova.academics.assignment.AssignmentService;
import dev.nova.academics.assignment.AssignmentStatus;
import dev.nova.academics.attendance.AttendanceDtos.BaselineRequest;
import dev.nova.academics.attendance.AttendanceService;
import dev.nova.academics.course.CourseDtos.CourseRequest;
import dev.nova.academics.course.CourseDtos.GradeRequest;
import dev.nova.academics.course.CourseService;
import dev.nova.academics.course.GradeKind;
import dev.nova.academics.exam.ExamDtos;
import dev.nova.academics.exam.ExamDtos.ExamRequest;
import dev.nova.academics.exam.ExamDtos.ExamResponse;
import dev.nova.academics.exam.ExamKind;
import dev.nova.academics.exam.ExamService;
import dev.nova.academics.resource.CourseResourceDtos;
import dev.nova.academics.resource.CourseResourceService;
import dev.nova.academics.semester.SemesterDtos.SemesterRequest;
import dev.nova.academics.semester.SemesterService;
import dev.nova.academics.timetable.ClassKind;
import dev.nova.academics.timetable.TimetableDtos.EntryRequest;
import dev.nova.academics.timetable.TimetableService;
import dev.nova.developer.hackathon.HackathonDtos.HackathonRequest;
import dev.nova.developer.hackathon.HackathonMode;
import dev.nova.developer.hackathon.HackathonService;
import dev.nova.developer.hackathon.HackathonStatus;
import dev.nova.developer.internship.InternshipDtos.InternshipRequest;
import dev.nova.developer.internship.InternshipService;
import dev.nova.developer.internship.InternshipStatus;
import dev.nova.developer.learning.GoalStatus;
import dev.nova.developer.learning.LearningDtos;
import dev.nova.developer.learning.LearningDtos.GoalRequest;
import dev.nova.developer.learning.LearningDtos.GoalResponse;
import dev.nova.developer.learning.LearningService;
import dev.nova.developer.project.ProjectDtos.MilestonePatch;
import dev.nova.developer.project.ProjectDtos.MilestoneRequest;
import dev.nova.developer.project.ProjectDtos.ProjectRequest;
import dev.nova.developer.project.ProjectDtos.ProjectResponse;
import dev.nova.developer.project.ProjectService;
import dev.nova.developer.project.ProjectStatus;
import dev.nova.planner.task.Recurrence;
import dev.nova.planner.task.TaskCategory;
import dev.nova.planner.task.TaskDtos.TaskRequest;
import dev.nova.planner.task.TaskPriority;
import dev.nova.planner.task.TaskService;
import dev.nova.planner.task.TaskStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fills a new demo account with clearly fictional data (docs/database.md §8): invented courses,
 * example.com links, no real people and no GitHub data. Everything is placed relative to the
 * visitor's "today", so the demo always has something overdue, due soon and later. It mirrors the
 * browser mock's demo (frontend/src/mocks/demo.ts), so both look the same.
 *
 * It goes through the same services as the API, so the data obeys every rule real data does.
 */
@Component
class DemoSeeder {

    /** The built-in "10-point scale" and its grades (V3 migration). */
    static final UUID TEN_POINT = UUID.fromString("00000000-0000-4000-8000-000000000001");

    private static final Map<String, UUID> TEN_POINT_GRADES = Map.of(
            "O", UUID.fromString("00000000-0000-4000-8000-000000000101"),
            "A+", UUID.fromString("00000000-0000-4000-8000-000000000102"),
            "A", UUID.fromString("00000000-0000-4000-8000-000000000103"),
            "B+", UUID.fromString("00000000-0000-4000-8000-000000000104"));

    private final SemesterService semesters;
    private final CourseService courses;
    private final AttendanceService attendance;
    private final AssignmentService assignments;
    private final ExamService exams;
    private final CourseResourceService resources;
    private final TimetableService timetable;
    private final ProjectService projects;
    private final LearningService learning;
    private final HackathonService hackathons;
    private final InternshipService internships;
    private final TaskService tasks;

    DemoSeeder(
            SemesterService semesters,
            CourseService courses,
            AttendanceService attendance,
            AssignmentService assignments,
            ExamService exams,
            CourseResourceService resources,
            TimetableService timetable,
            ProjectService projects,
            LearningService learning,
            HackathonService hackathons,
            InternshipService internships,
            TaskService tasks) {
        this.semesters = semesters;
        this.courses = courses;
        this.attendance = attendance;
        this.assignments = assignments;
        this.exams = exams;
        this.resources = resources;
        this.timetable = timetable;
        this.projects = projects;
        this.learning = learning;
        this.hackathons = hackathons;
        this.internships = internships;
        this.tasks = tasks;
    }

    /** Seeds everything for {@code userId}, whose settings already hold {@code zone}. */
    @Transactional
    public void seed(UUID userId, Instant now, ZoneId zone) {
        Days days = new Days(LocalDate.ofInstant(now, zone), zone);
        Map<String, UUID> course = academics(userId, days);
        UUID midsem = coursework(userId, days, course);
        UUID project = projects(userId, days);
        UUID goal = learningGoal(userId, days);
        UUID hackathon = hackathons(userId, days, project);
        UUID internship = internships(userId, days);
        tasks(userId, days, course, midsem, project, goal, hackathon, internship);
    }

    /** "today + n days" at a local time in the visitor's timezone. */
    private record Days(LocalDate today, ZoneId zone) {

        LocalDate on(int n) {
            return today.plusDays(n);
        }

        OffsetDateTime at(int n, int hour, int minute) {
            return on(n).atTime(LocalTime.of(hour, minute)).atZone(zone).toOffsetDateTime();
        }

        OffsetDateTime at(int n, int hour) {
            return at(n, hour, 0);
        }
    }

    // ───────────── Academics: three semesters, the last one current ─────────────

    private Map<String, UUID> academics(UUID userId, Days d) {
        UUID s1 = semester(userId, "Semester 1", 1, d.on(-450), d.on(-320), false);
        UUID s2 = semester(userId, "Semester 2", 2, d.on(-270), d.on(-140), false);
        UUID s3 = semester(userId, "Semester 3", 3, d.on(-75), d.on(60), true);

        Map<String, UUID> ids = new HashMap<>();
        ids.put("Calculus", course(userId, s1, "MAT 101", "Calculus", 4, "A", GradeKind.FINAL));
        ids.put("Programming in C", course(userId, s1, "CSE 101", "Programming in C", 4, "O", GradeKind.FINAL));
        ids.put("Engineering Physics", course(userId, s1, "PHY 101", "Engineering Physics", 3, "B+", GradeKind.FINAL));
        ids.put("Linear Algebra", course(userId, s2, "MAT 102", "Linear Algebra", 4, "A+", GradeKind.FINAL));
        ids.put("Data Structures", course(userId, s2, "CSE 102", "Data Structures", 4, "O", GradeKind.FINAL));
        ids.put("Digital Logic", course(userId, s2, "ECE 101", "Digital Logic", 3, "A", GradeKind.FINAL));
        ids.put("Database Systems", course(userId, s3, "CSE 201", "Database Systems", 4, "A+", GradeKind.EXPECTED));
        ids.put("Operating Systems", course(userId, s3, "CSE 203", "Operating Systems", 4, null, null));
        ids.put("Compilers", course(userId, s3, "CSE 205", "Compilers", 3, null, null));

        // With the 75% default target: Database Systems is safe, Compilers at risk, Operating Systems below
        attendance.setBaseline(userId, ids.get("Database Systems"), new BaselineRequest(30, 26));
        attendance.setBaseline(userId, ids.get("Compilers"), new BaselineRequest(20, 16));
        attendance.setBaseline(userId, ids.get("Operating Systems"), new BaselineRequest(30, 22));
        return ids;
    }

    private UUID semester(UUID userId, String name, int ordinal, LocalDate startsOn, LocalDate endsOn, boolean current) {
        return semesters
                .create(userId, new SemesterRequest(name, ordinal, startsOn, endsOn, TEN_POINT, current, null))
                .id();
    }

    private UUID course(
            UUID userId, UUID semesterId, String code, String name, int credits, String grade, GradeKind kind) {
        UUID id = courses.create(
                        userId,
                        new CourseRequest(semesterId, code, name, BigDecimal.valueOf(credits), null, null, null, null))
                .id();
        if (grade != null) {
            courses.setGrade(userId, id, new GradeRequest(TEN_POINT_GRADES.get(grade), kind));
        }
        return id;
    }

    // ───────────── Coursework for the current semester; returns the mid-semester exam ─────────────

    private UUID coursework(UUID userId, Days d, Map<String, UUID> course) {
        UUID os = course.get("Operating Systems");
        UUID db = course.get("Database Systems");
        UUID cc = course.get("Compilers");

        assignment(userId, os, "Scheduler simulation report", d.at(-1, 18), AssignmentPriority.HIGH,
                AssignmentStatus.IN_PROGRESS, 60);
        assignment(userId, db, "ER diagram for the library schema", d.at(1, 18), AssignmentPriority.MEDIUM,
                AssignmentStatus.IN_PROGRESS, 30);
        assignment(userId, cc, "Lexer for the toy language", d.at(3, 18), AssignmentPriority.HIGH, null, null);
        assignment(userId, db, "SQL practice set 4", d.at(5, 18), AssignmentPriority.LOW, null, null);
        assignment(userId, os, "Paging worksheet", d.at(12, 18), AssignmentPriority.MEDIUM, null, null);
        assignment(userId, cc, "Grammar exercises", d.at(-4, 18), AssignmentPriority.MEDIUM,
                AssignmentStatus.COMPLETED, 100);

        UUID midsem = exam(userId, db, "Mid-semester 1", ExamKind.MIDTERM, d.at(9, 9),
                List.of("ER modelling", "Normalization", "SQL joins", "Transactions"), 2);
        exam(userId, cc, "Quiz 2", ExamKind.QUIZ, d.at(4, 9), List.of("Regular expressions", "DFA minimisation"), 0);

        resources.add(userId, db, new CourseResourceDtos.ResourceRequest("Syllabus", "https://example.edu/cse201/syllabus"));
        resources.add(userId, db,
                new CourseResourceDtos.ResourceRequest("Lecture recordings", "https://example.edu/cse201/lectures"));

        // A Monday-to-Friday week; Wednesday's OS lab clashes with a DBMS tutorial on purpose
        slot(userId, db, 1, "09:00", "09:50", ClassKind.LECTURE, "Room 204");
        slot(userId, os, 1, "10:00", "10:50", ClassKind.LECTURE, "Room 204");
        slot(userId, cc, 1, "14:00", "16:00", ClassKind.LAB, "Lab 2");
        slot(userId, os, 2, "09:00", "09:50", ClassKind.LECTURE, "Room 204");
        slot(userId, db, 2, "11:00", "11:50", ClassKind.LECTURE, "Room 204");
        slot(userId, db, 3, "09:00", "09:50", ClassKind.LECTURE, "Room 204");
        slot(userId, cc, 3, "10:00", "10:50", ClassKind.LECTURE, "Room 204");
        slot(userId, os, 3, "14:00", "16:00", ClassKind.LAB, "Lab 1");
        slot(userId, db, 3, "15:00", "15:50", ClassKind.TUTORIAL, "Room 110");
        slot(userId, cc, 4, "09:00", "09:50", ClassKind.LECTURE, "Room 204");
        slot(userId, os, 4, "11:00", "11:50", ClassKind.LECTURE, "Room 204");
        slot(userId, db, 4, "14:00", "16:00", ClassKind.LAB, "Lab 3");
        slot(userId, db, 5, "10:00", "10:50", ClassKind.LECTURE, "Room 204");
        slot(userId, cc, 5, "11:00", "11:50", ClassKind.LECTURE, "Room 204");
        slot(userId, os, 5, "12:00", "12:50", ClassKind.LECTURE, "Room 204");
        return midsem;
    }

    private void assignment(
            UUID userId,
            UUID courseId,
            String title,
            OffsetDateTime dueAt,
            AssignmentPriority priority,
            AssignmentStatus status,
            Integer progress) {
        UUID id = assignments
                .create(userId, new AssignmentRequest(courseId, title, null, dueAt, priority, null))
                .id();
        if (status != null) {
            assignments.updateProgress(userId, id, new ProgressRequest(status, progress));
        }
    }

    private UUID exam(
            UUID userId, UUID courseId, String title, ExamKind kind, OffsetDateTime startsAt, List<String> topics, int done) {
        ExamResponse exam = exams.create(userId, new ExamRequest(courseId, title, kind, startsAt, 90, "Hall B", topics));
        for (int i = 0; i < done; i++) {
            exams.patchTopic(userId, exam.id(), exam.topics().get(i).id(), new ExamDtos.TopicPatch(true, null, null));
        }
        return exam.id();
    }

    private void slot(UUID userId, UUID courseId, int day, String start, String end, ClassKind kind, String location) {
        timetable.create(userId, new EntryRequest(courseId, day, start, end, kind, location, null));
    }

    // ───────────── Developer growth ─────────────

    private UUID projects(UUID userId, Days d) {
        ProjectResponse tracker = projects.create(
                userId,
                new ProjectRequest(
                        "Campus bus tracker",
                        "Live bus positions for the campus shuttle, from a GPS module and a small web map.",
                        List.of("Spring Boot", "React", "PostgreSQL"),
                        "https://github.com/example/campus-bus-tracker",
                        null,
                        ProjectStatus.DEVELOPMENT,
                        d.on(-40),
                        d.on(30)));
        UUID id = tracker.id();
        ProjectResponse withMilestone =
                projects.addMilestone(userId, id, new MilestoneRequest("GPS module sends positions", d.on(-14)));
        projects.addMilestone(userId, id, new MilestoneRequest("Map shows live buses", d.on(3)));
        projects.addMilestone(userId, id, new MilestoneRequest("Arrival estimates", d.on(20)));
        projects.patchMilestone(userId, id, withMilestone.milestones().getFirst().id(), new MilestonePatch(true, null));

        projects.create(
                userId, new ProjectRequest("Flashcards CLI", null, List.of("Rust"), null, null, ProjectStatus.IDEA, null, null));
        return id;
    }

    private UUID learningGoal(UUID userId, Days d) {
        GoalResponse goal = learning.create(
                userId,
                new GoalRequest(
                        "Spring Boot",
                        "Enough to build and test a REST API on my own.",
                        GoalStatus.ACTIVE,
                        d.on(45),
                        List.of(
                                "Dependency injection",
                                "Spring Data JPA",
                                "Validation",
                                "Spring Security",
                                "Testing with MockMvc")));
        for (int i = 0; i < 2; i++) {
            learning.patchTopic(
                    userId, goal.id(), goal.topics().get(i).id(), new LearningDtos.TopicPatch(true, null, null));
        }
        learning.addResource(
                userId,
                goal.id(),
                new LearningDtos.ResourceRequest("Spring Boot reference", "https://docs.spring.io/spring-boot/"));
        return goal.id();
    }

    private UUID hackathons(UUID userId, Days d, UUID projectId) {
        UUID upcoming = hackathons.create(
                        userId,
                        new HackathonRequest(
                                "Example City Civic Hack",
                                "Example Tech Club",
                                HackathonMode.OFFLINE,
                                "Innovation lab",
                                "https://example.com/civic-hack",
                                d.on(12),
                                d.on(13),
                                d.at(1, 23, 59),
                                d.at(13, 16),
                                HackathonStatus.INTERESTED,
                                "Null Pointers",
                                "Demo Student, A. Friend",
                                projectId,
                                null,
                                null,
                                null,
                                null,
                                null))
                .id();
        hackathons.create(
                userId,
                new HackathonRequest(
                        "Example Online Buildathon",
                        null,
                        HackathonMode.ONLINE,
                        null,
                        null,
                        d.on(-60),
                        d.on(-58),
                        null,
                        null,
                        HackathonStatus.FINISHED,
                        null,
                        null,
                        null,
                        "Finalist (top 12)",
                        "https://github.com/example/buildathon-entry",
                        null,
                        null,
                        null));
        return upcoming;
    }

    /** Three applications at different stages; returns the one with an interview coming up. */
    private UUID internships(UUID userId, Days d) {
        UUID interview = internships
                .create(
                        userId,
                        new InternshipRequest(
                                "Example Systems",
                                "Backend intern",
                                "Bengaluru · hybrid",
                                "https://example.com/careers/backend-intern",
                                "Campus",
                                InternshipStatus.APPLIED,
                                d.on(-12),
                                null,
                                "Technical interview",
                                d.at(2, 15),
                                "v3-backend",
                                null))
                .id();
        internships.changeStatus(userId, interview, InternshipStatus.ASSESSMENT);
        internships.changeStatus(userId, interview, InternshipStatus.INTERVIEW);

        internships.create(
                userId,
                new InternshipRequest(
                        "Sample Labs", "ML intern", null, null, "LinkedIn", InternshipStatus.APPLIED, d.on(-4), null,
                        null, null, null, null));
        internships.create(
                userId,
                new InternshipRequest(
                        "Placeholder Corp", "Frontend intern", null, null, null, InternshipStatus.SAVED, null,
                        d.at(5, 23, 59), null, null, null, null));
        return interview;
    }

    // ───────────── Planner ─────────────

    private void tasks(
            UUID userId,
            Days d,
            Map<String, UUID> course,
            UUID midsem,
            UUID project,
            UUID goal,
            UUID hackathon,
            UUID internship) {
        task(userId, new TaskBuilder("Two LeetCode mediums", TaskCategory.CODING)
                .planned(d.on(0), "21:00")
                .minutes(60)
                .repeat(Recurrence.DAILY));
        task(userId, new TaskBuilder("Email the lab TA about the demo slot", TaskCategory.PERSONAL)
                .priority(TaskPriority.HIGH)
                .planned(d.on(0), null)
                .due(d.at(0, 17)));
        task(userId, new TaskBuilder("Read the paging chapter", TaskCategory.ACADEMIC)
                .course(course.get("Operating Systems"))
                .planned(d.on(-1), null)
                .minutes(45));
        task(userId, new TaskBuilder("Study: SQL joins", TaskCategory.ACADEMIC)
                .course(course.get("Database Systems"))
                .exam(midsem)
                .planned(d.on(2), null)
                .minutes(60));
        task(userId, new TaskBuilder("Prepare for the technical interview", TaskCategory.INTERNSHIP)
                .priority(TaskPriority.HIGH)
                .internship(internship)
                .planned(d.on(1), null)
                .minutes(90));
        task(userId, new TaskBuilder("Register the team", TaskCategory.CODING)
                .hackathon(hackathon)
                .due(d.at(1, 23, 59)));
        task(userId, new TaskBuilder("Wire the map to live positions", TaskCategory.CODING)
                .project(project)
                .planned(d.on(3), null));
        task(userId, new TaskBuilder("Spring Security: read the architecture chapter", TaskCategory.CODING)
                .learningGoal(goal)
                .planned(d.on(4), null));
        task(userId, new TaskBuilder("Update résumé projects section", TaskCategory.INTERNSHIP)
                .priority(TaskPriority.HIGH)
                .planned(d.on(3), null));
        task(userId, new TaskBuilder("Finish the Rust ownership chapter", TaskCategory.CODING));
        UUID laundry = task(userId, new TaskBuilder("Laundry", TaskCategory.PERSONAL).planned(d.on(0), null));
        tasks.changeStatus(userId, laundry, TaskStatus.DONE);
    }

    private UUID task(UUID userId, TaskBuilder t) {
        return tasks.create(userId, t.build()).id();
    }

    /** TaskRequest has fifteen fields; this keeps each demo task to what it actually sets. */
    private static final class TaskBuilder {
        private final String title;
        private final TaskCategory category;
        private TaskPriority priority = TaskPriority.MEDIUM;
        private LocalDate plannedFor;
        private String plannedStart;
        private OffsetDateTime dueAt;
        private Integer minutes;
        private Recurrence recurrence = Recurrence.NONE;
        private UUID courseId;
        private UUID examId;
        private UUID projectId;
        private UUID learningGoalId;
        private UUID hackathonId;
        private UUID internshipId;

        TaskBuilder(String title, TaskCategory category) {
            this.title = title;
            this.category = category;
        }

        TaskBuilder priority(TaskPriority p) {
            priority = p;
            return this;
        }

        TaskBuilder planned(LocalDate day, String start) {
            plannedFor = day;
            plannedStart = start;
            return this;
        }

        TaskBuilder due(OffsetDateTime at) {
            dueAt = at;
            return this;
        }

        TaskBuilder minutes(int m) {
            minutes = m;
            return this;
        }

        TaskBuilder repeat(Recurrence r) {
            recurrence = r;
            return this;
        }

        TaskBuilder course(UUID id) {
            courseId = id;
            return this;
        }

        TaskBuilder exam(UUID id) {
            examId = id;
            return this;
        }

        TaskBuilder project(UUID id) {
            projectId = id;
            return this;
        }

        TaskBuilder learningGoal(UUID id) {
            learningGoalId = id;
            return this;
        }

        TaskBuilder hackathon(UUID id) {
            hackathonId = id;
            return this;
        }

        TaskBuilder internship(UUID id) {
            internshipId = id;
            return this;
        }

        TaskRequest build() {
            return new TaskRequest(
                    title,
                    null,
                    category,
                    priority,
                    plannedFor,
                    plannedStart,
                    dueAt,
                    minutes,
                    recurrence,
                    courseId,
                    examId,
                    projectId,
                    learningGoalId,
                    hackathonId,
                    internshipId);
        }
    }
}
