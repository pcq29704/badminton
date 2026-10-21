# Move player-api from a Supabase Edge Function to a Next.js route handler

**Why:** The edge function was never deployed to dev or production, so profile login fails in the browser with
"Failed to fetch" and nothing shows in the terminal. A Next.js route handler runs with `npm run dev`, needs no
separate deploy, logs to the terminal, and fits the planned Vercel hosting.

**Behaviour must not change.** Same four actions, same request and response shapes, same status codes, same error
messages, same validation order. Only the transport changes.

## Contract (unchanged)

`POST /api/player`

| Request | Response |
|---|---|
| JSON `{action:"profile", username}` | 200 profile object, 400 bad username, 404 not found, 500 |
| JSON `{action:"login", username, password}` | 200 `{ok:true, username}`, 400 bad username, 401 bad credentials |
| JSON `{action:"update", username, password, newUsername}` | 200 `{ok:true, username}`, 400, 401, 409 taken, 500 |
| multipart `action=upload, username, password, kind, file` | 200 `{ok:true, kind, path}`, 400, 401, 413, 500 |
| any other method | 405 (Next.js does this automatically) |
| bad JSON body or unknown action | 400 |
| missing server config or unexpected error | 500 `{error:"The player service is unavailable. Try again."}` |

Responses keep `Cache-Control: no-store`. CORS headers are dropped: the browser now calls its own origin.

## Files

| Action | Path | Notes |
|---|---|---|
| move | `supabase/functions/player-api/logic.mjs` to `src/lib/player-api/logic.mjs` | Content unchanged. Stays `.mjs` so Node tests import it directly. |
| create | `src/lib/supabase/admin.ts` | `import "server-only"`. Builds the service-role client from `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Throws if either is missing. |
| create | `src/app/api/player/route.ts` | Port of `index.ts`. `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, `export async function POST(request)`. |
| edit | `src/features/player-profile/api.js` | Endpoint becomes `/api/player`. Drop the `apikey` header and the URL/key check from `endpoint()`. `profileImageUrl` is unchanged. |
| edit | `.env.example` | Add `SUPABASE_SERVICE_ROLE_KEY=` with a warning. |
| delete | `supabase/functions/player-api/index.ts` | Never deployed anywhere. Git history keeps it. |
| edit | `supabase/config.toml` | Remove the `[functions.player-api]` block. |
| edit | `tests/player-profile-logic.test.mjs`, `tests/player-profile-security.test.mjs` | New paths and markers (see step 6). |
| edit | `README.md` | Document the service key and the new endpoint. |
| add dep | `server-only` | Makes the build fail if client code ever imports `admin.ts`. |

Not touched: `tests/fixtures/legacy/*` (frozen baseline), the SQL migrations, the organiser screens.

## Steps

1. **Dependency.** `npm install server-only`.
2. **Move logic.** `git mv` the file. Do not edit it.
3. **Admin client.** Write `src/lib/supabase/admin.ts` exporting `getAdminClient()`. Options:
   `{ auth: { persistSession: false, autoRefreshToken: false } }`. The key is read from `process.env` inside the
   function, never at import time, so `next build` works without it.
4. **Route handler.** Port each function from `index.ts` in the same order: `authenticate`, `publicProfile`,
   `updateUsername`, `uploadImage`, `validateMultipartSize`, then `POST`.
   - Types: `ReturnType<typeof getAdminClient>` replaces `ReturnType<typeof client>`. Keep `any` where the original
     used it for joined rows.
   - Use `NextResponse.json` or a local `json()` helper with `Cache-Control: no-store`.
   - Multipart branch: check `content-length` before `await request.formData()`. In `uploadImage`, call
     `validateImageSize(file.size)` before `await file.arrayBuffer()`.
   - In `catch`, log only `error.message` with a fixed prefix, for example `console.error("[player-api]", message)`.
     Never log the body, form data, username or password.
   - Missing config: `getAdminClient()` throws, `catch` logs the reason (names the env var, no values) and returns the
     generic 500.
5. **Frontend.** Edit `api.js`:
   - `endpoint()` returns `"/api/player"`.
   - `postPlayerJson` sends only `Content-Type: application/json`. `uploadPlayerImage` sends no custom headers
     (the browser sets the multipart boundary).
6. **Tests.**
   - Logic test: import from `../src/lib/player-api/logic.mjs`. The "does not log credentials" test reads
     `src/app/api/player/route.ts`.
   - Security test: read `route.ts` as `edge`. The upload slice ends at `export async function POST` instead of
     `Deno.serve`. All other assertions stay as written.
   - New assertion: no file under `src/features` or `src/components` mentions `SERVICE_ROLE`, and `admin.ts` contains
     `server-only`.
7. **Cleanup.** Delete `index.ts`, remove the config block, update `.env.example` and `README.md`.
8. **Verify.**
   - `node --test tests/` passes.
   - `npx next build` passes without the service key set, and `/api/player` appears as a dynamic route.
   - Smoke test against `npm run dev` without the key: POST `{"action":"nope"}` returns 500 with the generic message
     and the terminal shows the `[player-api]` line. Wrong method returns 405.
   - With the key set (needs the user to add it): `profile` for `thang` returns 200 with no `password` field;
     `login` with a wrong password after a claim returns 401.
9. **Report** what was and was not verified.

## Out of scope

Hosting, the production deploy, changing the password flow, rate limiting, and removing `court_balancer_schema.sql`
references to the edge function.
