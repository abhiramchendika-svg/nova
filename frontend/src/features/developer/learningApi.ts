import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plannerKeys } from '@/features/planner/api';
import { api, type ApiError } from '@/services/http';
import { developerKeys } from './api';
import type { GoalRequest, GoalStatus, LearningGoal, ResourceRequest } from './types';

/** Under the developer keys, so project and goal changes refresh each other's views on Home. */
export const learningKeys = {
  goals: (statuses: GoalStatus[] | null) => ['developer', 'goals', statuses] as const,
  goal: (id: string) => ['developer', 'goal', id] as const,
};

/** Newest first; null statuses means all. */
export function useGoals(statuses: GoalStatus[] | null = null, enabled = true) {
  const query = statuses?.length ? `?${statuses.map((s) => `status=${s}`).join('&')}` : '';
  return useQuery<LearningGoal[], ApiError>({
    queryKey: learningKeys.goals(statuses),
    queryFn: ({ signal }) => api<LearningGoal[]>(`/learning-goals${query}`, { signal }),
    enabled,
  });
}

export function useGoal(id: string) {
  return useQuery<LearningGoal, ApiError>({
    queryKey: learningKeys.goal(id),
    queryFn: ({ signal }) => api<LearningGoal>(`/learning-goals/${id}`, { signal }),
  });
}

/** Goal, topic and link writes return the whole goal; the page updates from it straight away. */
function useGoalWrite<V>(request: (vars: V) => Promise<LearningGoal>) {
  const queryClient = useQueryClient();
  return useMutation<LearningGoal, ApiError, V>({
    mutationFn: request,
    onSuccess: async (goal) => {
      queryClient.setQueryData(learningKeys.goal(goal.id), goal);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: developerKeys.all,
          predicate: (q) => !(q.queryKey[1] === 'goal' && q.queryKey[2] === goal.id),
        }),
        queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      ]);
    },
  });
}

export function useCreateGoal() {
  return useGoalWrite((body: GoalRequest) => api<LearningGoal>('/learning-goals', { method: 'POST', body }));
}

export function useUpdateGoal() {
  return useGoalWrite(({ id, body }: { id: string; body: GoalRequest }) =>
    api<LearningGoal>(`/learning-goals/${id}`, { method: 'PUT', body }),
  );
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/learning-goals/${id}`, { method: 'DELETE' }),
    onSuccess: async (_v, id) => {
      queryClient.removeQueries({ queryKey: learningKeys.goal(id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: developerKeys.all }),
        queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      ]);
    },
  });
}

export function useAddTopic() {
  return useGoalWrite(({ goalId, title }: { goalId: string; title: string }) =>
    api<LearningGoal>(`/learning-goals/${goalId}/topics`, { method: 'POST', body: { title } }),
  );
}

export function usePatchTopic() {
  return useGoalWrite(
    ({
      goalId,
      topicId,
      ...body
    }: {
      goalId: string;
      topicId: string;
      done?: boolean;
      title?: string;
      position?: number;
    }) => api<LearningGoal>(`/learning-goals/${goalId}/topics/${topicId}`, { method: 'PATCH', body }),
  );
}

export function useDeleteTopic() {
  return useGoalWrite(({ goalId, topicId }: { goalId: string; topicId: string }) =>
    api<LearningGoal>(`/learning-goals/${goalId}/topics/${topicId}`, { method: 'DELETE' }),
  );
}

export function useAddResource() {
  return useGoalWrite(({ goalId, body }: { goalId: string; body: ResourceRequest }) =>
    api<LearningGoal>(`/learning-goals/${goalId}/resources`, { method: 'POST', body }),
  );
}

export function useEditResource() {
  return useGoalWrite(
    ({ goalId, resourceId, body }: { goalId: string; resourceId: string; body: ResourceRequest }) =>
      api<LearningGoal>(`/learning-goals/${goalId}/resources/${resourceId}`, { method: 'PUT', body }),
  );
}

export function useDeleteResource() {
  return useGoalWrite(({ goalId, resourceId }: { goalId: string; resourceId: string }) =>
    api<LearningGoal>(`/learning-goals/${goalId}/resources/${resourceId}`, { method: 'DELETE' }),
  );
}
