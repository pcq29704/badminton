# Court Balancer

Next.js App Router with React screens for the organiser app and player profiles.
The existing Supabase database, game RPCs, and player-profile Edge Function
remain the backend.

## Local development

```sh
npm install
npm run dev
```

Open http://localhost:3000 for the organiser app. Player profiles use
`/profile.html?u=<username>`. Without development credentials, both routes show
a configuration message and make no Supabase requests.

When the local development project is available:

```sh
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the
development project's values, then restart the dev server. `.env.local` is
ignored by Git. Use only the public publishable key, never a service-role key.

The credentials in legacy `config.js` are production credentials. The Next.js
setup does not load that file. Do not copy those values into `.env.local` or
use the production project for development or testing.

Testing is deferred until development credentials are supplied. Deployment to
Vercel will be handled later.

## Code structure

- `src/app`: Next.js routes and shared document layout. `/index.html` redirects to `/`.
- `src/features/court-balancer`: React organiser screens, session loading,
  matching, history, and command controller. Commands publish detached React
  snapshots and fill courts sequentially. Timers and auth subscriptions are
  cleaned up on unmount.
- `src/features/player-profile`: React profile view, player login, edits,
  image uploads, and history. Player passwords remain in page memory only.
- `src/lib/supabase/client.ts`: Lazy browser client configured only through
  environment variables.
- `supabase/` and `migrations/`: Existing backend functions and SQL; unchanged
  by the Next.js conversion.

The root static HTML/JavaScript files remain as migration references for the
deferred regression checks. Next.js does not serve or load them. Existing
source-based tests still refer to those files and need to be retargeted before
they can verify the React implementation.
