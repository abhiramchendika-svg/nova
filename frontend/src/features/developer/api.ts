import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plannerKeys } from '@/features/planner/api';
import { api, type ApiError } from '@/services/http';
import type { MilestoneRequest, Project, ProjectRequest, ProjectStatus } from './types';

/**
 * Developer query keys all start with 'developer'. Project writes also refresh the planner (tasks
 * show project names; milestones are on the calendar and Home).
 */
export const developerKeys = {
  all: ['developer'] as const,
  projects: (statuses: ProjectStatus[] | null) => ['developer', 'projects', statuses] as const,
  project: (id: string) => ['developer', 'project', id] as const,
};

function useInvalidateDeveloper() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: developerKeys.all }),
      queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
    ]);
}

/** Newest first; null statuses means all. */
export function useProjects(statuses: ProjectStatus[] | null = null, enabled = true) {
  const query = statuses?.length ? `?${statuses.map((s) => `status=${s}`).join('&')}` : '';
  return useQuery<Project[], ApiError>({
    queryKey: developerKeys.projects(statuses),
    queryFn: ({ signal }) => api<Project[]>(`/projects${query}`, { signal }),
    enabled,
  });
}

export function useProject(id: string) {
  return useQuery<Project, ApiError>({
    queryKey: developerKeys.project(id),
    queryFn: ({ signal }) => api<Project>(`/projects/${id}`, { signal }),
  });
}

/**
 * Project and milestone writes return the whole project, so its page updates from the response
 * straight away; everything else refreshes through invalidation.
 */
function useProjectWrite<V>(request: (vars: V) => Promise<Project>) {
  const queryClient = useQueryClient();
  return useMutation<Project, ApiError, V>({
    mutationFn: request,
    onSuccess: async (project) => {
      queryClient.setQueryData(developerKeys.project(project.id), project);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: developerKeys.all,
          predicate: (q) => !(q.queryKey[1] === 'project' && q.queryKey[2] === project.id),
        }),
        queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      ]);
    },
  });
}

export function useCreateProject() {
  return useProjectWrite((body: ProjectRequest) => api<Project>('/projects', { method: 'POST', body }));
}

export function useUpdateProject() {
  return useProjectWrite(({ id, body }: { id: string; body: ProjectRequest }) =>
    api<Project>(`/projects/${id}`, { method: 'PUT', body }),
  );
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDeveloper();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: async (_v, id) => {
      queryClient.removeQueries({ queryKey: developerKeys.project(id) });
      await invalidate();
    },
  });
}

export function useAddMilestone() {
  return useProjectWrite(({ projectId, body }: { projectId: string; body: MilestoneRequest }) =>
    api<Project>(`/projects/${projectId}/milestones`, { method: 'POST', body }),
  );
}

export function useEditMilestone() {
  return useProjectWrite(
    ({ projectId, milestoneId, body }: { projectId: string; milestoneId: string; body: MilestoneRequest }) =>
      api<Project>(`/projects/${projectId}/milestones/${milestoneId}`, { method: 'PUT', body }),
  );
}

export function usePatchMilestone() {
  return useProjectWrite(
    ({
      projectId,
      milestoneId,
      ...body
    }: {
      projectId: string;
      milestoneId: string;
      done?: boolean;
      position?: number;
    }) => api<Project>(`/projects/${projectId}/milestones/${milestoneId}`, { method: 'PATCH', body }),
  );
}

export function useDeleteMilestone() {
  return useProjectWrite(({ projectId, milestoneId }: { projectId: string; milestoneId: string }) =>
    api<Project>(`/projects/${projectId}/milestones/${milestoneId}`, { method: 'DELETE' }),
  );
}
