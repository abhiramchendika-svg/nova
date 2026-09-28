import { Eye, EyeOff } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';

export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <IconButton label={visible ? 'Hide password' : 'Show password'} onClick={onToggle} aria-pressed={visible}>
      {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
    </IconButton>
  );
}
