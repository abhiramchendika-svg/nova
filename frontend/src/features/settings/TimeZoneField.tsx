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
    <div className="grid gap-2">
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
        <div>
          <Button size="sm" variant="ghost" onClick={() => onChange(device)}>
            Use this device’s time zone ({device})
          </Button>
        </div>
      )}
    </div>
  );
}
