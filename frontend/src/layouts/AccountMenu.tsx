import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useCurrentUser, useLogout } from '@/features/auth/api';
import { initialsFor } from '@/lib/format';

const itemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-[13.5px] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink';

export function AccountMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Account: ${user.displayName}`}
        className="grid size-9 place-items-center rounded-full outline-none data-[state=open]:ring-2 data-[state=open]:ring-line-strong"
      >
        <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-[12px] font-semibold text-ink-2">
          {initialsFor(user.displayName)}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-pop"
        >
          <div className="px-2 pb-2 pt-1.5">
            <p className="text-[13.5px] font-semibold text-ink">{user.displayName}</p>
            <p className="truncate text-[12.5px] text-ink-3">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={itemClass} onSelect={() => navigate('/app/settings')}>
            <Settings size={15} aria-hidden />
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={itemClass}
            onSelect={() =>
              logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
            }
          >
            <LogOut size={15} aria-hidden />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
