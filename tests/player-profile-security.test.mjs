import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20261012000000_player_profiles.sql', import.meta.url), 'utf8');
const edge = await readFile(new URL('../src/app/api/player/route.ts', import.meta.url), 'utf8');
const browser = await readFile(new URL('./fixtures/legacy/profile.js', import.meta.url), 'utf8');
const baseline = await readFile(new URL('../court_balancer_schema.sql', import.meta.url), 'utf8');

test('password claim compares exact text and is only executable by the Edge Function role', () => {
  assert.match(migration, /v_saved_password\s*<>\s*p_password/);
  assert.match(migration, /for\s+update/i);
  assert.match(migration, /revoke all on function public\.claim_player_login\(text, text\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.claim_player_login\(text, text\) to service_role/i);
});

test('public history query includes only finished games and explicit player fields', () => {
  assert.match(edge, /select\(["']id,name,username,elo,tier,games_total,profile_image_path,background_image_path["']\)/);
  assert.match(edge, /\.eq\(["']games\.status["'], ["']finished["']\)/);
  assert.match(edge, /select\(["']id,ended_at,winner,status,game_players\(team,players\(name,username,tier,profile_image_path\)\)["']\)/);
  assert.match(edge, /profileResponse\(player, history\)/);
  const readStart = edge.indexOf('async function publicProfile');
  const readEnd = edge.indexOf('\n}\n\nasync function updateUsername', readStart);
  assert.match(edge.slice(readStart, readEnd), /catch[\s\S]*return json\(\{ error: .*\}, 400\)/);
});

test('image writes require a valid session and update only one image-path column', () => {
  const uploadStart = edge.indexOf('async function uploadImage');
  const uploadEnd = edge.indexOf('\n}\n\nfunction validateMultipartSize', uploadStart);
  const upload = edge.slice(uploadStart, uploadEnd);
  assert.ok(upload.indexOf('requireSession(db, request)') < upload.indexOf('.upload(path'));
  const sizeCheck = upload.indexOf('validateImageSize(file.size)');
  assert.ok(sizeCheck >= 0 && sizeCheck < upload.indexOf('await file.arrayBuffer()'));
  const multipartCheck = edge.indexOf('validateMultipartSize(request)');
  assert.ok(multipartCheck >= 0 && multipartCheck < edge.indexOf('request.formData()'));
  assert.match(upload, /kind === ["']profile["'] \? ["']profile_image_path["'] : ["']background_image_path["']/);
  assert.match(upload, /update\(\{ \[column\]: path \}\)/);
  assert.match(upload, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(browser, /\.storage\.|object\/upload/i);
});

test('anon users cannot write to storage and game tables remain organiser-only', () => {
  assert.doesNotMatch(migration, /create\s+policy[\s\S]*storage\.objects/i);
  for (const table of ['sessions', 'session_players', 'courts', 'games', 'game_players']) {
    assert.match(baseline, new RegExp(`create policy "organiser full access" on public\\.${table}[\\s\\S]*public\\.is_organiser\\(\\)`, 'i'));
  }
});

test('service key is read only by server code', async () => {
  const admin = await readFile(new URL('../src/lib/supabase/admin.ts', import.meta.url), 'utf8');
  assert.match(admin, /import "server-only"/);
  assert.match(admin, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  for (const file of ['src/features/player-profile/api.js', 'src/lib/supabase/client.ts']) {
    assert.doesNotMatch(await readFile(new URL('../' + file, import.meta.url), 'utf8'), /SERVICE_ROLE/);
  }
});

test('browser contains no Supabase service key', () => {
  assert.doesNotMatch(browser, /SERVICE_ROLE|service_role|secret[_-]?key/i);
});

const sessionMigration = await readFile(new URL('../supabase/migrations/20261017120000_player_sessions.sql', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/features/player-profile/api.js', import.meta.url), 'utf8');
const hook = await readFile(new URL('../src/features/player-profile/usePlayerProfile.js', import.meta.url), 'utf8');

test('player sessions table is locked to the service role', () => {
  assert.match(sessionMigration, /create table public\.player_sessions/i);
  assert.match(sessionMigration, /alter table public\.player_sessions enable row level security/i);
  assert.match(sessionMigration, /revoke all on public\.player_sessions from anon, authenticated/i);
  assert.doesNotMatch(sessionMigration, /create\s+policy/i);
});

test('login sets the session cookie and session/logout actions exist', () => {
  const loginStart = edge.indexOf('if (body.action !== "login")');
  assert.ok(loginStart > 0);
  assert.match(edge.slice(loginStart), /"Set-Cookie": sessionCookie\(token\)/);
  assert.match(edge, /body\.action === "session"/);
  assert.match(edge, /body\.action === "logout"/);
});

test('cross-site origins are blocked before any write', () => {
  assert.match(edge, /isCrossSiteOrigin\(request\)\) return json\(\{ error: REQUEST_BLOCKED \}, 403\)/);
  const updateStart = edge.indexOf('async function updateUsername');
  const updateEnd = edge.indexOf('\n}\n\nasync function uploadImage', updateStart);
  const update = edge.slice(updateStart, updateEnd);
  assert.ok(update.indexOf('isCrossSiteOrigin') < update.indexOf('requireSession'));
});

test('update and upload no longer accept a password or username from the client', () => {
  const updateStart = edge.indexOf('async function updateUsername');
  const updateEnd = edge.indexOf('\n}\n\nasync function uploadImage', updateStart);
  assert.doesNotMatch(edge.slice(updateStart, updateEnd), /body\.password|body\.username/);
  const uploadStart = edge.indexOf('async function uploadImage');
  const uploadEnd = edge.indexOf('\n}\n\nfunction validateMultipartSize', uploadStart);
  assert.doesNotMatch(edge.slice(uploadStart, uploadEnd), /form\.get\("password"\)|form\.get\("username"\)/);
});

test('browser never sends the password for update or upload', () => {
  assert.doesNotMatch(api, /password/);
  assert.match(hook, /postPlayerJson\("session"/);
  assert.match(hook, /postPlayerJson\("logout"/);
  assert.match(hook, /postPlayerJson\("update", \{ newUsername/);
});
