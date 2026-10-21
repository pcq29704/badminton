# Player sign-in that survives refresh (server session cookie)

**Why:** Organisers stay signed in after a refresh because Supabase Auth stores their session. Players do not. Their
login lives only in React state (`src/features/player-profile/usePlayerProfile.js`), and every `update` and `upload`
request sends the plain password again. A refresh signs the player out.

**Fix:** After a correct login, the server creates a random session token, stores only its SHA-256 hash in a new
table, and sends the token to the browser in an `httpOnly` cookie. Later requests send the cookie. The password is
checked once, at login.

**Scope of this plan:** Phase 1 (session cookie) only. Phase 2 (hashing the stored password) is listed in
"Out of scope" and needs its own plan. Do not start Phase 2 inside this work.

---

## Prerequisite

The route handler plan `docs/plans/2026-10-17-player-api-route-handler.md` must be finished first. Right now these
files are uncommitted: `src/app/api/player/route.ts`, `src/lib/supabase/admin.ts`, `src/lib/player-api/logic.mjs`.
Steps below build on them.

**Step P0. Baseline check (before any edit).**
1. Run `node --test tests/` from the repo root. Record the pass and fail counts in the report.
2. Run `npm run build`. Record the result.
3. If a test fails before any change, stop and report it. Do not hide it inside this plan's work.

---

## Locked decisions (do not change during implementation)

| Topic | Decision |
|---|---|
| Table name | `public.player_sessions` (not `sessions`, which is the court-balancer table) |
| Token | 32 random bytes from `crypto.randomBytes`, encoded as base64url (43 characters) |
| Stored value | `sha256` hex of the token, 64 lowercase hex characters. The raw token is never stored. |
| Cookie name | `player_session` |
| Cookie attributes | `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` (30 days) |
| Expiry | `expires_at = now() + 30 days`. Refreshed on use, at most once per 24 hours (see step 4.4). |
| Who can read the table | Nobody except the service role. RLS enabled, no policies, `anon` and `authenticated` revoked. |
| Login response | Unchanged: `200 {ok:true, username}`. The `Set-Cookie` header is the only addition. |
| Password after login | Not needed again. `update` and `upload` no longer accept `password`. |
| Logout | New action `logout`. Always returns 200 `{ok:true}`, even with no session. |
| Restore on refresh | New action `session`. 200 `{ok:true, username}` or 401 `{error}`. |
| Mutating requests | `update` and `upload` require a valid session cookie, else 401. |
| CSRF | Cookie is `SameSite=Lax`. Mutating requests also reject a cross-site `Origin` header (step 4.6). |

---

## Contract changes (the only changes to the API)

`POST /api/player`. Everything not listed here stays exactly as it is in the route handler plan.

| Request | Response |
|---|---|
| JSON `{action:"login", username, password}` | 200 `{ok:true, username}` + `Set-Cookie: player_session=…`. Was: no cookie. |
| JSON `{action:"session"}` | 200 `{ok:true, username}` if cookie valid. 401 `{error:"Sign in to continue."}` otherwise. |
| JSON `{action:"logout"}` | 200 `{ok:true}` + `Set-Cookie` that clears the cookie (`Max-Age=0`). |
| JSON `{action:"update", newUsername}` | 200 `{ok:true, username}`, 400, 401 no session, 409 taken, 500. **`username` and `password` fields are removed.** |
| multipart `action=upload, kind, file` | 200 `{ok:true, kind, path}`, 400, 401 no session, 413, 500. **`username` and `password` fields are removed.** |
| JSON `{action:"profile", username}` | Unchanged. Public, no cookie needed. |
| Cross-site `Origin` on `update` or `upload` | 403 `{error:"Request blocked."}` |

Error messages for 401 on `update` and `upload` change to `"Sign in to continue."`. The old text
`"Invalid username or password."` stays only on `login`.

---

## Files

| Action | Path | Notes |
|---|---|---|
| create | `supabase/migrations/20261017120000_player_sessions.sql` | Table, index, RLS, revokes. Applied with `npm run db:migrate`. |
| create | `src/lib/player-api/session.mjs` | Pure helpers, no DB and no `next` imports. Testable with `node --test`. |
| create | `tests/player-session.test.mjs` | Unit tests for `session.mjs`. |
| edit | `src/app/api/player/route.ts` | Add `session`, `logout`. Change `login`, `update`, `upload` as listed above. |
| edit | `src/features/player-profile/api.js` | `uploadPlayerImage(kind, file, signal)`: drop `username` and `password` params. |
| edit | `src/features/player-profile/usePlayerProfile.js` | Restore on mount, clear password after login, stop sending it, real logout. |
| edit | `src/features/player-profile/ProfileEditor.jsx` | Only if its `Sign out` or sign-in copy must change (see step 5.4). |
| edit | `tests/player-profile-security.test.mjs` | New assertions and updated upload-order check (step 7). |
| edit | `README.md` | Short note: players stay signed in for 30 days; cookie name; logout. |

Not touched: organiser auth (Supabase Auth), `claim_player_login` (Phase 2), `court_balancer_schema.sql`, the
`players` table, image storage policies, `tests/fixtures/legacy/*`.

---

## Steps

### Step 1. Migration

Create `supabase/migrations/20261017120000_player_sessions.sql` with exactly this content:

```sql
-- Player sign-in sessions. Rows hold a SHA-256 hash of the cookie token, never the token itself.
-- Only the service role (server route handler) reads or writes this table.
begin;

create table public.player_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id bigint not null references public.players (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index player_sessions_player_id_idx on public.player_sessions (player_id);
create index player_sessions_expires_at_idx on public.player_sessions (expires_at);

alter table public.player_sessions enable row level security;
revoke all on public.player_sessions from anon, authenticated;

commit;
```

Rules:
- Do not add RLS policies. With no policy, only the service role can access the table.
- Do not change any existing migration file.
- Apply to the **dev** project only: `npm run db:migrate`. The script refuses the production project ref. Do not
  apply by hand to production.

Check after applying (dev): the table exists, `relrowsecurity` is true, and `anon` has no privileges on it.

### Step 2. Pure session helpers

Create `src/lib/player-api/session.mjs`. Export exactly these names:

| Export | Behaviour |
|---|---|
| `COOKIE_NAME` | `"player_session"` |
| `SESSION_DAYS` | `30` |
| `REFRESH_AFTER_MS` | `24 * 60 * 60 * 1000` |
| `newSessionToken()` | `crypto.randomBytes(32).toString("base64url")` |
| `hashSessionToken(token)` | `crypto.createHash("sha256").update(token).digest("hex")` |
| `readSessionToken(cookieHeader)` | Returns the value of `player_session` from a `Cookie` header string, or `null`. Splits on `;`, trims each part, matches the name exactly. Returns `null` if the value is empty or longer than 128 characters. |
| `sessionCookie(token)` | Returns `player_session=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` |
| `clearedSessionCookie()` | Returns `player_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` |
| `sessionExpiry(now)` | Returns a `Date` 30 days after `now`. |

Use `import crypto from "node:crypto"` (or named imports). No `next/headers`, no Supabase imports.

### Step 3. Route: helpers used by every session action

In `src/app/api/player/route.ts`, add these functions after `authenticate` and before `publicProfile`. Names must match.

**3.1 `createSession(db, playerId)`**
1. Delete expired rows for this player: `db.from("player_sessions").delete().eq("player_id", playerId).lt("expires_at", now)`.
2. `token = newSessionToken()`.
3. Insert `{ player_id: playerId, token_hash: hashSessionToken(token), expires_at: sessionExpiry(now).toISOString() }`.
4. If the insert fails, return `null`. Caller returns 500 with the generic message.
5. Return `token`.

**3.2 `requireSession(db, request)`**
1. `token = readSessionToken(request.headers.get("cookie"))`. If `null`, return `null`.
2. `now = new Date()`.
3. Select `id, player_id, last_used_at` from `player_sessions` where `token_hash = hashSessionToken(token)` and
   `expires_at > now`. Use `maybeSingle()`. On error or no row, return `null`.
4. Load the username: `db.from("players").select("id,username").eq("id", row.player_id).maybeSingle()`. If none,
   return `null`.
5. Refresh (step 4.4 rules): if `now - last_used_at >= REFRESH_AFTER_MS`, update that row with
   `last_used_at = now`, `expires_at = sessionExpiry(now)`. If this update fails, still return the session (refresh is
   optional).
6. Return `{ player_id, username, session_id }`.

**3.3 `deleteSession(db, request)`**
1. Read the token as in 3.2. If present, delete the row where `token_hash` matches.
2. Ignore errors (logout must always succeed for the user).

**3.4 Origin check `isCrossSiteOrigin(request)`**
1. `origin = request.headers.get("origin")`. If missing, return `false`.
2. Return `true` if `new URL(origin).host !== request.headers.get("host")`. Catch `URL` parse errors and return `true`.

### Step 4. Route: actions

Keep the order of `POST` logic the same as today. Only the branches below change.

**4.1 `login` branch**
- Current behaviour kept: validate username, check password via `authenticate`, 401 on failure.
- On success: `token = await createSession(db, player.player_id)`. If `null`, return 500 generic message.
- Return `json({ ok: true, username: player.username }, 200, { "Set-Cookie": sessionCookie(token) })`.
- A failed login sets no cookie and deletes nothing.

**4.2 `session` branch (new)**
- `const session = await requireSession(db, request)`. If `null`, return 401 `{error:"Sign in to continue."}`.
- Return 200 `{ ok: true, username: session.username }`.

**4.3 `logout` branch (new)**
- `await deleteSession(db, request)`.
- Return 200 `{ ok: true }` with `Set-Cookie: clearedSessionCookie()`.

**4.4 Sliding refresh rule (single place)**
- Refresh happens only inside `requireSession` (step 3.2.5). It runs at most once per 24 hours per session.
- Do not refresh on `profile` or `login`.

**4.5 `update` branch**
- Remove `password` and `username` from the body reads. Read only `body.newUsername`.
- Order: (a) Origin check (4.6), (b) `requireSession`, (c) `validateUsername(body.newUsername)` → 400 on error,
  (d) update `players` where `id = session.player_id` (same as before), (e) 409 on `23505`, 500 on other errors,
  (f) 200 `{ok:true, username}`.
- Note: the old code validated `username` before `newUsername`. The new code has no `username` field. Keep the
  error message the same.

**4.6 Origin check**
- In `POST`, before the `update` and `upload` branches (and before reading the multipart body), if
  `isCrossSiteOrigin(request)` is true, return 403 `{error:"Request blocked."}`.
- Apply to `update` and `upload` only. `profile`, `login`, `session` and `logout` may skip it. `login` is covered by
  SameSite and by the password check.

**4.7 `upload` branch (multipart)**
- Remove `username` and `password` form fields. Keep `action`, `kind`, `file`.
- Order: Origin check (4.6), `validateMultipartSize`, `request.formData()`, action check, then `requireSession(db, request)`
  → 401 if `null`. Then keep the rest of `uploadImage` unchanged (`kind` check, `validateImageSize`,
  `imageExtension`, previous path read, storage upload, update, remove old file).
- Use `session.player_id` wherever the old code used `player.player_id`.
- The `uploadImage` signature becomes `uploadImage(db, request, form)` so it can call `requireSession`.

**4.8 `profile` branch**
- Unchanged.

**4.9 Response helper**
- Change `json(body, status = 200)` to `json(body, status = 200, headers = {})`. Merge `headers` with
  `Cache-Control: no-store`. Keep `Content-Type` from `Response.json`.

### Step 5. Frontend: `api.js`

**5.1** `postPlayerJson(action, values, signal)` is unchanged. Same-origin `fetch` sends cookies by default. Do not add
`credentials` (default `same-origin` is correct).

**5.2** `uploadPlayerImage(kind, file, signal)`:
- Remove the `username` and `password` parameters and their `form.append` lines.
- Keep `form.append("action", "upload")`, `form.append("kind", kind)`, `form.append("file", file)`.
- Keep `signal` and `result(...)`.

**5.3** No other changes to `api.js`.

### Step 6. Frontend: `usePlayerProfile.js`

Make these exact changes. Nothing else in the hook changes.

**6.1 Restore on mount.** In the mount `useEffect`, after `update({ initialized: true, … })`:
1. Read `const requested = new URLSearchParams(window.location.search).get("u") || ""`. (Already done as `username`.)
2. Call `postPlayerJson("session", {}, controller.signal)` inside `try`. On success:
   - If `requested` is empty or equals `result.username` (case-insensitive), then:
     `update({ loggedIn: true, username: result.username, loginUsername: result.username })`, `setProfileUrl(result.username)`,
     and `await refreshProfile(result.username, controller.signal)`.
   - Otherwise (a different `u` is in the URL): do nothing. Keep the public view for `u`.
3. On error (401 or network): do nothing. The login form shows as before.
4. Guard with `if (!controller.signal.aborted)` after each `await`.
5. Keep the existing `refreshProfile(username)` call for the public view when not restored.

Concrete order inside the effect:
```
const controller = new AbortController();
lifecycle.current = controller;
const username = new URLSearchParams(window.location.search).get("u") || "";
update({ initialized: true, username, loginUsername: username });
void restoreSession(username, controller.signal);   // new
return () => { controller.abort(); lifecycle.current = null; };
```
`restoreSession` does steps 2 to 4. If it restores, it calls `refreshProfile(result.username, signal)` itself. If it does
not restore and `username` is set and `hasSupabaseConfig`, call `refreshProfile(username, signal)`. Keep the
`hasSupabaseConfig` check in both places.

Do not use `run()` for restore (it sets `busy`, which would block the first click).

**6.2 Login.** In `login()`, after `update({ username: result.username, loginUsername: result.username, loggedIn: true, newUsername: null })`,
add `password: ""` to the same `update` call. The password must not stay in state after login.

**6.3 Save username.** In `saveUsername()`, change the request to:
`postPlayerJson("update", { newUsername: state.newUsername ?? state.profile.username }, signal)`.
Remove `username` and `password` from the body.

**6.4 Upload.** In `upload()`, change the call to `uploadPlayerImage(kind, file, signal)`.

**6.5 Sign out.** Replace `signOut` with:
```
function signOut() {
  if (busy.current) return;
  void postPlayerJson("logout", {}, lifecycle.current?.signal).catch(() => {});
  update({ loggedIn: false, password: "", loginUsername: state.username, newUsername: null, notice: "" });
}
```
Logout errors are ignored on purpose: the cookie is also cleared by the next `session` call failing. Do not `await` it, so
the UI updates at once. (`state.username` is the signed-in username, as today.)

**6.6 State shape.** No new fields. `password` stays in the initial state (it holds the sign-in form input).

### Step 7. Tests

**7.1 New file `tests/player-session.test.mjs`** (imports `../src/lib/player-api/session.mjs`):
- `newSessionToken()` returns a string of 43 characters matching `^[A-Za-z0-9_-]{43}$`. Two calls differ.
- `hashSessionToken("abc")` returns 64 lowercase hex characters and is stable.
- `hashSessionToken(x) !== x` for a generated token (the raw token is not the stored value).
- `sessionCookie("t")` contains, in order: `player_session=t`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=2592000`.
- `clearedSessionCookie()` contains `player_session=;` and `Max-Age=0`.
- `readSessionToken("a=1; player_session=XYZ; b=2")` returns `"XYZ"`.
- `readSessionToken("player_session_old=1")` returns `null` (exact name match).
- `readSessionToken(null)` and `readSessionToken("")` return `null`.
- `readSessionToken("player_session=" + "x".repeat(200))` returns `null`.
- `sessionExpiry(new Date(0)).getTime() - 0` equals `30 * 24 * 60 * 60 * 1000`.

**7.2 Update `tests/player-profile-security.test.mjs`.** Read `route.ts` as `edge` (already does).
- The `upload` slice check: change `upload.indexOf('await authenticate')` to `upload.indexOf('requireSession(db, request)')`.
  Keep the rest of that test. The order check `await authenticate < .upload(path` becomes `requireSession < .upload(path`.
- Add: `edge` contains `"Set-Cookie"` or the `sessionCookie(` call inside the `login` branch.
- Add: `edge` contains `isCrossSiteOrigin(request)` and `status 403`-style text `Request blocked.`.
- Add: `updateUsername` slice does not contain `body.password`. Same check for `uploadImage` slice:
  does not contain `form.get("password")`.
- Add: `migration` file `20261017120000_player_sessions.sql` contains `enable row level security` and
  `revoke all on public.player_sessions from anon, authenticated`.
- Add: `api.js` does not contain `password`. `usePlayerProfile.js` contains `postPlayerJson("logout"` and
  `postPlayerJson("session"`.
- Keep existing tests: the migration test on `claim_player_login`, the public history query test, the storage test,
  the service key test, and the browser-no-secret test.

**7.3 Logic test.** `tests/player-profile-logic.test.mjs` needs no change (logic.mjs is unchanged).

**7.4 Run** `node --test tests/`. All tests must pass. Record counts.

### Step 8. Documentation

Edit `README.md` with a short section:
- Players stay signed in for 30 days on the same browser.
- Cookie name `player_session`, `httpOnly`, cleared by Sign out.
- Signing out on one device does not sign out other devices.

Keep it to one short section. Do not change other README text.

### Step 9. Manual verification (dev server)

Run `npm run dev`. Use a dev player with a known password. Use a test value only (see the environment rules for test
credentials). Do not use a real player password. Check each item and record pass or fail:

| # | Check | Expected |
|---|---|---|
| 1 | Sign in with correct password | Editor shows, `Signed in as <username>`. |
| 2 | Refresh the page | Still signed in, profile loads with no password prompt. |
| 3 | DevTools → Application → Cookies | `player_session` present, HttpOnly ticked, Secure ticked, SameSite Lax, 30-day expiry. |
| 4 | DevTools → Application → Local/Session Storage | Nothing about the player, no password. |
| 5 | DevTools → Network, Save username | Request body has `newUsername` only. No `password`. |
| 6 | Change profile image | Multipart form has `action`, `kind`, `file` only. Image saves. |
| 7 | Sign out, then refresh | Login form shows. |
| 8 | Replay the old cookie value after sign out (curl with `Cookie: player_session=<old>`, action `session`) | 401. |
| 9 | Wrong password | 401, no `Set-Cookie`. |
| 10 | `update` with no cookie (curl) | 401 `Sign in to continue.` |
| 11 | `upload` with no cookie (curl) | 401. |
| 12 | `update` with `Origin: https://evil.example` (curl) | 403 `Request blocked.` |
| 13 | Open `/player?u=<other>` while signed in as another player | Public view of `<other>`, no switch to the signed-in editor. |
| 14 | Sign in on two browsers, sign out on one | The other stays signed in. |
| 15 | Set `expires_at` to a past time for your row (dev DB), refresh | Login form shows. Row is still present (no need to delete). |
| 16 | Change username while signed in, then refresh | Still signed in as the new username. |
| 17 | `session` after logout in step 7 is also 401 | Confirms row was deleted. |

Note: step 8 and step 17 need the old token. Copy it from DevTools before signing out.

### Step 10. Production

Do not deploy. Hosting is out of scope. Before deploying, the user runs the migration on production through their
normal process, and the user sets `SUPABASE_SERVICE_ROLE_KEY` in the hosting environment.

### Step 11. Report

List, with pass or fail:
- Test counts (before and after).
- Build result.
- Each manual check in step 9 (or "not run" with reason).
- Anything changed outside the Files table (should be nothing).

---

## Behaviour to watch for (drift guard)

- Login response body stays `{ok, username}`. Only the `Set-Cookie` header is new.
- `profile` stays public and unauthenticated.
- Organiser flow (`src/features/court-balancer`, `AccessScreen.jsx`, Supabase Auth) is not touched.
- `claim_player_login` is not changed in this plan. Its plaintext password compare stays until Phase 2.
- Do not store the raw token, the password, or the session row id in `localStorage`.
- Do not log cookie values. The `[player-api]` log line stays message-only.

## Out of scope

- **Phase 2: hash stored passwords.** Replace the plaintext `players.password` compare in `claim_player_login` with a
  salted hash (for example `pgcrypto` `crypt` with `gen_salt('bf')`). Needs a migration plan for existing rows. Write a
  separate plan after this one ships.
- Login rate limiting and lockout (brute-force protection). Track as a follow-up.
- Limiting the number of active sessions per player.
- A "sign out everywhere" button.
- Moving players to Supabase Auth (option 2 in the earlier discussion).
- Hosting and production deploy.
