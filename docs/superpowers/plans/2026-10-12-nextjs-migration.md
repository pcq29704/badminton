# Next.js Migration Plan

**Status:** Next.js foundation, React conversion, and root-file cleanup added on 2026-10-13. Organiser and player-profile routes now render React components. Runtime regression tests, database verification, and deployment are deferred.

**Cleanup:** Removed the unused root `index.html` and production `config.js`. Moved unchanged legacy scripts/profile markup into `tests/fixtures/legacy`, updated baseline test paths, and moved the unchanged theme into `src/app/globals.css`. No application command, matching, profile, or backend behaviour changed in this cleanup.

**2026-10-13 setup constraints:** The user requested a simple local setup, deferred all testing, and prohibited testing against the current production Supabase credentials. Local development credentials will be provided later. Do not read the production values from `config.js` into the Next.js application or use them as fallbacks. Until development environment values are supplied, show a configuration message and make no Supabase requests. Vercel is the eventual deployment target; deployment work is deferred. These instructions override the testing and deployment steps below for this setup stage.

**Updated scope:** The user selected full React conversion. The implementation uses existing CSS, empty development environment values, a lazy environment-only browser client, and React organiser/profile screens. Without credentials, neither route makes Supabase requests. No tests, build, dev server, migrations, or deployment run. Static TypeScript/source checks are used without executing application code.

**Implementation decisions:** Keep the existing JavaScript domain logic in focused `.js` modules and React screens in `.jsx`; use TypeScript for Next.js routes/config and the Supabase client. Avoid a simultaneous full domain typing rewrite. A local command controller owns mutable working state for existing sequential operations and publishes detached snapshots to React. Matching/history/session loading are separate modules. Preserve legacy source files as references until regression validation is allowed; they are not loaded by Next.js. The server deployment choice is settled as Vercel, so no static-export alias handling is needed. `/profile.html` is a literal App Router route, and `/index.html` redirects to `/`.

**Goal:** Improve Court Balancer's code structure with Next.js and React while preserving current behavior.

**Architecture:** Use Next.js App Router with static page shells and client-side organiser and player-profile applications. Extract matching, session reconstruction, database access, and UI into focused modules. Keep Supabase as the backend and retain its existing Auth, RLS, schema, game RPCs, profile Edge Function, and Storage integration.

**Tech stack:** Next.js, React, TypeScript, existing CSS, `@supabase/supabase-js`; Vitest for logic and controller tests, Playwright for browser regression tests. Use npm and commit its lockfile. Select supported compatible versions at implementation time and pin dependencies; initially match the existing Supabase SDK version, 2.117.2, if compatible.

**Brief:** The user explicitly selected “Improve code structure; preserve current behavior.” This is a migration, without a redesign or new product features.

## Current app

- `index.html` loads CSS, a Supabase CDN script, `config.js`, and `app.js`.
- `app.js` combines mutable state, matching, queries, authentication, timers, actions, and HTML-string rendering.
- One URL presents loading, login, non-organiser, error, setup, and play states.
- Supabase email/password login and organiser membership control access. Browser requests use the public publishable key; database RLS and RPC checks enforce permissions.
- The database stores live sessions, player attendance, courts, games, ratings, and hold timestamps. The app restores sessions and matchmaking history after refresh.
- Team selection runs in the browser. Rating calculations and game mutations use SQL functions, including `start_game`, `remix_game`, `finish_game`, `correct_result`, and `end_session`.
- A single organiser phone runs the session. There is no implemented multi-device realtime subscription.
- `profile.html?u=<username>` and `profile.js` implement public profiles, separate player login, username edits, and image uploads through `player-api`.
- The current working tree includes `sessions.rank_new_games` and immutable per-game `games.ranked` flags. New games are unranked by default; the toggle changes future games only.
- Existing Node test scripts cover profiles and the ranked toggle. Keep backend tests; port tests that assert legacy HTML/script source to behavior tests.
- There is no package manifest. CSS and Supabase backend files already exist.
- Profile/ranked implementations appeared as concurrent local changes during planning. Recheck their final state before execution; this plan preserves the observed behavior without changing or approving those separate implementations.

## Constraints

- Preserve `/` and `profile.html?u=<username>`, screen flow, labels, English/Vietnamese help, confirmations, styling, and responsive court layout.
- Preserve matching weights, history window, pairing logic, randomness, Elo updates, and SQL result-correction rules.
- Preserve roster selection, new-player name/username creation, profile links, court setup, keen/break status, late arrivals, pending removal, court closure, remixes, holds, stats, toasts, and log copying.
- Preserve per-game ranked flags, default unranked play, future-games toggle, mode-specific results/logs, and correction rules. Unranked games retain winners/history but do not change persistent ratings or ranked game counts.
- Preserve public profile view, first-claim player login, username edits, profile/background uploads, and linked finished-game history. Keep player credentials in page memory only; refresh clears player login. Preserve existing backend contracts without revising password policy here.
- Keep tier data where the existing database and new-player seed selection require it. Do not restore tier badges that the current UI no longer shows.
- Preserve Supabase browser session persistence, including its storage configuration; do not switch to cookie authentication in this migration.
- No SQL migration, RLS change, API routes, Server Actions, realtime sync, or offline queue is required.
- Keep current CSS classes and native confirmation dialogs. Do not introduce Tailwind, a component library, Redux, Zustand, or a query library.
- Access browser APIs only in effects or event handlers. The server/build must not access `window`, `document`, clipboard, storage, or a user's session.
- Never put a secret/service-role key in browser code or `NEXT_PUBLIC_` variables.
- Preserve existing untracked planning files. Modify only files required by this migration.

## Approach options

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Next.js + React client app + existing Supabase backend | Clear module boundaries and React UI with limited backend risk | Most organiser logic remains browser-side | Recommended |
| Next.js with cookie auth, server queries, and server mutations | Adds server-controlled rendering and request handling | Changes authentication and data flow alongside the UI | Defer until a feature needs it |
| Next.js shell wrapping the old DOM-rendering script | Fast initial loading under Next.js | Leaves the code structure problem intact | Temporary bridge only, not the final deliverable |

Client Components fit the current app's state, events, and browser APIs. A client boundary still participates in initial prerendering, so it must render a stable loading state before browser initialization. See [Next.js component guidance](https://nextjs.org/docs/app/getting-started/server-and-client-components).

The base Supabase SDK supports the current browser auth model. If authenticated server rendering is added later, introduce the supported SSR integration as a separate change. See [Supabase package guidance](https://supabase.com/docs/guides/auth/choosing-a-server-package).

## Proposed files and responsibilities

```text
src/
  app/
    layout.tsx                    # Metadata, viewport, global CSS, document shell
    page.tsx                      # Mount CourtBalancer at /
    profile.html/page.tsx          # Preserve existing profile URL and query parameter
    globals.css                   # Existing styles.css, with only required changes
  lib/supabase/
    client.ts                     # Lazy browser client; public env configuration
  features/court-balancer/
    CourtBalancer.tsx             # Select screen; shared header, toast, saving state
    types.ts                      # Domain state and database response types
    matchmaking.ts                # Pure pairing/selection logic and existing weights
    history.ts                    # History accumulation, log construction/formatting
    repository.ts                 # Typed Supabase reads/writes and RPC wrappers
    session.ts                    # Build session snapshot from fetched rows
    useCourtBalancer.ts           # Own state, auth lifecycle, sequential actions
    useHoldTimer.ts               # Countdown, visibility event, expiry callback
    help.ts                       # Existing English/Vietnamese help content
    components/
      LoginScreen.tsx
      AccessScreen.tsx            # Loading, non-organiser, load error, retry
      SetupScreen.tsx
      PlayScreen.tsx
      CourtCard.tsx
      PlayerForm.tsx              # Shared new-player fields for setup and play
      ManagePlayers.tsx
      StatsPanel.tsx
      GameLog.tsx
      HelpPanel.tsx
      Toast.tsx
  features/player-profile/
    PlayerProfile.tsx              # Public profile, history, login/edit/upload forms
    usePlayerProfile.ts           # Page state; memory-only player credentials
    api.ts                        # Existing JSON/multipart Edge Function contracts
tests/
  unit/                          # Matching, history, snapshot, action lifecycle
  e2e/                           # Organiser workflow and browser recovery
.env.example
package.json
package-lock.json
next.config.ts
tsconfig.json
eslint.config.mjs
vitest.config.ts
playwright.config.ts
```

Keep state local to `useCourtBalancer`; components receive values and callbacks. A context provider is unnecessary for this component tree. Do not split small formatting helpers into extra files unless they have multiple consumers.

Profile query parsing runs in the browser after mount; do not require request-time `searchParams` for this route. Keep profile links as full document navigation so player credentials do not survive a transition in a shared client tree. For static export, verify the host maps `/profile.html` to the generated route asset; with this literal route name and `trailingSlash: false` the emitted filename may be `profile.html.html`. Configure that exact mapping or provide a generated static alias, and test the legacy URL on the actual host before cutover.

Repository functions return data or throw a typed expected-rule error for SQL `P0001`; they do not mutate React state. `loadSessionSnapshot(sessionId)` combines repository reads and pure reconstruction into one snapshot, returning `null` if the session has ended. The matching module consumes a snapshot and an optional avoided match key, and returns two player ID pairs or `null`.

Inject a random-number function into matching for repeatable tests, defaulting to `Math.random` in production. Preserve the existing order of candidates and pairing comparisons.

## Migration sequence

### 1. Capture the existing behavior

- [ ] Record the setup and play UI at phone and desktop sizes, including 1–6 courts.
- [ ] Record profile view/login/edit/upload/history and ranked/unranked workflows from the final concurrent changes. Run existing `node --test tests/*.test.mjs tests/*.test.cjs` as the baseline; investigate any failure before attributing it to migration.
- [ ] Create fixed matching/session fixtures before changing logic: fewer than four available players, players on break or leaving, active courts, fairness counts, streaks, keen status, repeat partners, recent rematches, and remix avoidance.
- [ ] Establish expected outputs from the current matcher with controlled randomness. Include a fixture where all penalties compete.
- [ ] Record session reconstruction expectations: numeric Elo conversion, stable player order, previous three ended sessions at half weight, finished games ordered by finish time, names of departed players, starting Elo, and removed court numbers.
- [ ] Identify a disposable Supabase test project and organiser/non-organiser accounts for integration validation. Compare its schema/RPC contracts with the checked-in SQL before relying on them.

**Verify:** Fixtures describe current behavior, including hidden tier seed data. Record unknown live schema or hosting differences explicitly. Do not run writes against production for baseline checks.

### 2. Add the Next.js foundation and extracted logic

- [ ] Add the root package manifest, lockfile, TypeScript, Next.js, ESLint, Vitest, and Playwright configuration. Avoid scaffolding over existing files.
- [ ] Add `src/app/layout.tsx`, `page.tsx`, `profile.html/page.tsx`, and `globals.css`. Preserve route-specific titles, viewport, mobile web-app metadata, fonts, and existing CSS.
- [ ] Add `types.ts`, `matchmaking.ts`, `history.ts`, and `session.ts`. Replace global reads with explicit inputs; retain algorithm and data mapping behavior.
- [ ] Run the fixtures against the extracted modules and compare with the legacy results before connecting the new UI.
- [ ] Add npm scripts: `dev`, `build`, `start` for server mode, `lint` using ESLint directly, `typecheck` using `tsc --noEmit`, `test`, and `test:e2e`.

**Verify:** The `/` shell builds without browser globals; fixture tests pass. Check the chosen Next.js version's Node and browser requirements against the deployment runtime and organiser phone. Current documentation lists Node 20.9 minimum and Safari 16.4 minimum; select a supported Node release for deployment.

### 3. Move Supabase access and session lifecycle

- [ ] Replace the CDN/global client with a lazy browser singleton in `client.ts`.
- [ ] Replace `config.js` usage with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Document both in `.env.example`; ignore `.env.local`.
- [ ] Move current queries and RPCs into `repository.ts`, preserving selected fields, filtering, ordering, arguments, and error distinctions. Validate response types against the test schema; do not assume the live schema matches the SQL file.
- [ ] Implement the controller's loading/login/non-organiser/error/setup/play phases and active-session recovery. Preserve last-session roster preselection and existing email/password login.
- [ ] Subscribe to auth changes once per active lifecycle and unsubscribe on cleanup. Cancel or ignore stale responses after sign-out or unmount.
- [ ] Deduplicate bootstrap/hold settlement so development effect reruns do not start duplicate games. Establish one current snapshot and one immediate mutation lock, independent of delayed React rendering.

**Verify:** Signed-out load, organiser login, non-organiser rejection, failed load/retry, sign-out, persisted login, and active-session restoration work. Strict Mode mount/cleanup/remount leaves one active subscription and no duplicate game writes. Anonymous and non-organiser access remain denied by Supabase.

### 4. Convert setup and play to React

- [ ] Replace HTML-string rendering and inline `onclick` attributes with JSX and typed callbacks in the proposed components.
- [ ] Use controlled form inputs and stable player/court/game keys. Display names, errors, logs, and toast content as text/structured JSX; do not use `dangerouslySetInnerHTML` for dynamic values.
- [ ] Port setup, new-player validation, and selection behavior first, then court cards, player management, stats, logs, help, and result toasts.
- [ ] Port username fields/profile links and ranked toggle. Preserve `rank_new_games` and each game's `ranked` value during queries, restoration, result handling, and log formatting.
- [ ] Port actions with existing sequential database calls and local updates. Nested operations share the outer mutation lock rather than trying to acquire it again.
- [ ] Update `Map`, `Set`, objects, and arrays immutably; keep the controller's current snapshot available to chained matching decisions. Fill courts sequentially so the same player cannot be selected twice from stale state.
- [ ] Preserve saving indicators, double-tap prevention, SQL rule messages, and reloading the saved session after unexpected write errors. Do not automatically retry mutations whose outcome is uncertain.

**Verify:** Start with at least four players; create players; operate 1–6 courts; finish and correct results; remix one/all courts; add late arrivals; change status; remove players immediately or after their game; close/cancel-close courts; end the day. Compare visible and persisted results with the baseline. Special characters in names display as text. Check mobile keyboard input and focus stability.

**Mode checks:** Toggle ranking with games already playing: their flags stay fixed, newly drawn games use the new setting, and refresh preserves both. Check Elo, tier, and ranked game count before/after unranked finishes and corrections; values remain unchanged. Ranked results retain existing SQL correction constraints.

### 5. Convert the player profile flow

- [ ] Move profile JSON actions (`profile`, `login`, `update`) and multipart `upload` into `features/player-profile/api.ts`, retaining public `apikey` headers and existing payload/response contracts.
- [ ] Convert `profile.js` rendering into controlled React forms and structured profile/history components; keep direct public Storage image URLs and current error messages.
- [ ] Keep player passwords only in the profile controller's memory. Clear on sign-out/unmount, never serialize into URLs, props from a server, storage, or logs. Ignore stale requests after navigation/sign-out.
- [ ] Preserve `?u=` links and URL replacement after username edits. Keep organizer Supabase Auth independent of profile login.
- [ ] Keep the existing Edge Function, SQL migrations, Storage bucket, and backend tests unchanged unless a separate backend defect is confirmed.

**Verify:** Anonymous profile/history, missing username, unknown player, first claim on a disposable account, successful/wrong-password login, username collision/change, both image uploads, upload rejection, sign-out, and refresh-to-view-only. Test profile links from setup, courts, waiting players, and history. No password appears in responses, rendered profile data, or persisted browser state.

### 6. Port timing and recovery safely

- [ ] Replace DOM countdown updates with `useHoldTimer`, deriving remaining time from saved timestamps and current time.
- [ ] Register one interval and one visibility listener, with cleanup. Recompute on foreground return rather than counting missed ticks.
- [ ] Route expired-hold release, “fill now,” bootstrap settlement, and user actions through the same mutation lock. Prevent two callbacks from releasing/filling the same courts simultaneously.
- [ ] Port toast timeout cleanup and clipboard copying, including the existing prompt fallback.
- [ ] Preserve sign-out and end-session confirmations and stop timers from accessing obsolete sessions.

**Verify:** Fake-clock tests cover an expired hold, a second held court, no other open court playing, concurrent manual/automatic release, and remount cleanup. Browser tests cover refresh mid-game, refresh during a hold, phone sleep/foreground return, and failed writes followed by reload. No duplicate result or start RPC occurs on rapid taps.

### 7. Validate, deploy, and remove the legacy entry point

- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build`.
- [ ] Use mocked Supabase responses for repeatable browser tests and failure cases. Separately run actual auth/RPC/RLS smoke tests against the disposable project; mocks cannot establish database correctness.
- [ ] Run the production build on a preview URL and test on the organiser phone. Check English/Vietnamese help, visual parity, log copying, active-session recovery, and sign-out/sign-in.
- [ ] Configure the selected host's build command, output/runtime, public environment values, and Supabase auth URL settings if the origin changes. Public env values must be present at build time.
- [ ] Keep the legacy deployment available until the preview passes. Cut over between sessions when practical. Preserve the previous deployment for rollback.
- [ ] After parity passes, remove legacy `app.js`, `index.html`, `profile.js`, `profile.html`, `config.js`, and root `styles.css` from the new application source. Keep the compatible Next.js profile route. Update source-based frontend tests to assert React behavior; retain backend contract tests. Update `README.md` with setup, commands, env values, hosting, validation, and rollback.

**Verify:** A production build resumes existing saved sessions without data migration. Rollback changes the frontend deployment only. If tests cannot reach a disposable Supabase project, report that limitation and keep live auth/RPC validation open before cutover.

## Deployment choice

Hosting is not recorded in this repository. Confirm it before implementation config is finalized:

- **Static host:** Set `output: 'export'`, build with `next build`, and serve `out/`. The recommended browser-based architecture supports this. It cannot later use request-time server auth or Server Actions without changing hosting. See [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports).
- **Next.js server host:** Use the normal build/runtime and preview deployments. This leaves room for future server features, but the migration still retains browser auth and direct Supabase queries.

If the origin changes, expect users to sign in again because browser auth storage is origin-specific. Saved game/session data remains in Supabase.

## Risks and separate follow-ups

- **Matching drift:** Keep identical weights, ordering, comparisons, and production randomness; prove parity with fixtures.
- **Stale React state:** Chained fills must use the latest committed action snapshot, not a render's earlier closure.
- **Duplicate side effects:** Effects, timer ticks, visibility events, and buttons must share lifecycle cleanup and mutation coordination.
- **Partial session creation:** Existing `startDay` performs several separate writes. Preserve its failure/recovery behavior here; an atomic start-session RPC is a separate backend improvement.
- **Unknown live schema:** The one-time SQL script does not prove what is deployed. Inspect a test environment before integration acceptance; never rerun the baseline creation script on existing data.
- **Concurrent work:** Refresh the baseline once profile/ranked work settles. The working tree already differs from its planning documents; implemented behavior takes precedence for migration parity.

## Completion criteria

The app runs under Next.js, legacy DOM renderers are removed, concerns are separated into the proposed modules, and organiser, ranked/unranked, and player-profile workflows remain intact. Logic tests, browser regression tests, retained backend tests, production build, visual comparison, and real Supabase smoke checks pass before deployment cutover.

## Review decisions

1. Confirm whether the current deployment serves static files or supports a Next.js runtime.
2. Confirm access to a disposable Supabase project for auth/RPC integration checks before implementation.

No implementation or deployment is authorized by this planning document alone.
