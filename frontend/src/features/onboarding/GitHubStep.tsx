import { Button } from '@/components/ui/Button';
import { GitHubConnectForm } from '@/features/developer/GitHubPage';
import { useGitHub } from '@/features/developer/githubApi';
import { Actions, StepHeader } from './parts';

/**
 * Step 6 (skippable): the GitHub username, checked with GitHub and read in public mode, so the
 * Developer pages and Home show real activity from the start.
 */
export function GitHubStep({
  onBack,
  onFinish,
  finishing,
}: {
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  const github = useGitHub();
  const connected = github.data?.connected ? github.data.username : null;

  return (
    <div className="grid gap-5">
      <StepHeader title="Your GitHub">
        NOVA reads your public profile, repositories and contributions by username. No password, no access to
        private code. You can skip this and connect from the GitHub page later.
      </StepHeader>
      {connected ? (
        <p className="text-[14px]">
          Connected as <span className="font-medium">{connected}</span>.
        </p>
      ) : (
        <GitHubConnectForm submitLabel="Connect and finish" onConnected={onFinish} />
      )}
      <Actions onBack={onBack}>
        <Button variant={connected ? 'primary' : 'secondary'} onClick={onFinish} loading={finishing}>
          {connected ? 'Finish' : 'Skip and finish'}
        </Button>
      </Actions>
    </div>
  );
}
