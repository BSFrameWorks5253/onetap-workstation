# One Tap Safar Tracker

Mobile-first PWA for tracking Safar date folders through rendering, editing, upload, and AlJamea submission. It syncs only Safar names, date-folder names, stage, due date, Hijri date, and update time.

## Run locally

1. Install dependencies in this folder with `npm install`.
2. The PWA uses the same Supabase project as One Tap by default. Copy `.env.example` to `.env.local` only when you need to override it.
3. Run `npm run dev` and open the printed local address.
4. Run the SQL in `supabase/schema.sql` once in the connected Supabase project.

The production site must be served over HTTPS for PWA installation and browser notifications. `public/sw.js` caches the app shell for offline viewing. Browser notifications work while the PWA is open; delivery while the PWA is fully closed requires a Web Push provider and VAPID keys.

The desktop sends a sanitized snapshot on scan, at startup, every ten minutes, and on a website sync request. Live broadcasts work across locations. Run the SQL migration once to enable durable snapshot history and shared task edits; without it, the PWA still receives live snapshots while both devices are online and keeps its own last snapshot locally.
