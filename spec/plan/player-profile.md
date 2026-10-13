# Player Profiles Implementation Plan

> **For agentic workers:** Use the native sequential implementation workflow. Tasks use checkbox syntax for tracking.

**Goal:** Add public badminton player profiles with a separate first-claim username/password login, limited profile edits, public finished-game history, and validated image uploads.

**Architecture:** Keep the existing Supabase Auth organiser app and organiser-only access to game tables. Add player fields and an atomic password-claim RPC in an additive SQL migration, then expose only an explicit safe profile projection through one Supabase Edge Function. The static profile page calls that function for public reads and password-checked edits/uploads; the organiser UI sets a username when adding a player.

**Tech Stack:** Static HTML, CSS, JavaScript; Supabase Postgres SQL and Storage; Supabase Edge Functions (Deno TypeScript); Node built-in checks where useful.

**Spec:** User request in this task and its requirements, recorded here as the accepted feature brief.

**Status:** Implementation complete. Live Supabase integration checks remain pending because the local Docker daemon is unavailable and no disposable test project is configured.

## Global Constraints

- Add `username`, `password TEXT NULL`, `profile_image_path`, and `background_image_path` to `public.players`; do not add a profiles table or `auth_user_id`.
- Keep organiser sign-in on Supabase Auth and keep organiser-only policies for underlying game tables.
- Store first-claim passwords as exact plaintext by explicit product decision; do not return or log passwords.
- Keep the Supabase secret/service key on the server; browser code may use only the existing public anon/publishable key.
- Keep player passwords in page memory only; refreshing requires another login.
- Use one public Supabase Storage bucket and allow writes only through the password-checking Edge Function.
- Return public profile data through the Edge Function with an explicit safe-field projection.
- Organisers set an available username when creating a player.

## Review Focus

- Two concurrent first logins for one unclaimed username: row locking lets only the first password claim succeed.
- Username casing/whitespace variants: the database unique index and login lookup compare normalized lowercase values.
- Wrong password after claim: login, edit, and upload reject without changing profile data or storage.
- Password accidentally returned or logged: RPC and Edge Function response shapes exclude it; logs omit request bodies and credentials.
- Upload MIME spoofing, invalid image signatures, and oversized files: reject before storage write.

---

### Task 1: Database migration and fresh-install schema

**Files:**
- Create: `migrations/20261012_player_profiles.sql`
- Modify: `court_balancer_schema.sql`

**Interfaces:**
- Produces: `players.username`, `players.password`, `players.profile_image_path`, `players.background_image_path`; a case-insensitive unique username index; `public.claim_player_login(text,text)` returning only player id and username; public bucket `player-profile-images`.
- Existing `public.is_organiser()` remains the only policy predicate for organiser table access.

- [x] Add nullable columns, backfill existing usernames from normalized player names with deterministic suffixes for slug collisions, then require usernames and add format and case-insensitive uniqueness constraints.
- [x] Add `claim_player_login` as a `SECURITY DEFINER` row-locking function. It saves the exact first password only when NULL, otherwise compares exact text, and returns only id/username on success.
- [x] Revoke public/anon/authenticated execution and grant the claim RPC only to `service_role`; create/update one public storage bucket without anon write policies.
- [x] Mirror the final fields, constraints, function, and bucket setup in the baseline schema for fresh installs.
- [x] Review migration order and SQL grants/policies; static checks confirm first-claim locking, exact comparison, case-insensitive uniqueness, and no password in the RPC result contract. Live database execution remains pending.

### Task 2: Player Edge Function

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/functions/player-api/index.ts`

**Interfaces:**
- Consumes: `POST /functions/v1/player-api` JSON `{action:"profile",username}`; `{action:"login",username,password}`; `{action:"update",username,password,newUsername}`; or multipart `{action:"upload",username,password,kind,file}`.
- Produces: public profile `{username,elo,tier,games_total,profile_image_path,background_image_path,history:[{ended_at,winner,team_a,team_b}]}`. Login/update/upload responses never include a password or database row object.

- [x] Implement CORS and dispatch the four actions using server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment values; disable JWT verification for this public endpoint. The browser sends only the public anon key.
- [x] Public profile queries use explicit selected columns only. Finished history includes date, both teams' player names/usernames, and winner, assembled from explicit game/game_players/player fields.
- [x] Login calls the atomic claim RPC; invalid username/password returns a generic failure and no credential data.
- [x] Update first validates credentials with the claim RPC, then changes only username; rely on the unique DB index for race-safe conflicts.
- [x] Upload validates credentials, kind, MIME allowlist, 5 MiB size cap before buffering, and JPEG/PNG/WebP file signature; writes to the single bucket with a versioned player-specific path and updates only the selected image path.
- [x] Never log request bodies, passwords, service keys, or raw Supabase error objects. Return stable safe error messages.
- [x] Node validation and contract tests pass. Deno/Supabase Edge runtime checks remain pending deployment because the local Supabase stack cannot start without Docker.

### Task 3: Organiser username creation and profile links

**Files:**
- Modify: `app.js`
- Modify: `styles.css` only if a small profile-link style is needed.

**Interfaces:**
- `createPlayer()` inserts `{name,username,tier}`; the database continues to assign Elo and game count.
- Roster rows include `username` only for constructing profile links; passwords are never selected.

- [x] Add username state and an organiser username input to both new-player forms; seed the input from a lowercase name slug while allowing an organiser override.
- [x] Submit the username with the new player insert and show a clear database conflict message when the username is unavailable.
- [x] Add profile links beside setup roster, live court, waiting, and manage player names.
- [x] Keep existing Supabase Auth sign-in, sign-out, organiser checks, game queries, and game-table policies unchanged.
- [x] Node source-contract checks confirm the existing organiser auth calls and profile-safe roster selects remain present. Live organiser sign-in requires the deployed database and was not exercised.

### Task 4: Public profile page and player session

**Files:**
- Create: `profile.html`
- Create: `profile.js`
- Modify: `styles.css`

**Interfaces:**
- Reads profile username from `profile.html?u=<username>`.
- Keeps `{username,password,loggedIn}` only in JavaScript page memory; no localStorage, sessionStorage, cookies, or Supabase Auth session.
- Calls the Edge Function for public view, login, username edit, and uploads.

- [x] Build a responsive profile page using existing theme tokens, with username, Elo, tier, total games, profile/background images, and finished history showing date, teams/players, and winning team.
- [x] Show login on public view and expose edit controls only after a successful player login.
- [x] Allow editing only username and the two image fields. Update the URL after a username change.
- [x] Upload profile and background images using multipart requests to the Edge Function; show validation/access errors without logging credentials.
- [x] Use safe DOM escaping for returned text and public image URLs; link other players' names to their profile pages.
- [x] Node page-contract checks confirm API actions, page-memory credentials, safe escaping, and rendered field coverage. Browser/live API checks remain pending deployment.

### Task 5: Regression and deployment verification

**Files:**
- Create only focused verification scripts if required by the environment; do not add a broad framework.

**Interfaces:**
- Migration is applied before the Edge Function and static client are deployed.

- [x] Static SQL and code-contract checks cover first claim, wrong-password comparison, row locking, username uniqueness, update/upload password checks, public finished-history projection, and organiser-only game-table policies.
- [ ] Run integration checks for concurrent first claims, actual password rejection, update/upload access, public history, storage rejection, and organiser workflow against a disposable Supabase project. The local Supabase stack could not start because Docker is not running; no live test project was configured.
- [x] Document deployment requirements: apply migration, deploy `player-api`, confirm Edge Function secrets, deploy static files, and confirm bucket and CORS settings.
