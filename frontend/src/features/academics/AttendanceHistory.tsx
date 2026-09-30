import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SelectField } from '@/components/ui/SelectField';
import { formatDay } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useAttendanceHistory, useChangeMark, useDeleteMark } from './api';
import { MARK_LABEL } from './attendanceText';
import type { AttendanceMark, AttendanceRecord } from './types';

function classLabel(record: AttendanceRecord): string {
  const day = formatDay(record.heldOn);
  return record.slot > 1 ? `${day}, class ${record.slot}` : day;
}

/** Marked classes for one course, newest first, 10 at a time. Each mark can be changed or removed. */
export function AttendanceHistory({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [page, setPage] = useState(0);
  const history = useAttendanceHistory(courseId, page, true);
  const changeMark = useChangeMark();
  const deleteMark = useDeleteMark();
  const mutationError = changeMark.error ?? deleteMark.error;

  if (history.isPending) return <Skeleton className="h-16" />;
  if (history.isError) {
    return (
      <p className="text-[13px] text-critical">We couldn’t load the history. {errorMessage(history.error)}</p>
    );
  }
  const { items, totalPages, totalItems } = history.data;
  if (totalItems === 0) {
    return (
      <p className="text-[13px] text-ink-2">No classes marked yet. Starting counts aren’t listed here.</p>
    );
  }

  return (
    <div className="grid gap-2">
      {mutationError && <p className="text-[13px] text-critical">{errorMessage(mutationError)}</p>}
      <ul
        aria-label={`Marked classes for ${courseName}`}
        className="divide-y divide-line rounded-sm border border-line"
      >
        {items.map((record) => {
          const label = classLabel(record);
          return (
            <li key={record.id} className="flex items-center gap-3 px-3 py-1.5">
              <span className="flex-1 text-[13px] text-ink">{label}</span>
              <SelectField
                label={`Mark for ${label}`}
                hideLabel
                controlSize="sm"
                className="w-36"
                value={record.status}
                disabled={changeMark.isPending}
                onChange={(e) =>
                  changeMark.mutate({ recordId: record.id, status: e.target.value as AttendanceMark })
                }
              >
                {(Object.keys(MARK_LABEL) as AttendanceMark[]).map((m) => (
                  <option key={m} value={m}>
                    {MARK_LABEL[m]}
                  </option>
                ))}
              </SelectField>
              <IconButton
                label={`Delete mark for ${label}`}
                disabled={deleteMark.isPending}
                onClick={() => deleteMark.mutate(record.id)}
              >
                <Trash2 size={15} aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-[12.5px] text-ink-2">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Newer
          </Button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </Button>
        </div>
      )}
    </div>
  );
}
