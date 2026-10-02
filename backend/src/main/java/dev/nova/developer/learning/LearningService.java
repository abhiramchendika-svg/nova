package dev.nova.developer.learning;

import dev.nova.academics.resource.WebLinks;
import dev.nova.common.web.ApiException;
import dev.nova.developer.learning.LearningDtos.GoalRequest;
import dev.nova.developer.learning.LearningDtos.GoalResponse;
import dev.nova.developer.learning.LearningDtos.Progress;
import dev.nova.developer.learning.LearningDtos.ResourceRequest;
import dev.nova.developer.learning.LearningDtos.ResourceResponse;
import dev.nova.developer.learning.LearningDtos.TopicPatch;
import dev.nova.developer.learning.LearningDtos.TopicRequest;
import dev.nova.developer.learning.LearningDtos.TopicResponse;
import dev.nova.planner.task.TaskRepository;
import dev.nova.user.UserClock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Learning goals, their topic checklists and resource links. Topics are kept in a dense 0..n-1
 * order (the service renumbers on move and delete), like exam topics and milestones.
 */
@Service
public class LearningService {

    static final int MAX_GOALS = 50;
    static final int MAX_TOPICS = 100;
    static final int MAX_RESOURCES = 20;

    private final LearningGoalRepository goals;
    private final LearningTopicRepository topics;
    private final LearningResourceRepository resources;
    private final TaskRepository tasks;
    private final UserClock userClock;

    public LearningService(
            LearningGoalRepository goals,
            LearningTopicRepository topics,
            LearningResourceRepository resources,
            TaskRepository tasks,
            UserClock userClock) {
        this.goals = goals;
        this.topics = topics;
        this.resources = resources;
        this.tasks = tasks;
        this.userClock = userClock;
    }

    // ───────────── goals ─────────────

    /** Newest first; {@code statuses} empty means all. */
    @Transactional(readOnly = true)
    public List<GoalResponse> list(UUID userId, Collection<GoalStatus> statuses) {
        List<LearningGoal> found = statuses == null || statuses.isEmpty()
                ? goals.findByUserIdOrderByCreatedAtDesc(userId)
                : goals.findByUserIdAndStatusInOrderByCreatedAtDesc(userId, statuses);
        return responses(userId, found);
    }

    @Transactional(readOnly = true)
    public GoalResponse get(UUID userId, UUID goalId) {
        return responses(userId, List.of(require(userId, goalId))).getFirst();
    }

    @Transactional
    public GoalResponse create(UUID userId, GoalRequest request) {
        if (goals.countByUserId(userId) >= MAX_GOALS) {
            throw ApiException.ruleViolation("title", "You can have up to " + MAX_GOALS + " learning goals.");
        }
        LearningGoal goal = new LearningGoal(userId);
        apply(goal, request);
        goals.saveAndFlush(goal);
        if (request.topics() != null) {
            List<LearningTopic> starter = new ArrayList<>();
            for (String title : request.topics()) {
                starter.add(new LearningTopic(userId, goal.getId(), title.strip(), starter.size()));
            }
            topics.saveAllAndFlush(starter);
        }
        return get(userId, goal.getId());
    }

    @Transactional
    public GoalResponse update(UUID userId, UUID goalId, GoalRequest request) {
        LearningGoal goal = require(userId, goalId);
        apply(goal, request);
        goals.flush();
        return get(userId, goalId);
    }

    /** Topics and links go with it (cascade); linked study tasks stay and lose the link. */
    @Transactional
    public void delete(UUID userId, UUID goalId) {
        goals.delete(require(userId, goalId));
    }

    // ───────────── topics ─────────────

    @Transactional
    public GoalResponse addTopic(UUID userId, UUID goalId, TopicRequest request) {
        LearningGoal goal = require(userId, goalId);
        long count = topics.countByGoalId(goal.getId());
        if (count >= MAX_TOPICS) {
            throw ApiException.ruleViolation("title", "A goal can have up to " + MAX_TOPICS + " topics.");
        }
        topics.saveAndFlush(new LearningTopic(userId, goal.getId(), request.title().strip(), Math.toIntExact(count)));
        return get(userId, goalId);
    }

    /** Ticks, renames or moves a topic. */
    @Transactional
    public GoalResponse patchTopic(UUID userId, UUID goalId, UUID topicId, TopicPatch patch) {
        if (patch.done() == null && patch.title() == null && patch.position() == null) {
            throw ApiException.invalidField("done", "Send done, title or position.");
        }
        if (patch.title() != null && patch.title().isBlank()) {
            throw ApiException.invalidField("title", "Name the topic.");
        }
        LearningTopic topic = requireTopic(userId, goalId, topicId);
        if (patch.done() != null) {
            topic.markDone(patch.done(), userClock.now());
        }
        if (patch.title() != null) {
            topic.rename(patch.title().strip());
        }
        if (patch.position() != null) {
            List<LearningTopic> ordered =
                    new ArrayList<>(topics.findByGoalIdAndUserIdOrderByDisplayOrderAsc(goalId, userId));
            if (patch.position() >= ordered.size()) {
                throw ApiException.invalidField("position", "Must be between 0 and " + (ordered.size() - 1) + ".");
            }
            ordered.removeIf(t -> t.getId().equals(topic.getId()));
            ordered.add(patch.position(), topic);
            renumber(ordered);
        }
        topics.flush();
        return get(userId, goalId);
    }

    @Transactional
    public GoalResponse deleteTopic(UUID userId, UUID goalId, UUID topicId) {
        LearningTopic topic = requireTopic(userId, goalId, topicId);
        topics.delete(topic);
        List<LearningTopic> rest = new ArrayList<>(topics.findByGoalIdAndUserIdOrderByDisplayOrderAsc(goalId, userId));
        rest.removeIf(t -> t.getId().equals(topic.getId()));
        renumber(rest);
        topics.flush();
        return get(userId, goalId);
    }

    // ───────────── resources ─────────────

    @Transactional
    public GoalResponse addResource(UUID userId, UUID goalId, ResourceRequest request) {
        LearningGoal goal = require(userId, goalId);
        if (resources.countByGoalId(goal.getId()) >= MAX_RESOURCES) {
            throw ApiException.ruleViolation("url", "A goal can have up to " + MAX_RESOURCES + " links.");
        }
        resources.saveAndFlush(new LearningResource(userId, goal.getId(), request.title().strip(), url(request)));
        return get(userId, goalId);
    }

    @Transactional
    public GoalResponse editResource(UUID userId, UUID goalId, UUID resourceId, ResourceRequest request) {
        require(userId, goalId);
        LearningResource resource = resources.findByIdAndGoalIdAndUserId(resourceId, goalId, userId)
                .orElseThrow(ApiException::notFound);
        resource.edit(request.title().strip(), url(request));
        resources.flush();
        return get(userId, goalId);
    }

    @Transactional
    public GoalResponse deleteResource(UUID userId, UUID goalId, UUID resourceId) {
        require(userId, goalId);
        LearningResource resource = resources.findByIdAndGoalIdAndUserId(resourceId, goalId, userId)
                .orElseThrow(ApiException::notFound);
        resources.delete(resource);
        resources.flush();
        return get(userId, goalId);
    }

    // ───────────── helpers ─────────────

    private static void apply(LearningGoal goal, GoalRequest request) {
        goal.edit(
                request.title().strip(),
                request.description() == null || request.description().isBlank()
                        ? null
                        : request.description().strip(),
                request.status() == null ? GoalStatus.ACTIVE : request.status(),
                request.targetOn());
    }

    private static String url(ResourceRequest request) {
        return WebLinks.normalize(request.url())
                .orElseThrow(() -> ApiException.invalidField(
                        "url", "Use a full web address starting with http:// or https://."));
    }

    private LearningGoal require(UUID userId, UUID goalId) {
        return goals.findByIdAndUserId(goalId, userId).orElseThrow(ApiException::notFound);
    }

    private LearningTopic requireTopic(UUID userId, UUID goalId, UUID topicId) {
        require(userId, goalId);
        return topics.findByIdAndGoalIdAndUserId(topicId, goalId, userId).orElseThrow(ApiException::notFound);
    }

    private static void renumber(List<LearningTopic> inOrder) {
        for (int i = 0; i < inOrder.size(); i++) {
            inOrder.get(i).moveTo(i);
        }
    }

    /** One topic query, one resource query and one task count for the whole batch. */
    private List<GoalResponse> responses(UUID userId, List<LearningGoal> batch) {
        if (batch.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = batch.stream().map(LearningGoal::getId).toList();
        Map<UUID, List<LearningTopic>> topicsByGoal = topics.findByUserIdAndGoalIdInOrderByDisplayOrderAsc(userId, ids)
                .stream()
                .collect(Collectors.groupingBy(LearningTopic::getGoalId));
        Map<UUID, List<LearningResource>> linksByGoal =
                resources.findByUserIdAndGoalIdInOrderByCreatedAtAscIdAsc(userId, ids).stream()
                        .collect(Collectors.groupingBy(LearningResource::getGoalId));
        Map<UUID, Long> openTasks = tasks.countOpenByLearningGoal(userId, ids).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
        return batch.stream()
                .map(g -> {
                    List<TopicResponse> ts = topicsByGoal.getOrDefault(g.getId(), List.of()).stream()
                            .map(t -> new TopicResponse(
                                    t.getId(), t.getTitle(), t.getDisplayOrder(), t.isDone(), t.getDoneAt()))
                            .toList();
                    long done = ts.stream().filter(TopicResponse::done).count();
                    return new GoalResponse(
                            g.getId(),
                            g.getTitle(),
                            g.getDescription(),
                            g.getStatus(),
                            g.getTargetOn(),
                            Progress.of(done, ts.size()),
                            ts.stream().filter(t -> !t.done()).findFirst().orElse(null),
                            openTasks.getOrDefault(g.getId(), 0L),
                            ts,
                            linksByGoal.getOrDefault(g.getId(), List.of()).stream()
                                    .map(r -> new ResourceResponse(r.getId(), r.getTitle(), r.getUrl()))
                                    .toList(),
                            g.getCreatedAt());
                })
                .toList();
    }
}
