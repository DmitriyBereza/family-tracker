"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Activity, COLORS, Completion, Profile, Reward, ShopItem, todayISO, uid } from "./types";
import { getSupabase } from "./supabase";

interface State {
  user: Profile | null;
  members: Profile[];
  activities: Activity[];
  completions: Completion[];
  rewards: Reward[];
  shop: ShopItem[];
  useCloud: boolean;
  login(email: string, pass: string): string | null;
  logout(): void;
  createAccount(email: string, pass: string, name: string): string | null;
  addMember(email: string, pass: string, name: string, role: "parent" | "child"): string | null;
  removeMember(id: string): void;
  saveActivity(a: Activity): void;
  deleteActivity(id: string): void;
  toggleDone(activityId: string, memberId: string, date: string): void;
  addReward(title: string, cost: number): void;
  deleteReward(id: string): void;
  addShop(title: string): void;
  toggleShop(id: string): void;
  clearShop(): void;
  redeem(rewardId: string): string | null;
}

const Ctx = createContext<State | null>(null);
const KEY = "family-tracker-v3";

function seed(): { members: Profile[]; activities: Activity[]; completions: Completion[]; rewards: Reward[]; shop: ShopItem[] } {
  const dima: Profile = { id: uid("u"), email: "dima@home.com", name: "Dima", role: "parent", color: "#e8b4a6", pass: btoa("homechores123") };
  return {
    members: [dima],
    activities: [],
    completions: [],
    rewards: [],
    shop: [],
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sb = useMemo(() => getSupabase(), []);
  const useCloud = !!sb;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setMembers(d.members || []); setActivities(d.activities || []);
        setCompletions(d.completions || []); setRewards(d.rewards || []);
        setShop(d.shop || []); setUserId(d.userId || null);
      } else {
        const s = seed();
        setMembers(s.members); setActivities(s.activities);
        setCompletions(s.completions); setRewards(s.rewards); setShop(s.shop);
      }
    } catch { const s = seed(); setMembers(s.members); setActivities(s.activities); setRewards(s.rewards); setShop(s.shop); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify({ members, activities, completions, rewards, shop, userId })); } catch {}
  }, [members, activities, completions, rewards, shop, userId, loaded]);

  const user = members.find((m) => m.id === userId) || null;

  const val: State = {
    user, members, activities, completions, rewards, shop, useCloud,
    login(email, pass) {
      const m = members.find((x) => x.email.toLowerCase() === email.toLowerCase().trim());
      if (!m) return "No such user. Create a parent account first.";
      if (m.pass !== btoa(pass)) return "Wrong password.";
      setUserId(m.id);
      return null;
    },
    logout() { setUserId(null); },
    createAccount(email, pass, name) {
      if (members.length > 0) return "Family already exists — ask a parent to add you (Members tab).";
      if (!email || !pass || !name) return "Fill all fields.";
      const p: Profile = { id: uid("u"), email: email.trim(), name: name.trim(), role: "parent", color: COLORS[0], pass: btoa(pass) };
      setMembers([p]); setUserId(p.id);
      return null;
    },
    addMember(email, pass, name, role) {
      if (user?.role !== "parent") return "Only parents can add members.";
      if (members.some((x) => x.email.toLowerCase() === email.toLowerCase().trim())) return "Email already used.";
      const p: Profile = { id: uid("u"), email: email.trim(), name: name.trim(), role, color: COLORS[members.length % COLORS.length], pass: btoa(pass) };
      setMembers((s) => [...s, p]);
      return null;
    },
    removeMember(id) {
      if (user?.role !== "parent") return;
      setMembers((s) => s.filter((m) => m.id !== id));
      setActivities((s) => s.map((a) => ({ ...a, assignedTo: a.assignedTo.filter((x) => x !== id) })));
    },
    saveActivity(a) {
      setActivities((s) => (s.some((x) => x.id === a.id) ? s.map((x) => (x.id === a.id ? a : x)) : [...s, a]));
    },
    deleteActivity(id) { setActivities((s) => s.filter((a) => a.id !== id)); },
    toggleDone(activityId, memberId, date) {
      setCompletions((s) => {
        const i = s.findIndex((c) => c.activityId === activityId && c.memberId === memberId && c.date === date);
        if (i >= 0) { const n = [...s]; n.splice(i, 1); return n; }
        return [...s, { activityId, memberId, date, doneAt: new Date().toISOString() }];
      });
    },
    addReward(title, cost) { if (title) setRewards((s) => [...s, { id: uid("r"), title: title.trim(), cost: cost || 5 }]); },
    deleteReward(id) { setRewards((s) => s.filter((r) => r.id !== id)); },
    addShop(title) { if (title.trim() && user) setShop((s) => [...s, { id: uid("s"), title: title.trim(), done: false, addedBy: user.id }]); },
    toggleShop(id) { setShop((s) => s.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); },
    clearShop() { setShop((s) => s.filter((x) => !x.done)); },
    redeem(rewardId) {
      if (!user) return "Login first.";
      const r = rewards.find((x) => x.id === rewardId);
      if (!r) return "Reward gone.";
      const pts = completions.filter((c) => c.memberId === user.id).reduce((sum, c) => {
        const a = activities.find((x) => x.id === c.activityId);
        return sum + (a?.points || 0);
      }, 0);
      const spentKey = `spent_${user.id}`;
      const spent = Number(localStorage.getItem(spentKey) || 0);
      if (pts - spent < r.cost) return `Need ${r.cost} pts (you have ${pts - spent}).`;
      localStorage.setItem(spentKey, String(spent + r.cost));
      return null;
    },
  };
  if (!loaded) return null;
  return <Ctx.Provider value={val}>{children}</Ctx.Provider>;
}

export function useStore(): State {
  const v = useContext(Ctx);
  if (!v) throw new Error("store missing");
  return v;
}
