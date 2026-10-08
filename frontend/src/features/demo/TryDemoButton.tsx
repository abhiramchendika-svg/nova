import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import type { ButtonSize, ButtonVariant } from '@/components/ui/buttonStyles';
import { FormAlert } from '@/components/patterns/FormAlert';
import { cn } from '@/lib/cn';
import { demoErrorMessage, useStartDemo } from './api';

interface TryDemoButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * "Try the demo": makes a temporary account full of made-up data and opens the app in it. Errors
 * (busy, switched off, offline) show right under the button.
 */
export function TryDemoButton({ variant = 'secondary', size = 'lg', className }: TryDemoButtonProps) {
  const navigate = useNavigate();
  const start = useStartDemo();
  return (
    <div className={cn('grid gap-2', className)}>
      <Button
        variant={variant}
        size={size}
        loading={start.isPending}
        onClick={() => start.mutate(undefined, { onSuccess: () => navigate('/app') })}
      >
        Try the demo
      </Button>
      {start.error && <FormAlert message={demoErrorMessage(start.error)} />}
    </div>
  );
}
