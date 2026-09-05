"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Activity, todayISO, uid, addDaysISO, DAY_NAMES } from "@/lib/types";
import { getUpcoming, assigneesFor, occursOn, streakFor } from "@/lib/recurrence";

type View = "today" | "agenda" | "family" | "lists";

const BAR = ["#c05f3c", "#4f7d7a", "#c08a2d", "#7d8f6f", "#8a6fb8"];

function fmtTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

export default function Home() {
  const s = useStore();
  const [view, setView] = useState<View>("today");
  const [menuOpen, setMenuOpen] = useState(false);
  const todayCount = useMemo(
    () => (s.user ? getUpcoming(s.activities, s.members, s.completions, s.user, 1).length : 0),
    [s.activities, s.members, s.completions, s.user]
  );
  if (!s.user) return <AuthScreen />;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">⌂</div>
          <div><b>nest &amp; now</b><span>THE HART HOUSEHOLD</span></div>
        </div>
        <nav className="nav">
          <button className={view === "today" ? "on" : ""} onClick={() => setView("today")}>📅 Today <span className="count">{todayCount}</span></button>
          <button className={view === "agenda" ? "on" : ""} onClick={() => setView("agenda")}>🕐 Agenda</button>
          <button className={view === "family" ? "on" : ""} onClick={() => setView("family")}>⚘ Family</button>
          <button className={view === "lists" ? "on" : ""} onClick={() => setView("lists")}>🧺 Shared lists</button>
        </nav>
        <div style={{ marginTop: "auto", fontSize: 12, color: "#8d897d", display: "flex", flexDirection: "column", gap: 4 }}>
          <span title="Shared via Supabase (all devices)">☁️ shared</span>
          <button className="link" onClick={() => void s.logout()}>Logout ({s.user.name})</button>
        </div>
      </aside>
      <div className="main">
        <div className="top">
          <div>
            <div className="eyebrow">{greeting()}, {s.user.name.toUpperCase()}</div>
            <div className="h1">Here&apos;s what&apos;s next.</div>
          </div>
          <div style={{ position: "relative" }}>
            <button className="account" style={{ cursor: "pointer" }} onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
              <span className="avatar" style={{ background: s.user.color }}>{s.user.name[0]}</span>
              <span>Account ▾</span>
            </button>
            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
                <div className="menu" role="menu">
                  <div className="menu-head"><b>{s.user.name}</b><span>{s.user.email} • {s.user.role}</span></div>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); void s.logout(); }}>Logout</button>
                </div>
              </>
            )}
          </div>
        </div>
        {view === "today" && <TodayView go={(v) => setView(v)} />}
        {view === "agenda" && <AgendaView />}
        {view === "family" && <FamilyView />}
        {view === "lists" && <ListsView />}
      </div>
    </div>
  );
}

function AuthScreen() {
  const s = useStore();
  const [mode, setMode] = useState<"login" | "create">("login");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [name, setName] = useState(""); const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string | null>) => { setBusy(true); setErr(await fn()); setBusy(false); };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><div className="brand-mark">⌂</div><div><b>nest &amp; now</b><span>THE HART HOUSEHOLD</span></div></div>
        {!s.useCloud && <p style={{ color: "#a94e2f" }}>Database is not configured — the app is DB-only.</p>}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button className="ghost small" style={mode === "login" ? { borderColor: "#4a5240", fontWeight: 800 } : undefined} onClick={() => { setMode("login"); setErr(null); }}>Sign in</button>
          <button className="ghost small" style={mode === "create" ? { borderColor: "#4a5240", fontWeight: 800 } : undefined} onClick={() => { setMode("create"); setErr(null); }}>Create parent</button>
        </div>
        {mode === "create" && <input placeholder="your name" value={name} onChange={(e) => setName(e.target.value)} />}
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        {err && <p style={{ color: "#a94e2f" }}>{err}</p>}
        {mode === "login"
          ? <button className="btn-accent" style={{ width: "100%" }} disabled={busy} onClick={() => void run(() => s.login(email, pass))}>Sign in</button>
          : <><button className="btn-accent" style={{ width: "100%" }} disabled={busy} onClick={() => void run(() => s.createAccount(email, pass, name))}>Create parent account</button>
            <p style={{ color: "#8d897d", fontSize: 12 }}>First setup only — afterwards family signs in, and parents add kids via Family.</p></>}
      </div>
    </div>
  );
}

function TodayView({ go }: { go(v: View): void }) {
  const s = useStore();
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const t = todayISO();
  const all = useMemo(() => getUpcoming(s.activities, s.members, s.completions, s.user!, 1), [s.activities, s.members, s.completions, s.user]);
  const items = filter === "all" ? all : all.filter((i) => i.assignees.some((p) => p.id === filter));
  const doneCount = all.filter((i) => i.doneBy.length >= i.assignees.length && i.assignees.length > 0).length;
  const total = all.length;
  const openBy = (id: string) => all.filter((i) => i.assignees.some((p) => p.id === id) && !i.doneBy.includes(id)).length;

  return (
    <>
      <div className="date-row">
        <div>
          <div className="d"><i />{prettyDate(t)}</div>
          <div className="sub">A gentle view of the moving pieces. You have <b style={{ color: "#2e2c26" }}>{items.length} things</b> to tend to before dinner.</div>
        </div>
        {s.user!.role === "parent" && <button className="btn-accent" onClick={() => setShowAdd(true)}>＋ Add activity</button>}
      </div>

      <div className="chips">
        <span className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
          <span className="avatar" style={{ background: "#eef3e4" }}>All</span> Everyone
        </span>
        {s.members.map((m) => (
          <span key={m.id} className={"chip" + (filter === m.id ? " on" : "")} onClick={() => setFilter(m.id)}>
            <span className="avatar" style={{ background: m.color }}>{m.name[0]}</span> {m.name}
          </span>
        ))}
        <button className="link" onClick={() => go("family")}>⚘ Manage family</button>
      </div>

      <div className="content">
        <div>
          <div className="sect">Today in the household <button className="link" onClick={() => go("agenda")}>Full agenda ›</button></div>
          {items.length === 0 && <p style={{ color: "#8d897d" }}>Nothing for this filter today. Enjoy the calm.</p>}
          {items.map(({ activity: a, assignees, doneBy }, idx) => {
            const vis = a.assignedTo.length === 0 ? "Everyone" : assignees.length === 1 ? `${assignees[0].name} only` : assignees.map((p) => p.name).join(" & ") + " only";
            const recTag = a.recurrence === "weekly" ? "Every weekday" : a.recurrence === "daily" ? "Daily" : a.recurrence === "interval" ? `Every ${a.intervalDays || 2} days` : null;
            return (
              <div key={a.id + idx} className="task-card">
                <div className="time">{a.time ? <>{fmtTime(a.time)}<span>Today</span></> : <span>After dinner<br />Today</span>}</div>
                <div className="bar" style={{ background: BAR[idx % BAR.length] }} />
                <div className="task-body">
                  <h4>{a.title} {idx === 0 && <span className="tag next">NEXT UP</span>} {recTag && <span className="tag rec">↻ {recTag}</span>}</h4>
                  <div className="task-sub">{a.notes}</div>
                  <div className="meta">
                    {assignees.slice(0, 1).map((p) => (
                      <span key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className="avatar" style={{ background: p.color, width: 22, height: 22, fontSize: 11 }}>{p.name[0]}</span> {p.name}
                      </span>
                    ))}
                    <span>👁 {vis}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {assignees.map((p) => {
                    const done = doneBy.includes(p.id);
                    const can = s.user!.role === "parent" || p.id === s.user!.id;
                    return <button key={p.id} title={p.name} disabled={!can} className={"check" + (done ? " done" : "")} onClick={() => s.toggleDone(a.id, p.id, t)}>{done ? "✓" : ""}</button>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <div className="panel">
            <h4>Household rhythm <span>✨</span></h4>
            <div><span className="big">{doneCount} of {total}</span> <span style={{ float: "right", fontSize: 12, color: "#6b675c", marginTop: 12 }}>routines done</span></div>
            <div className="progress"><i style={{ width: total ? `${Math.round((doneCount / total) * 100)}%` : "0%" }} /></div>
            <div style={{ fontSize: 12, color: "#6b675c" }}>A little momentum goes a long way. {items.find((i) => i.doneBy.length === 0)?.assignees[0]?.name || "Everyone"} has the next routine.</div>
          </div>
          <div className="panel white">
            <h4>Family at a glance <button className="link" onClick={() => go("family")}>⚘</button></h4>
            {s.members.map((m) => (
              <div key={m.id} className="fam-row">
                <span className="avatar" style={{ background: m.color }}>{m.name[0]}</span>
                <div style={{ flex: 1 }}><b>{m.name}</b><div style={{ fontSize: 12, color: "#8d897d" }}>{openBy(m.id)} open items • 🔥 {streakFor(m.id, s.completions)}d</div></div>
                <span style={{ color: "#c9c3b2" }}>›</span>
              </div>
            ))}
          </div>
          <div className="note">ⓘ &nbsp;Visibility is set per activity. Kids only see what helps them know what&apos;s next.</div>
        </div>
      </div>
      {showAdd && <ActivityModal onClose={() => setShowAdd(false)} />}
    </>
  );
}

function AgendaView() {
  const s = useStore();
  const days = useMemo(() => { const t = todayISO(); return Array.from({ length: 7 }, (_, i) => addDaysISO(t, i)); }, []);
  return (
    <div>
      <div className="sect">Full agenda — next 7 days</div>
      {days.map((d) => {
        const items = s.activities.filter((a) => occursOn(a, d))
          .filter((a) => s.user!.role === "parent" || assigneesFor(a, d, s.members).some((p) => p.id === s.user!.id));
        return (
          <div key={d} className="task-card">
            <div className="time">{d.slice(5)}<span>{DAY_NAMES[new Date(d + "T00:00:00").getDay()]}{d === todayISO() ? " • Today" : ""}</span></div>
            <div className="task-body">
              {items.length === 0 && <div className="task-sub">— calm day —</div>}
              {items.map((a) => (
                <div key={a.id} style={{ fontSize: 13, marginBottom: 4 }}>• {a.time ? fmtTime(a.time) + " · " : ""}<b>{a.title}</b> <span style={{ color: "#8d897d" }}>({assigneesFor(a, d, s.members).map((p) => p.name).join(", ")})</span></div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FamilyView() {
  const s = useStore();
  const isParent = s.user!.role === "parent";
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [name, setName] = useState(""); const [role, setRole] = useState<"parent" | "child">("child");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <div className="sect">Family</div>
      {s.members.map((m) => (
        <div key={m.id} className="task-card">
          <span className="avatar" style={{ background: m.color, width: 34, height: 34 }}>{m.name[0]}</span>
          <div className="task-body"><h4>{m.name} <span className="tag rec">{m.role}</span></h4>
            <div className="task-sub">{m.email} • 🔥 {streakFor(m.id, s.completions)}d streak</div></div>
          {isParent && m.id !== s.user!.id && <button className="danger small" onClick={() => s.removeMember(m.id)}>Remove</button>}
        </div>
      ))}
      {isParent ? (
        <div className="task-card"><div className="task-body">
          <h4>Define new user</h4>
          <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="email (login)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value as "parent" | "child")}>
            <option value="child">child (sees own only)</option><option value="parent">parent (sees all)</option>
          </select>
          {err && <p style={{ color: "#a94e2f" }}>{err}</p>}
          <button className="btn-accent" onClick={async () => { const e = await s.addMember(email, pass, name, role); setErr(e); if (!e) { setEmail(""); setPass(""); setName(""); } }}>Add member</button>
        </div></div>
      ) : <p style={{ color: "#8d897d" }}>Kids view — parents manage family here.</p>}
    </div>
  );
}

function ListsView() {
  const s = useStore();
  const [item, setItem] = useState(""); const [rt, setRt] = useState(""); const [rc, setRc] = useState(10);
  const [msg, setMsg] = useState<string | null>(null);
  const isParent = s.user!.role === "parent";
  return (
    <div className="content" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="panel white">
        <h4>🧺 Shared shopping list</h4>
        <div style={{ display: "flex", gap: 8 }}><input placeholder="add item…" value={item} onChange={(e) => setItem(e.target.value)} />
          <button className="btn-accent" onClick={() => { s.addShop(item); setItem(""); }}>Add</button></div>
        {s.shop.map((x) => (
          <div key={x.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e9e2d3" }}>
            <span style={{ textDecoration: x.done ? "line-through" : "none" }}>{x.title}</span>
            <button className="ghost small" onClick={() => s.toggleShop(x.id)}>{x.done ? "undo" : "got it"}</button>
          </div>
        ))}
        <button className="link" onClick={s.clearShop}>Clear done</button>
      </div>
      <div className="panel white">
        <h4>🎁 Rewards</h4>
        {s.rewards.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e9e2d3" }}>
            <span><b>{r.title}</b> <span className="tag rec">{r.cost} pts</span></span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="ghost small" onClick={() => setMsg(s.redeem(r.id) || `Redeemed: ${r.title}! 🎉`)}>Redeem</button>
              {isParent && <button className="danger small" onClick={() => s.deleteReward(r.id)}>x</button>}
            </span>
          </div>
        ))}
        {isParent && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><input placeholder="new reward" value={rt} onChange={(e) => setRt(e.target.value)} />
          <input type="number" style={{ maxWidth: 80 }} value={rc} onChange={(e) => setRc(Number(e.target.value))} />
          <button className="ghost small" onClick={() => { s.addReward(rt, rc); setRt(""); }}>Add</button></div>}
        {msg && <p style={{ color: "#8d897d", fontSize: 13 }}>{msg}</p>}
      </div>
    </div>
  );
}

function ActivityModal({ onClose }: { onClose(): void }) {
  const s = useStore();
  const [f, setF] = useState<Activity>({ id: uid("a"), title: "", notes: "", points: 2, recurrence: "weekly", days: [1, 2, 3, 4, 5], intervalDays: 2, startDate: todayISO(), time: "", assignedTo: [], rotation: false, active: true, createdBy: s.user!.id });
  const set = (p: Partial<Activity>) => setF((x) => ({ ...x, ...p }));
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Add activity</h3>
        <input placeholder="e.g. School pickup" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        <input placeholder="details — place, note…" value={f.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={f.recurrence} onChange={(e) => set({ recurrence: e.target.value as Activity["recurrence"] })}>
            <option value="once">once</option><option value="daily">daily</option><option value="weekly">weekly</option><option value="interval">every N days</option>
          </select>
          <input type="time" value={f.time || ""} onChange={(e) => set({ time: e.target.value })} />
          <input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </div>
        {f.recurrence === "weekly" && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {DAY_NAMES.map((d, i) => (
              <span key={i} className="chip" style={(f.days || []).includes(i) ? { background: "#4a5240", color: "#fff" } : undefined}
                onClick={() => set({ days: (f.days || []).includes(i) ? (f.days || []).filter((x) => x !== i) : [...(f.days || []), i] })}>{d}</span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 13, color: "#8d897d" }}>Visible to (empty = everyone):</div>
        <div className="chips">
          {s.members.map((m) => (
            <span key={m.id} className="chip" style={f.assignedTo.includes(m.id) ? { background: "#4a5240", color: "#fff" } : undefined}
              onClick={() => set({ assignedTo: f.assignedTo.includes(m.id) ? f.assignedTo.filter((x) => x !== m.id) : [...f.assignedTo, m.id] })}>{m.name}</span>
          ))}
        </div>
        <label style={{ fontSize: 13 }}><input type="checkbox" style={{ width: "auto" }} checked={!!f.rotation} onChange={(e) => set({ rotation: e.target.checked })} /> rotation</label>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn-accent" disabled={!f.title} onClick={() => { s.saveActivity(f); onClose(); }}>Save</button>
          <button className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
