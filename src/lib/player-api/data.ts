import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { gamesResponse, profileResponse, rankingResponse, validateUsername } from "./logic.mjs";
import { hashSessionToken, REFRESH_AFTER_MS, sessionExpiry } from "./session.mjs";

// Club data reads, shared by the API route and the server-rendered pages.

export type Db = ReturnType<typeof getAdminClient>;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type SessionPlayer = { player_id: number; name: string; username: string; session_id: string };
export type Viewer = { role: "player" | "organiser"; name: string; username: string };

// The player for a session token, or null. Refreshes the expiry at most once per 24 hours.
export async function playerForToken(db: Db, token: string | null): Promise<SessionPlayer | null> {
  if (!token) return null;
  const now = new Date();
  // One query: the session row and its player.
  const { data: row, error } = await db.from("player_sessions")
    .select("id,player_id,last_used_at,players(id,name,username)")
    .eq("token_hash", hashSessionToken(token))
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  const player = (row as any)?.players;
  if (error || !row || !player) return null;
  if (now.getTime() - new Date(row.last_used_at).getTime() >= REFRESH_AFTER_MS) {
    await db.from("player_sessions")
      .update({ last_used_at: now.toISOString(), expires_at: sessionExpiry(now).toISOString() })
      .eq("id", row.id);
  }
  return { player_id: player.id, name: player.name || player.username, username: player.username, session_id: row.id };
}

export function playerViewer(player: SessionPlayer): Viewer {
  return { role: "player", name: player.name, username: player.username };
}

const GAMES_LIMIT = 1000;

export async function loadGames(db: Db) {
  const { data, error } = await db.from("games")
    .select("id,ended_at,winner,ranked,courts(court_no),game_players(team,players(name,username))")
    .eq("status", "finished")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(GAMES_LIMIT);
  if (error) throw new ApiError(500, "Could not load match history.");
  return { games: gamesResponse(data as any[]) };
}

export async function loadRanking(db: Db) {
  const { data, error } = await db.from("players")
    .select("name,username,elo,tier,games_total,profile_image_path")
    .eq("active", true);
  if (error) throw new ApiError(500, "Could not load the ranking.");
  return { ranking: rankingResponse(data as any[]) };
}

export async function loadProfile(db: Db, rawUsername: unknown) {
  let username: string;
  try { username = validateUsername(rawUsername); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : "Enter a valid username."); }
  const { data: player, error: playerError } = await db.from("players")
    .select("id,name,username,elo,tier,games_total,profile_image_path,background_image_path")
    .eq("username", username)
    .maybeSingle();
  if (playerError) throw new ApiError(500, "Could not load this profile.");
  if (!player) throw new ApiError(404, "Profile not found.");

  // One query: every finished game this player was in, with all four players.
  const { data: games, error: gamesError } = await db.from("games")
    .select("id,ended_at,winner,status,me:game_players!inner(player_id),game_players(team,players(name,username,tier,profile_image_path))")
    .eq("me.player_id", player.id)
    .eq("status", "finished")
    .order("ended_at", { ascending: false });
  if (gamesError) throw new ApiError(500, "Could not load this profile.");
  const history = (games || []).map((game: any) => {
    const players = game.game_players || [];
    const side = (team: string) => players.filter((row: any) => row.team === team)
      .map((row: any) => ({ name: row.players?.name || "Player", username: row.players?.username || "", tier: row.players?.tier || "", profile_image_path: row.players?.profile_image_path || "" }));
    return { ended_at: game.ended_at, winner: game.winner, team_a: side("A"), team_b: side("B") };
  });
  return profileResponse(player, history);
}
