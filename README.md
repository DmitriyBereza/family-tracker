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

## Supabase (optional, for real multi-device sync)
1. Create free project at supabase.com
2. Run `supabase/schema.sql` in SQL editor
3. Copy `.env.example` to `.env.local`, fill URL + ANON_KEY
4. Restart dev. Without env → localStorage mode (single browser, good for demo).

## Data model
- `profiles`: id, email, name, role, color
- `activities`: title, recurrence, days/interval, start_date, time, assigned_to[], points, rotation
- `completions`: activity_id + member_id + date
- `rewards`, `shopping_items`
