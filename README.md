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
  image uploads, and history. Player passwords remain in page memory only.
- `src/lib/supabase/client.ts`: Lazy browser client configured only through
  environment variables.
- `supabase/` and `migrations/`: Existing backend functions and SQL; unchanged
  by the Next.js conversion.

`tests/fixtures/legacy` retains the pre-migration scripts and profile markup
used by existing baseline tests. These fixtures are not served or loaded by
Next.js. Those baseline tests do not verify the React implementation; React
regression checks remain deferred until the development setup is available.
