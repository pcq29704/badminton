import { getAdminClient } from "@/lib/supabase/admin";
import { imageExtension, validateImageSize, validateName, validateUsername } from "@/lib/player-api/logic.mjs";
import { ApiError, loadGames, loadProfile, loadRanking, playerForToken, playerViewer, type Db } from "@/lib/player-api/data";
import {
  clearedSessionCookie,
  hashSessionToken,
  newSessionToken,
  readSessionToken,
  sessionCookie,
  sessionExpiry,
} from "@/lib/player-api/session.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function authenticate(db: Db, username: string, password: string) {
  const { data, error } = await db.rpc("claim_player_login", {
    p_username: username,
    p_password: password,
  });
  if (error || !Array.isArray(data) || !data[0]?.player_id) return null;
  return { player_id: data[0].player_id as number, username: data[0].username as string };
}

// Creates a session row and returns the raw token. Only the hash is stored.
async function createSession(db: Db, playerId: number) {
  const now = new Date();
  await db.from("player_sessions").delete().eq("player_id", playerId).lt("expires_at", now.toISOString());
  const token = newSessionToken();
  const { error } = await db.from("player_sessions").insert({
    player_id: playerId,
    token_hash: hashSessionToken(token),
    expires_at: sessionExpiry(now).toISOString(),
  });
  return error ? null : token;
}

// Returns the signed-in player for this request, or null.
function requireSession(db: Db, request: Request) {
  return playerForToken(db, readSessionToken(request.headers.get("cookie")));
}

// Identifies the viewer for read-only club data: a player session cookie, or an organiser's Supabase access token.
async function requireViewer(db: Db, request: Request) {
  const player = await requireSession(db, request);
  if (player) return playerViewer(player);
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: organiser } = await db.from("organisers").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!organiser) return null;
  return { role: "organiser" as const, name: data.user.email || "Organiser", username: "" };
}

// Turns a data-layer result into a JSON response.
async function respond(load: () => Promise<unknown>) {
  try { return json(await load()); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    throw error;
  }
}

async function deleteSession(db: Db, request: Request) {
  const token = readSessionToken(request.headers.get("cookie"));
  if (!token) return;
  await db.from("player_sessions").delete().eq("token_hash", hashSessionToken(token));
}

// Blocks cross-site writes. A missing Origin header is allowed (same-site requests from older browsers).
function isCrossSiteOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

const SIGN_IN_REQUIRED = "Sign in to continue.";
const REQUEST_BLOCKED = "Request blocked.";

async function updateUsername(db: Db, request: Request, body: Record<string, unknown>) {
  if (isCrossSiteOrigin(request)) return json({ error: REQUEST_BLOCKED }, 403);
  const session = await requireSession(db, request);
  if (!session) return json({ error: SIGN_IN_REQUIRED }, 401);
  let newUsername: string;
  try {
    newUsername = validateUsername(body.newUsername);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Enter a valid username." }, 400);
  }
  const { data, error } = await db.from("players").update({ username: newUsername })
    .eq("id", session.player_id).select("username").single();
  if (error?.code === "23505") return json({ error: "That username is unavailable." }, 409);
  if (error || !data) return json({ error: "Could not update this profile." }, 500);
  return json({ ok: true, username: data.username });
}

async function updateName(db: Db, request: Request, body: Record<string, unknown>) {
  if (isCrossSiteOrigin(request)) return json({ error: REQUEST_BLOCKED }, 403);
  const session = await requireSession(db, request);
  if (!session) return json({ error: SIGN_IN_REQUIRED }, 401);
  let newName: string;
  try {
    newName = validateName(body.newName);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Enter a valid name." }, 400);
  }
  const { data, error } = await db.from("players").update({ name: newName })
    .eq("id", session.player_id).select("name").single();
  if (error?.code === "23505") return json({ error: "That name is already used by another player." }, 409);
  if (error || !data) return json({ error: "Could not update this profile." }, 500);
  return json({ ok: true, name: data.name });
}

async function uploadImage(db: Db, request: Request, form: FormData) {
  if (isCrossSiteOrigin(request)) return json({ error: REQUEST_BLOCKED }, 403);
  const session = await requireSession(db, request);
  if (!session) return json({ error: SIGN_IN_REQUIRED }, 401);
  const kind = form.get("kind");
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Invalid image." }, 400);
  if (kind !== "profile" && kind !== "background") return json({ error: "Choose a profile or background image." }, 400);

  try { validateImageSize(file.size); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Images must be 5 MB or smaller." }, 400); }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let extension: string;
  try { extension = imageExtension(file.type, file.size, bytes); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Choose a valid image." }, 400); }

  const column = kind === "profile" ? "profile_image_path" : "background_image_path";
  const { data: previous, error: previousError } = await db.from("players").select(column)
    .eq("id", session.player_id).single<Record<string, string | null>>();
  if (previousError) return json({ error: "Could not save this image." }, 500);

  const path = `${session.player_id}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await db.storage.from("player-profile-images").upload(path, bytes, {
    contentType: file.type,
    upsert: true,
    cacheControl: "3600",
  });
  if (uploadError) return json({ error: "Could not upload this image." }, 500);
  const { error: updateError } = await db.from("players").update({ [column]: path }).eq("id", session.player_id);
  if (updateError) {
    await db.storage.from("player-profile-images").remove([path]);
    return json({ error: "Could not save this image." }, 500);
  }
  if (previous?.[column] && previous[column] !== path) {
    await db.storage.from("player-profile-images").remove([previous[column]]);
  }
  return json({ ok: true, kind, path });
}

function validateMultipartSize(request: Request) {
  const value = request.headers.get("content-length");
  if (!value) return true;
  const length = Number(value);
  return Number.isSafeInteger(length) && length <= 5 * 1024 * 1024 + 64 * 1024;
}

export async function POST(request: Request) {
  try {
    const db = getAdminClient();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (isCrossSiteOrigin(request)) return json({ error: REQUEST_BLOCKED }, 403);
      if (!validateMultipartSize(request)) return json({ error: "Images must be 5 MB or smaller." }, 413);
      const form = await request.formData();
      if (form.get("action") !== "upload") return json({ error: "Unsupported request." }, 400);
      return await uploadImage(db, request, form);
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request." }, 400);
    if (body.action === "profile") return await respond(() => loadProfile(db, body.username));
    if (body.action === "update") return await updateUsername(db, request, body);
    if (body.action === "update-name") return await updateName(db, request, body);
    if (body.action === "session") {
      const session = await requireSession(db, request);
      if (!session) return json({ error: SIGN_IN_REQUIRED }, 401);
      return json({ ok: true, username: session.username });
    }
    if (["viewer", "games", "ranking", "club"].includes(body.action)) {
      const viewer = await requireViewer(db, request);
      if (!viewer) return json({ error: SIGN_IN_REQUIRED }, 401);
      if (body.action === "viewer") return json({ ok: true, ...viewer });
      if (body.action === "games") return await respond(() => loadGames(db));
      if (body.action === "ranking") return await respond(() => loadRanking(db));
      // One round trip for a whole club page: viewer, games and ranking.
      return await respond(async () => {
        const [{ games }, { ranking }] = await Promise.all([loadGames(db), loadRanking(db)]);
        return { viewer: { ok: true, ...viewer }, games, ranking };
      });
    }
    if (body.action === "logout") {
      await deleteSession(db, request);
      return json({ ok: true }, 200, { "Set-Cookie": clearedSessionCookie() });
    }
    if (body.action !== "login") return json({ error: "Unsupported request." }, 400);

    let username: string;
    try { username = validateUsername(body.username); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Enter a valid username." }, 400); }
    if (typeof body.password !== "string" || !body.password) return json({ error: "Invalid username or password." }, 401);
    const player = await authenticate(db, username, body.password);
    if (!player) return json({ error: "Invalid username or password." }, 401);
    const token = await createSession(db, player.player_id);
    if (!token) throw new Error("session insert failed");
    return json({ ok: true, username: player.username }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    // Message only: never log the request body, form data, usernames, passwords or cookie values.
    console.error("[player-api]", error instanceof Error ? error.message : "unexpected error");
    return json({ error: "The player service is unavailable. Try again." }, 500);
  }
}
