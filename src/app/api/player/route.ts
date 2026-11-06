import { getAdminClient } from "@/lib/supabase/admin";
import { gamesResponse, imageExtension, rankingResponse, profileResponse, validateImageSize, validateName, validateUsername } from "@/lib/player-api/logic.mjs";
import {
  clearedSessionCookie,
  hashSessionToken,
  newSessionToken,
  readSessionToken,
  REFRESH_AFTER_MS,
  sessionCookie,
  sessionExpiry,
} from "@/lib/player-api/session.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Db = ReturnType<typeof getAdminClient>;

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

// Returns the signed-in player for this request, or null. Refreshes the expiry at most once per 24 hours.
async function requireSession(db: Db, request: Request) {
  const token = readSessionToken(request.headers.get("cookie"));
  if (!token) return null;
  const now = new Date();
  const { data: row, error } = await db.from("player_sessions")
    .select("id,player_id,last_used_at")
    .eq("token_hash", hashSessionToken(token))
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (error || !row) return null;
  const { data: player, error: playerError } = await db.from("players")
    .select("id,name,username")
    .eq("id", row.player_id)
    .maybeSingle();
  if (playerError || !player) return null;

  if (now.getTime() - new Date(row.last_used_at).getTime() >= REFRESH_AFTER_MS) {
    await db.from("player_sessions")
      .update({ last_used_at: now.toISOString(), expires_at: sessionExpiry(now).toISOString() })
      .eq("id", row.id);
  }
  return { player_id: player.id as number, name: (player.name || player.username) as string, username: player.username as string, session_id: row.id as string };
}

// Identifies the viewer for read-only club data: a player session cookie, or an organiser's Supabase access token.
async function requireViewer(db: Db, request: Request) {
  const player = await requireSession(db, request);
  if (player) return { role: "player" as const, name: player.name, username: player.username };
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: organiser } = await db.from("organisers").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!organiser) return null;
  return { role: "organiser" as const, name: data.user.email || "Organiser", username: "" };
}

const GAMES_LIMIT = 1000;

async function clubGames(db: Db) {
  const { data, error } = await db.from("games")
    .select("id,ended_at,winner,score_a,score_b,ranked,courts(court_no),game_players(team,players(name,username))")
    .eq("status", "finished")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(GAMES_LIMIT);
  if (error) return json({ error: "Could not load match history." }, 500);
  return json({ games: gamesResponse(data as any[]) });
}

async function clubRanking(db: Db) {
  const { data, error } = await db.from("players")
    .select("name,username,elo,tier,games_total,profile_image_path")
    .eq("active", true);
  if (error) return json({ error: "Could not load the ranking." }, 500);
  return json({ ranking: rankingResponse(data as any[]) });
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

async function publicProfile(db: Db, rawUsername: unknown) {
  let username: string;
  try { username = validateUsername(rawUsername); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Enter a valid username." }, 400); }
  const { data: player, error: playerError } = await db.from("players")
    .select("id,name,username,elo,tier,games_total,profile_image_path,background_image_path")
    .eq("username", username)
    .maybeSingle();
  if (playerError) return json({ error: "Could not load this profile." }, 500);
  if (!player) return json({ error: "Profile not found." }, 404);

  const { data: appearances, error: appearancesError } = await db.from("game_players")
    .select("game_id,games!inner(id,status)")
    .eq("player_id", player.id)
    .eq("games.status", "finished");
  if (appearancesError) return json({ error: "Could not load this profile." }, 500);

  const gameIds = [...new Set((appearances || []).map((row: { game_id: number }) => row.game_id))];
  let history: ReturnType<typeof profileResponse>["history"] = [];
  if (gameIds.length) {
    const { data: games, error: gamesError } = await db.from("games")
      .select("id,ended_at,winner,score_a,score_b,status,game_players(team,players(name,username,tier,profile_image_path))")
      .in("id", gameIds)
      .eq("status", "finished")
      .order("ended_at", { ascending: false });
    if (gamesError) return json({ error: "Could not load this profile." }, 500);
    history = (games || []).map((game: any) => {
      const players = game.game_players || [];
      const side = (team: string) => players.filter((row: any) => row.team === team)
        .map((row: any) => ({ name: row.players?.name || "Player", username: row.players?.username || "", tier: row.players?.tier || "", profile_image_path: row.players?.profile_image_path || "" }));
      return { ended_at: game.ended_at, winner: game.winner, score_a: game.score_a ?? null, score_b: game.score_b ?? null, team_a: side("A"), team_b: side("B") };
    });
  }
  return json(profileResponse(player, history));
}

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
    if (body.action === "profile") return await publicProfile(db, body.username);
    if (body.action === "update") return await updateUsername(db, request, body);
    if (body.action === "update-name") return await updateName(db, request, body);
    if (body.action === "session") {
      const session = await requireSession(db, request);
      if (!session) return json({ error: SIGN_IN_REQUIRED }, 401);
      return json({ ok: true, username: session.username });
    }
    if (body.action === "viewer" || body.action === "games" || body.action === "ranking") {
      const viewer = await requireViewer(db, request);
      if (!viewer) return json({ error: SIGN_IN_REQUIRED }, 401);
      if (body.action === "viewer") return json({ ok: true, ...viewer });
      return body.action === "games" ? await clubGames(db) : await clubRanking(db);
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
