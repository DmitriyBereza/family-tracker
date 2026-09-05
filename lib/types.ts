export type Role = "parent" | "child";
export type Recurrence = "once" | "daily" | "weekly" | "interval";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  color: string;
  pass: string; // base64 demo only; Supabase Auth when configured
}

export interface Activity {
  id: string;
  title: string;
  notes?: string;
  points: number;
  recurrence: Recurrence;
  days?: number[]; // 0=Sun..6=Sat for weekly
  intervalDays?: number; // for interval
  startDate: string; // yyyy-mm-dd
  time?: string; // HH:MM
  assignedTo: string[]; // [] = everyone
  rotation?: boolean;
  active: boolean;
  createdBy: string;
}

export interface Completion {
  activityId: string;
  memberId: string;
  date: string; // yyyy-mm-dd (due date)
  doneAt: string; // ISO
}

export interface Reward {
  id: string;
  title: string;
  cost: number;
}

export interface ShopItem {
  id: string;
  title: string;
  done: boolean;
  addedBy: string;
}

export interface UpcomingItem {
  activity: Activity;
  date: string; // yyyy-mm-dd
  assignees: Profile[];
  doneBy: string[]; // memberIds completed for that date
}

export const COLORS = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#60a5fa"];
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDaysISO(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
