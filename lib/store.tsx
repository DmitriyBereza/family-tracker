"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, COLORS, Completion, Profile, Reward, ShopItem } from "./types";
import { getSupabase } from "./supabase";

interface Redemption {
  id: string;
  memberId: string;
  title: string;
  cost: number;
}

interface State {
  user: Profile | null;
  members: Profile[];
  activities: Activity[];
  completions: Completion[];
  rewards: Reward[];
  shop: ShopItem[];
  useCloud: boolean;
  login(email: string, pass: string): Promise<string | null>;
  logout(): Promise<void>;
  createAccount(email: string, pass: string, name: string): Promise<string | null>;
  addMember(email: string, pass: string, name: string, role: "parent" | "child"): Promise<string | null>;
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

// one-time cleanup of the old localStorage cache (v1/v2/v3 + spent counters)
function clearLegacyCache() {
  try {
    localStorage.removeItem("family-tracker-v1");
    localStorage.removeItem("family-tracker-v2");
    localStorage.removeItem("family-tracker-v3");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("spent_")) localStorage.removeItem(k);
    }
  } catch {}
}

// ---------- row mapping (Supabase <-> app types) ----------
const mapProfile = (r: any): Profile => ({ id: r.id, email: r.email, name: r.name, role: r.role, color: r.color || "#e8b4a6" });
const mapActivity = (r: any): Activity => ({
  id: r.id, title: r.title, notes: r.notes || "", points: r.points ?? 1,
  recurrence: r.recurrence, days: r.days || [], intervalDays: r.interval_days ?? 2,
  startDate: r.start_date, time: r.time || "", assignedTo: r.assigned_to || [],
  rotation: !!r.rotation, active: r.active !== false, createdBy: r.created_by || "",
});
const mapCompletion = (r: any): Completion => ({ activityId: r.activity_id, memberId: r.member_id, date: r.date, doneAt: r.done_at });
const mapReward = (r: any): Reward => ({ id: r.id, title: r.title, cost: r.cost });
const mapShop = (r: any): ShopItem => ({ id: r.id, title: r.title, done: !!r.done, addedBy: r.added_by || "" });

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sb: SupabaseClient | null = useMemo(() => getSupabase(), []);
  const useCloud = !!sb;

  async function loadAll(client: SupabaseClient, uid_: string) {
    const [prof, acts, comps, rew, items, red] = await Promise.all([
      client.from("profiles").select("*"),
      client.from("activities").select("*").order("created_at", { ascending: true }),
      client.from("completions").select("*"),
      client.from("rewards").select("*"),
      client.from("shopping_items").select("*").order("created_at", { ascending: true }),
      client.from("redemptions").select("*"),
    ]);
    if (prof.data) setMembers(prof.data.map(mapProfile));
    if (acts.data) setActivities(acts.data.map(mapActivity));
    if (comps.data) setCompletions(comps.data.map(mapCompletion));
    if (rew.data) setRewards(rew.data.map(mapReward));
    if (items.data) setShop(items.data.map(mapShop));
    if (red.data) setRedemptions(red.data.map((r: any) => ({ id: r.id, memberId: r.member_id, title: r.reward_title, cost: r.cost })));
    setUserId(uid_);
  }

  function clearAll() {
    setUserId(null); setMembers([]); setActivities([]);
    setCompletions([]); setRewards([]); setShop([]); setRedemptions([]);
  }

  useEffect(() => {
    clearLegacyCache();
    if (!sb) { setLoaded(true); return; }
    let unsub = () => {};
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session?.user) await loadAll(sb, data.session.user.id);
      setLoaded(true);
      const { data: listener } = sb.auth.onAuthStateChange(async (ev, session) => {
        if (session?.user) await loadAll(sb, session.user.id);
        else clearAll();
      });
      unsub = () => listener.subscription.unsubscribe();
    })();
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // realtime: any table change -> reload (multi-device live sync)
  useEffect(() => {
    if (!sb || !userId) return;
    const ch = sb.channel("fam-sync")
      .on("postgres_changes", { event: "*", schema: "public" }, () => { loadAll(sb, userId); })
      .subscribe();
    const onFocus = () => loadAll(sb, userId);
    window.addEventListener("focus", onFocus);
    return () => { sb.removeChannel(ch); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, userId]);

  const user = members.find((m) => m.id === userId) || null;
  const needConfig = !sb
    ? "Database is not configured (missing Supabase env). The app is DB-only."
    : null;

  const val: State = {
    user, members, activities, completions, rewards, shop, useCloud,

    async login(email, pass) {
      if (!sb) return needConfig;
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) return error.message;
      if (data.session?.user) await loadAll(sb, data.session.user.id);
      return null;
    },

    async logout() {
      if (sb) await sb.auth.signOut();
      clearAll();
    },

    async createAccount(email, pass, name) {
      if (!email || !pass || !name) return "Fill all fields.";
      if (!sb) return needConfig;
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pass });
      if (error) return error.message;
      const authId = data.session?.user.id || data.user?.id;
      if (!authId) return "Account created — confirm your email, then sign in.";
      const { error: pErr } = await sb.from("profiles").insert({ id: authId, email: email.trim(), name: name.trim(), role: "parent", color: COLORS[0] });
      if (pErr) return pErr.message;
      await loadAll(sb, authId);
      return null;
    },

    async addMember(email, pass, name, role) {
      if (user?.role !== "parent") return "Only parents can add members.";
      if (!email || !pass || !name) return "Fill all fields.";
      if (!sb) return needConfig;
      const { data: sess } = await sb.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return "Session expired — sign in again.";
      try {
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: email.trim(), password: pass, name: name.trim(), role }),
        });
        const j = await res.json();
        if (!res.ok) return j.error || "Could not create member.";
        setMembers((s) => [...s, mapProfile(j.profile)]);
        return null;
      } catch { return "Network error creating member."; }
    },

    removeMember(id) {
      if (!sb || user?.role !== "parent") return;
      setMembers((s) => s.filter((m) => m.id !== id));
      const touched = activities.filter((a) => a.assignedTo.includes(id)).map((a) => ({ ...a, assignedTo: a.assignedTo.filter((x) => x !== id) }));
      setActivities((s) => s.map((a) => (a.assignedTo.includes(id) ? { ...a, assignedTo: a.assignedTo.filter((x) => x !== id) } : a)));
      (async () => {
        const { data: sess } = await sb.auth.getSession();
        const token = sess.session?.access_token;
        if (token) await fetch(`/api/members?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        for (const a of touched) await sb.from("activities").update({ assigned_to: a.assignedTo }).eq("id", a.id);
      })();
    },

    saveActivity(a) {
      if (!sb) return;
      setActivities((s) => (s.some((x) => x.id === a.id) ? s.map((x) => (x.id === a.id ? a : x)) : [...s, a]));
      const row = {
        title: a.title, notes: a.notes || "", points: a.points, recurrence: a.recurrence,
        days: a.days || [], interval_days: a.intervalDays || 2, start_date: a.startDate,
        time: a.time || "", assigned_to: a.assignedTo, rotation: !!a.rotation,
        active: a.active, created_by: user?.id || null,
      };
      (async () => {
        const isNew = !activities.some((x) => x.id === a.id);
        if (isNew) {
          const { data, error } = await sb.from("activities").insert(row).select().single();
          if (!error && data) setActivities((s) => s.map((x) => (x.id === a.id ? mapActivity(data) : x)));
        } else {
          await sb.from("activities").update(row).eq("id", a.id);
        }
      })();
    },

    deleteActivity(id) {
      if (!sb) return;
      setActivities((s) => s.filter((a) => a.id !== id));
      void sb.from("activities").delete().eq("id", id);
    },

    toggleDone(activityId, memberId, date) {
      if (!sb) return;
      const exists = completions.some((c) => c.activityId === activityId && c.memberId === memberId && c.date === date);
      setCompletions((s) => (exists
        ? s.filter((c) => !(c.activityId === activityId && c.memberId === memberId && c.date === date))
        : [...s, { activityId, memberId, date, doneAt: new Date().toISOString() }]));
      (async () => {
        if (exists) await sb.from("completions").delete().match({ activity_id: activityId, member_id: memberId, date });
        else await sb.from("completions").insert({ activity_id: activityId, member_id: memberId, date });
      })();
    },

    addReward(title, cost) {
      if (!sb || !title.trim()) return;
      (async () => {
        const { data, error } = await sb.from("rewards").insert({ title: title.trim(), cost: cost || 5 }).select().single();
        if (!error && data) setRewards((s) => [...s, mapReward(data)]);
      })();
    },

    deleteReward(id) {
      if (!sb) return;
      setRewards((s) => s.filter((r) => r.id !== id));
      void sb.from("rewards").delete().eq("id", id);
    },

    addShop(title) {
      if (!sb || !title.trim() || !user) return;
      const by = user.id;
      (async () => {
        const { data, error } = await sb.from("shopping_items").insert({ title: title.trim(), done: false, added_by: by }).select().single();
        if (!error && data) setShop((s) => [...s, mapShop(data)]);
      })();
    },

    toggleShop(id) {
      if (!sb) return;
      const cur = shop.find((x) => x.id === id);
      setShop((s) => s.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
      if (cur) void sb.from("shopping_items").update({ done: !cur.done }).eq("id", id);
    },

    clearShop() {
      if (!sb) return;
      const doneIds = shop.filter((x) => x.done).map((x) => x.id);
      setShop((s) => s.filter((x) => !x.done));
      if (doneIds.length) void sb.from("shopping_items").delete().in("id", doneIds);
    },

    redeem(rewardId) {
      if (!sb) return needConfig;
      if (!user) return "Login first.";
      const r = rewards.find((x) => x.id === rewardId);
      if (!r) return "Reward gone.";
      const earned = completions.filter((c) => c.memberId === user.id).reduce((sum, c) => {
        const a = activities.find((x) => x.id === c.activityId);
        return sum + (a?.points || 0);
      }, 0);
      const spent = redemptions.filter((x) => x.memberId === user.id).reduce((s, x) => s + x.cost, 0);
      if (earned - spent < r.cost) return `Need ${r.cost} pts (you have ${earned - spent}).`;
      const mid = user.id, title = r.title, cost = r.cost;
      (async () => {
        const { data, error } = await sb.from("redemptions").insert({ member_id: mid, reward_title: title, cost }).select().single();
        if (!error && data) setRedemptions((s) => [...s, { id: data.id, memberId: data.member_id, title: data.reward_title, cost: data.cost }]);
      })();
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
