# Family Tracker — web app for your own family
Next.js 14 (App Router) + Supabase (optional, localStorage fallback so it runs without config).

## Run (new separate project)
```bash
npm install
npm run dev
# open http://localhost:3001
```

Login: first run → "Create parent account". Then Parents → Members → "Add member"
(kids get login + password, role child = sees only own tasks).

## Features (from research of Cozi, OurHome, Homsy, S'moresUp, Skylight, ChoreSplit)
- login/pass auth (Supabase Auth when env set, local accounts otherwise)
- family members with roles: parent (sees all, manages) / child (sees only own)
- recurrent activities: once / daily / weekly (picked weekdays) / every-N-days + optional rotation
- visibility per person: assign to Everyone or specific members; parents always see all
- Up Next: closest tasks (today + next 7/14 days), overdue highlight
- extras: points + streaks + leaderboard, week calendar, rewards shop, shared shopping list
- works on web (phone/tablet/desktop), deploy to Vercel

## Sharing data between devices (Supabase)
Yes — Supabase is exactly that: cloud auth + Postgres + realtime, so every
phone/tablet/laptop sees the same family live. Without it the app is
localStorage-only (one browser).

1. Create a free project at supabase.com
2. SQL editor → run `supabase/schema.sql` (profiles, activities, completions,
   rewards, shopping_items, redemptions + RLS policies)
3. Authentication → Providers → Email: ON; **turn OFF "Confirm email"**
   (family logins should work immediately)
4. Project Settings → API: copy URL, `anon` key, `service_role` key
5. Copy `.env.example` to `.env.local`, fill all three values
   (`SUPABASE_SERVICE_ROLE_KEY` is server-only — never `NEXT_PUBLIC_`)
6. Restart dev. Sidebar shows ☁️ shared (Supabase) vs 💾 this device
   (localStorage); check-offs sync across devices live.
   Parents add kid logins via Family tab (server route creates the auth user,
   parent stays signed in).

Deploy (Vercel): set the same three env vars in project settings.

## Data model
- `profiles`: id, email, name, role, color
- `activities`: title, recurrence, days/interval, start_date, time, assigned_to[], points, rotation
- `completions`: activity_id + member_id + date
- `rewards`, `shopping_items`, `redemptions` (points spent, shared)
