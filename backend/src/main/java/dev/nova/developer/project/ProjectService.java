package dev.nova.developer.project;

import dev.nova.academics.resource.WebLinks;
import dev.nova.common.web.ApiException;
import dev.nova.developer.project.ProjectDtos.MilestonePatch;
import dev.nova.developer.project.ProjectDtos.MilestoneRequest;
import dev.nova.developer.project.ProjectDtos.MilestoneResponse;
import dev.nova.developer.project.ProjectDtos.Progress;
import dev.nova.developer.project.ProjectDtos.ProjectRequest;
import dev.nova.developer.project.ProjectDtos.ProjectResponse;
import dev.nova.planner.task.TaskRepository;
import dev.nova.user.UserClock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Projects and their milestones. Milestones are kept in a dense 0..n-1 order (the service
 * renumbers on move and delete), like exam topics, so the UI can treat positions as indexes.
 */
@Service
public class ProjectService {

    static final int MAX_PROJECTS = 100;
    static final int MAX_MILESTONES = 100;

    private final ProjectRepository projects;
    private final MilestoneRepository milestones;
    private final TaskRepository tasks;
    private final UserClock userClock;

    public ProjectService(
            ProjectRepository projects, MilestoneRepository milestones, TaskRepository tasks, UserClock userClock) {
        this.projects = projects;
        this.milestones = milestones;
        this.tasks = tasks;
        this.userClock = userClock;
    }

    // ───────────── projects ─────────────

    /** Newest first; {@code statuses} empty means all. */
    @Transactional(readOnly = true)
    public List<ProjectResponse> list(UUID userId, Collection<ProjectStatus> statuses) {
        List<Project> found = statuses == null || statuses.isEmpty()
                ? projects.findByUserIdOrderByCreatedAtDesc(userId)
                : projects.findByUserIdAndStatusInOrderByCreatedAtDesc(userId, statuses);
        return responses(userId, found);
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(UUID userId, UUID projectId) {
        return responses(userId, List.of(require(userId, projectId))).getFirst();
    }

    @Transactional
    public ProjectResponse create(UUID userId, ProjectRequest request) {
        if (projects.countByUserId(userId) >= MAX_PROJECTS) {
            throw ApiException.ruleViolation("name", "You can have up to " + MAX_PROJECTS + " projects.");
        }
        Project project = new Project(userId);
        apply(project, request);
        projects.saveAndFlush(project);
        return get(userId, project.getId());
    }

    @Transactional
    public ProjectResponse update(UUID userId, UUID projectId, ProjectRequest request) {
        Project project = require(userId, projectId);
        apply(project, request);
        projects.flush();
        return get(userId, projectId);
    }

    /** Milestones go with it (cascade); linked tasks stay and lose the link. */
    @Transactional
    public void delete(UUID userId, UUID projectId) {
        projects.delete(require(userId, projectId));
    }

    // ───────────── milestones ─────────────

    @Transactional
    public ProjectResponse addMilestone(UUID userId, UUID projectId, MilestoneRequest request) {
        Project project = require(userId, projectId);
        long count = milestones.countByProjectId(project.getId());
        if (count >= MAX_MILESTONES) {
            throw ApiException.ruleViolation(
                    "title", "A project can have up to " + MAX_MILESTONES + " milestones.");
        }
        milestones.saveAndFlush(new Milestone(
                userId, project.getId(), request.title().strip(), request.dueOn(), Math.toIntExact(count)));
        return get(userId, projectId);
    }

    /** Replaces a milestone's title and due date (a null date clears it). */
    @Transactional
    public ProjectResponse editMilestone(UUID userId, UUID projectId, UUID milestoneId, MilestoneRequest request) {
        Milestone milestone = requireMilestone(userId, projectId, milestoneId);
        milestone.edit(request.title().strip(), request.dueOn());
        milestones.flush();
        return get(userId, projectId);
    }

    /** Ticks or moves a milestone. */
    @Transactional
    public ProjectResponse patchMilestone(UUID userId, UUID projectId, UUID milestoneId, MilestonePatch patch) {
        if (patch.done() == null && patch.position() == null) {
            throw ApiException.invalidField("done", "Send done or position.");
        }
        Milestone milestone = requireMilestone(userId, projectId, milestoneId);
        if (patch.done() != null) {
            milestone.markDone(patch.done(), userClock.now());
        }
        if (patch.position() != null) {
            List<Milestone> ordered =
                    new ArrayList<>(milestones.findByProjectIdAndUserIdOrderByDisplayOrderAsc(projectId, userId));
            if (patch.position() >= ordered.size()) {
                throw ApiException.invalidField("position", "Must be between 0 and " + (ordered.size() - 1) + ".");
            }
            ordered.removeIf(m -> m.getId().equals(milestone.getId()));
            ordered.add(patch.position(), milestone);
            renumber(ordered);
        }
        milestones.flush();
        return get(userId, projectId);
    }

    @Transactional
    public ProjectResponse deleteMilestone(UUID userId, UUID projectId, UUID milestoneId) {
        Milestone milestone = requireMilestone(userId, projectId, milestoneId);
        milestones.delete(milestone);
        List<Milestone> rest =
                new ArrayList<>(milestones.findByProjectIdAndUserIdOrderByDisplayOrderAsc(projectId, userId));
        rest.removeIf(m -> m.getId().equals(milestone.getId()));
        renumber(rest);
        milestones.flush();
        return get(userId, projectId);
    }

    // ───────────── helpers ─────────────

    private void apply(Project project, ProjectRequest request) {
        List<String> stack;
        try {
            stack = TechStack.normalize(request.techStack());
        } catch (IllegalArgumentException e) {
            throw ApiException.invalidField("techStack", e.getMessage());
        }
        if (request.startedOn() != null && request.targetOn() != null
                && request.targetOn().isBefore(request.startedOn())) {
            throw ApiException.invalidField("targetOn", "The target date can’t be before the start date.");
        }
        project.edit(
                request.name().strip(),
                blankToNull(request.description()),
                stack,
                link("repoUrl", request.repoUrl()),
                link("demoUrl", request.demoUrl()),
                request.status() == null ? ProjectStatus.IDEA : request.status(),
                request.startedOn(),
                request.targetOn());
    }

    /** Empty means no link; anything else must be a full http(s) address. */
    private static String link(String field, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return WebLinks.normalize(raw)
                .orElseThrow(() -> ApiException.invalidField(
                        field, "Use a full web address starting with http:// or https://."));
    }

    private Project require(UUID userId, UUID projectId) {
        return projects.findByIdAndUserId(projectId, userId).orElseThrow(ApiException::notFound);
    }

    private Milestone requireMilestone(UUID userId, UUID projectId, UUID milestoneId) {
        require(userId, projectId);
        return milestones.findByIdAndProjectIdAndUserId(milestoneId, projectId, userId)
                .orElseThrow(ApiException::notFound);
    }

    private static void renumber(List<Milestone> inOrder) {
        for (int i = 0; i < inOrder.size(); i++) {
            inOrder.get(i).moveTo(i);
        }
    }

    /** One milestone query and one task count for the whole batch. */
    private List<ProjectResponse> responses(UUID userId, List<Project> batch) {
        if (batch.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = batch.stream().map(Project::getId).toList();
        Map<UUID, List<Milestone>> byProject = milestones.findByUserIdAndProjectIdInOrderByDisplayOrderAsc(userId, ids)
                .stream()
                .collect(Collectors.groupingBy(Milestone::getProjectId));
        Map<UUID, Long> openTasks = tasks.countOpenByProject(userId, ids).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
        LocalDate today = userClock.today(userId);
        return batch.stream()
                .map(p -> {
                    List<MilestoneResponse> ms = byProject.getOrDefault(p.getId(), List.of()).stream()
                            .map(m -> new MilestoneResponse(
                                    m.getId(),
                                    m.getTitle(),
                                    m.getDueOn(),
                                    m.getDisplayOrder(),
                                    m.isDone(),
                                    m.getDoneAt(),
                                    !m.isDone() && m.getDueOn() != null && m.getDueOn().isBefore(today)))
                            .toList();
                    long done = ms.stream().filter(MilestoneResponse::done).count();
                    return new ProjectResponse(
                            p.getId(),
                            p.getName(),
                            p.getDescription(),
                            p.getTechStack(),
                            p.getRepoUrl(),
                            p.getDemoUrl(),
                            p.getStatus(),
                            p.getStartedOn(),
                            p.getTargetOn(),
                            Progress.of(done, ms.size()),
                            ms.stream().filter(m -> !m.done()).findFirst().orElse(null),
                            openTasks.getOrDefault(p.getId(), 0L),
                            ms,
                            p.getCreatedAt());
                })
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
