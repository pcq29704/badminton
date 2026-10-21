# Court Balancer

Next.js App Router with React screens for the organiser app and player profiles.
The existing Supabase database, game RPCs, and player-profile Edge Function
remain the backend.

## Local development

```sh
npm install
npm run dev
```

Open http://localhost:3000 for player sign-in. The organiser app uses
`/organiser`, and player profiles use `/profile.html?u=<username>`.
Without development credentials, these routes show
a configuration message and make no Supabase requests.

When the local development project is available:

```sh
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the
development project's values, then restart the dev server. `.env.local` is
ignored by Git. Use only the public publishable key, never a service-role key.

Do not use the production project's credentials for local development or
testing. The app reads Supabase configuration only from environment variables;
the old production `config.js` has been removed.

Testing is deferred until development credentials are supplied. Deployment to
Vercel will be handled later.

## Code structure

- `src/app`: Next.js routes and shared document layout. `/index.html` redirects to `/`.
  `globals.css` contains the existing shared theme.
- `src/features/court-balancer`: React organiser screens, session loading,
  matching, history, and command controller. Commands publish detached React
  snapshots and fill courts sequentially. Timers and auth subscriptions are
  cleaned up on unmount.
- `src/features/player-profile`: React profile view, player login, edits,
  image uploads, and history. Players stay signed in for 30 days through the
  `player_session` cookie (see Player profile API).
- `src/lib/supabase/client.ts`: Lazy browser client configured only through
  environment variables.
- `supabase/`: Edge functions, `migrations/` (applied in filename order), and `seed.sql` sample data.
- `scripts/db.mjs`: runs `npm run db:migrate` and `npm run db:seed` against the shared dev database.
  by the Next.js conversion.

`tests/fixtures/legacy` retains the pre-migration scripts and profile markup
used by existing baseline tests. These fixtures are not served or loaded by
Next.js. Those baseline tests do not verify the React implementation; React
regression checks remain deferred until the development setup is available.

## Database (shared dev project)

1. Copy `.env.example` to `.env.local` and fill in the values. `DATABASE_URL` is only needed for the two commands below. `SUPABASE_SERVICE_ROLE_KEY` is needed for player profile login and uploads.
2. `npm run db:migrate` applies every file in `supabase/migrations/` that the dev database has not run yet. Safe to repeat.
3. `npm run db:seed` loads sample tiers, settings and players from `supabase/seed.sql`. Safe to repeat.

To change the schema, add a new file to `supabase/migrations/` named `<YYYYMMDDHHMMSS>_<what_it_does>.sql`, then run `npm run db:migrate`. Never edit a migration that has already been applied.

## Player profile API

Profile login, edits and image uploads go through `POST /api/player` (`src/app/api/player/route.ts`), a Next.js route
handler that runs on the server with `SUPABASE_SERVICE_ROLE_KEY`. It replaces the old Supabase Edge Function, so there
is nothing to deploy to Supabase. Errors are logged to the `npm run dev` terminal with the prefix `[player-api]`.
Plan: `docs/plans/2026-10-17-player-api-route-handler.md`.

Sign-in uses an `httpOnly` cookie named `player_session` (30 days, `SameSite=Lax`). The server stores only a SHA-256
hash of the token in `player_sessions`. Refreshing the page keeps the player signed in. Sign out clears the cookie and
deletes that session only, so other devices stay signed in. Profile edits and image uploads no longer send the password.
Plan: `docs/plans/2026-10-17-player-session-cookie.md`.
