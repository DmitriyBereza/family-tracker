import { Activity, Profile, UpcomingItem, addDaysISO, todayISO } from "./types";

export function occursOn(a: Activity, dateISO: string): boolean {
  if (!a.active) return false;
  if (dateISO < a.startDate) return false;
  const [y, m, d] = dateISO.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  switch (a.recurrence) {
    case "once":
      return dateISO === a.startDate;
    case "daily":
      return true;
    case "weekly":
      if (!a.days || a.days.length === 0) return true;
      return a.days.includes(dow);
    case "interval": {
      const n = a.intervalDays || 2;
      const diff = Math.round(
        (new Date(y, m - 1, d).getTime() - new Date(a.startDate.slice(0, 4) + "/" + a.startDate.slice(5, 7) + "/" + a.startDate.slice(8, 10)).getTime()) /
          86400000
      );
      return diff >= 0 && diff % n === 0;
    }
  }
}

// Rotation: if enabled + assignedTo empty (family-wide), assignee cycles by occurrence index.
export function assigneesFor(
  a: Activity,
  dateISO: string,
  members: Profile[]
): Profile[] {
  const fam = members.filter((x) => x.role === "child").length ? members : members;
  if (a.assignedTo.length > 0) return members.filter((p) => a.assignedTo.includes(p.id));
  if (a.rotation && fam.length > 0) {
    // index = days since start
    const start = new Date(a.startDate + "T00:00:00").getTime();
    const cur = new Date(dateISO + "T00:00:00").getTime();
    const idx = Math.max(0, Math.round((cur - start) / 86400000));
    return [fam[idx % fam.length]];
  }
  return fam;
}

export function getUpcoming(
  activities: Activity[],
  members: Profile[],
  completions: { activityId: string; memberId: string; date: string }[],
  viewer: Profile,
  days = 14
): UpcomingItem[] {
  const start = todayISO();
  const out: UpcomingItem[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(start, i);
    for (const a of activities) {
      if (!occursOn(a, date)) continue;
      const assignees = assigneesFor(a, date, members);
      // visibility: parents see all; kids see only where they are assignee
      if (viewer.role === "child" && !assignees.some((p) => p.id === viewer.id)) continue;
      const doneBy = completions.filter((c) => c.activityId === a.id && c.date === date).map((c) => c.memberId);
      out.push({ activity: a, date, assignees, doneBy });
    }
  }
  out.sort((x, y) => (x.date + (x.activity.time || "99")).localeCompare(y.date + (y.activity.time || "99")));
  return out;
}

export function streakFor(memberId: string, completions: { memberId: string; date: string }[]): number {
  const days = new Set(completions.filter((c) => c.memberId === memberId).map((c) => c.date));
  let streak = 0;
  let cur = todayISO();
  // if nothing today, start from yesterday (streak still alive)
  if (!days.has(cur)) cur = addDaysISO(cur, -1);
  while (days.has(cur)) {
    streak++;
    cur = addDaysISO(cur, -1);
  }
  return streak;
}
