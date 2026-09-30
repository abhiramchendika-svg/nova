/**
 * Side-by-side placement for one day's classes in the week grid. Classes that overlap share the
 * column width: each gets a lane, and every class in an overlapping group knows how many lanes
 * the group needs, so none of them cover each other.
 */

export interface Timed {
  id: string;
  startsAt: string; // HH:mm, compares correctly as text
  endsAt: string;
}

export interface Placement {
  lane: number;
  lanes: number;
}

export function placeDay(items: Timed[]): Map<string, Placement> {
  const sorted = [...items].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) || a.endsAt.localeCompare(b.endsAt) || a.id.localeCompare(b.id),
  );
  const result = new Map<string, Placement>();
  let group: { id: string; lane: number }[] = [];
  let laneEnds: string[] = [];
  let groupEnd = '';

  const closeGroup = () => {
    for (const g of group) result.set(g.id, { lane: g.lane, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
    groupEnd = '';
  };

  for (const item of sorted) {
    // A class starting at or after everything in the group has ended begins a new group
    if (group.length > 0 && item.startsAt >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= item.startsAt);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(item.endsAt);
    } else {
      laneEnds[lane] = item.endsAt;
    }
    group.push({ id: item.id, lane });
    if (item.endsAt > groupEnd) groupEnd = item.endsAt;
  }
  closeGroup();
  return result;
}
