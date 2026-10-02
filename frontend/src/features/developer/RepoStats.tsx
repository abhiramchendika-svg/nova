import { Star } from 'lucide-react';
import { formatDay } from '@/lib/dates';
import { repoKey, useGitHub } from './githubApi';

/**
 * A project's repository as GitHub last described it, when the repo link points at one of the
 * user's own public repositories. Shows nothing otherwise (no guessing, no zeros).
 */
export function RepoStats({ repoUrl }: { repoUrl: string | null }) {
  const key = repoUrl ? repoKey(repoUrl) : null;
  const github = useGitHub(key !== null);
  const repo = key ? github.data?.repos?.find((r) => repoKey(r.htmlUrl) === key) : undefined;
  if (!repo) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
      <span className="text-ink-3">From GitHub:</span>
      <span className="inline-flex items-center gap-0.5">
        <Star size={12} aria-hidden />
        {repo.stars} {repo.stars === 1 ? 'star' : 'stars'}
      </span>
      <span>
        {repo.forks} {repo.forks === 1 ? 'fork' : 'forks'}
      </span>
      {repo.language && <span>{repo.language}</span>}
      {repo.pushedAt && <span>last push {formatDay(repo.pushedAt.slice(0, 10))}</span>}
    </p>
  );
}
