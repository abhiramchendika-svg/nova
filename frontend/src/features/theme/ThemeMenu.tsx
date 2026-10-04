import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from './ThemeContext';
import type { ThemePreference } from './theme';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

/**
 * Theme switcher: Light / Dark / System, persisted per browser. Signed-in pages pass
 * {@code onChange} so the choice is saved to the account as well.
 */
export function ThemeMenu({ onChange }: { onChange?: (preference: ThemePreference) => void } = {}) {
  const { preference, resolved, setPreference } = useTheme();
  const choose = onChange ?? setPreference;
  const TriggerIcon = resolved === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <IconButton label={`Theme: ${preference}`}>
          <TriggerIcon size={17} aria-hidden />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-40 rounded-md border border-line bg-surface p-1 shadow-pop"
        >
          <DropdownMenu.Label className="label-caps px-2 pb-1 pt-1.5">Theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(value) => choose(value as ThemePreference)}
          >
            {OPTIONS.map(({ value, label, Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-[13.5px] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink data-[state=checked]:text-ink"
              >
                <Icon size={15} aria-hidden />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check size={14} aria-hidden />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
