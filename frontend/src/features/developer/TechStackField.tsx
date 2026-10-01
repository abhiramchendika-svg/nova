import { X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export const MAX_TECH = 15;
export const MAX_TECH_LENGTH = 30;

/**
 * Technologies as chips: type one and press Enter or a comma to add it; Backspace in the empty box
 * removes the last. Case-insensitive duplicates are ignored, like on the server (TechStack.java).
 * Suggestions come from the user's other projects.
 */
export function TechStackField({
  value,
  onChange,
  suggestions = [],
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  error?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const shown = error ?? localError;

  const add = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, ' ');
    if (!t) return;
    if (t.length > MAX_TECH_LENGTH) {
      setLocalError(`Keep each technology under ${MAX_TECH_LENGTH} characters.`);
      return;
    }
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      setDraft('');
      return;
    }
    if (value.length >= MAX_TECH) {
      setLocalError(`List up to ${MAX_TECH} technologies.`);
      return;
    }
    onChange([...value, t]);
    setDraft('');
    setLocalError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-input`} className="text-[13px] font-medium text-ink">
        Tech stack (optional)
      </label>
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-sm border bg-surface px-2 py-1.5',
          'transition-[border-color,box-shadow] duration-[var(--dur-1)]',
          'focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/25',
          shown ? 'border-critical' : 'border-line-strong',
        )}
      >
        {value.length > 0 && (
          <ul aria-label="Technologies" className="contents">
            {value.map((t) => (
              <li
                key={t}
                className="tint-developer inline-flex items-center gap-1 rounded-xs py-0.5 pl-2 pr-0.5 text-[12.5px] text-developer-text"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  className="grid size-5 place-items-center rounded-xs hover:bg-surface-3"
                  onClick={() => onChange(value.filter((v) => v !== t))}
                >
                  <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={`${id}-input`}
          className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-[14px] text-ink outline-none placeholder:text-ink-3"
          placeholder={value.length === 0 ? 'e.g. Spring Boot' : ''}
          list={unused.length ? `${id}-suggestions` : undefined}
          value={draft}
          aria-describedby={`${id}-hint`}
          aria-invalid={shown ? true : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setLocalError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
        />
        {unused.length > 0 && (
          <datalist id={`${id}-suggestions`}>
            {unused.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      <p id={`${id}-hint`} className={cn('text-[12.5px]', shown ? 'text-critical' : 'text-ink-3')}>
        {shown ?? `Press Enter or a comma to add each one. Up to ${MAX_TECH}.`}
      </p>
    </div>
  );
}
