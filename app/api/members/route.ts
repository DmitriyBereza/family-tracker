import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/members — parent creates a child (or second parent) login.
// Uses the service_role key (server only) so the parent stays signed in.
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    return NextResponse.json({ error: "Supabase not configured on server." }, { status: 500 });
  }
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

  const caller = createClient(url, anon);
  const { data: callerUser, error: callerErr } = await caller.auth.getUser(token);
  if (callerErr || !callerUser.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { data: callerProfile } = await caller.from("profiles").select("role").eq("id", callerUser.user.id).single();
  // RLS hides other rows; use admin client to check role reliably
  const admin = createClient(url, service);
  const { data: roleRow } = await admin.from("profiles").select("role").eq("id", callerUser.user.id).single();
  void callerProfile;
  if (roleRow?.role !== "parent") return NextResponse.json({ error: "Only parents can add members." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { email, password, name, role } = body as { email?: string; password?: string; name?: string; role?: string };
  if (!email || !password || !name) return NextResponse.json({ error: "Fill all fields." }, { status: 400 });
  if (role !== "parent" && role !== "child") return NextResponse.json({ error: "Bad role." }, { status: 400 });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: String(email).trim(), password: String(password), email_confirm: true,
    user_metadata: { name: String(name).trim() },
  });
  if (createErr || !created.user) return NextResponse.json({ error: createErr?.message || "Could not create login." }, { status: 400 });

  const colors = ["#e8b4a6", "#bcd7e6", "#ecd9ac", "#cfc3e8", "#c3e8c8", "#e8c3d8"];
  const { data: profile, error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    email: String(email).trim(),
    name: String(name).trim(),
    role,
    color: colors[Math.floor(Math.random() * colors.length)],
  }).select().single();
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: pErr.message }, { status: 400 });
  }
  return NextResponse.json({ profile });
}

// DELETE /api/members?id= — parent removes a member (auth user + profile cascade).
export async function DELETE(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    return NextResponse.json({ error: "Supabase not configured on server." }, { status: 500 });
  }
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

  const caller = createClient(url, anon);
  const { data: callerUser, error: callerErr } = await caller.auth.getUser(token);
  if (callerErr || !callerUser.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const admin = createClient(url, service);
  const { data: roleRow } = await admin.from("profiles").select("role").eq("id", callerUser.user.id).single();
  if (roleRow?.role !== "parent") return NextResponse.json({ error: "Only parents can remove members." }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  if (id === callerUser.user.id) return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
