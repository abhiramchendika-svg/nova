import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { localParts } from '@/lib/dates';
import { allTimeZones, deviceTimeZone, isValidTimeZone } from './timezones';

/**
 * Time zone picker: a text box with the browser's own suggestion list (type "Kolkata" and pick),
 * plus a one-click switch to this device's zone when it differs. The current time in the chosen
 * zone is shown so a wrong pick is obvious.
 */
export function TimeZoneField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (zone: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const listId = useId();
  const device = deviceTimeZone();
  const zone = value.trim();
  const now = isValidTimeZone(zone) ? localParts(new Date().toISOString(), zone).time : null;

  return (
    <div className="grid grid-cols-1 gap-2">
      <Field
        label="Time zone"
        list={listId}
        autoComplete="off"
        spellCheck={false}
        placeholder="Asia/Kolkata"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        error={error}
        hint={
          now
            ? `It’s ${now} there now. “Today”, due times and attendance dates all follow this zone.`
            : '“Today”, due times and attendance dates all follow this zone.'
        }
      />
      <datalist id={listId}>
        {allTimeZones().map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
      {device !== zone && (
        // The zone sits beside the button (not in it) so the row can wrap on a narrow phone
        <div className="flex flex-wrap items-center gap-x-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Use this device’s time zone (${device})`}
            onClick={() => onChange(device)}
          >
            Use this device’s time zone
          </Button>
          <span aria-hidden className="text-[12.5px] text-ink-3">
            {device}
          </span>
        </div>
      )}
    </div>
  );
}
