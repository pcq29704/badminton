import { W, HISTORY_SESSIONS } from "./matchmaking";
import { recordHistory, recordToday, makeLogEntry } from "./history";
export async function loadBasics(db, state, q) {
  const [settings, tiers] = await Promise.all([
    q(db.from("settings").select("*").eq("id", 1).single()),
    q(db.from("tiers").select("*").order("rank")),
  ]);
  state.settings = settings;
  state.tiers = tiers;
  if (!state.tiers.filter((t) => t.seed_elo != null).some((t) => t.code === state.newTier)) state.newTier = state.tiers.filter((t) => t.seed_elo != null)[0]?.code || "";
  await loadRoster(db, state, q);
}

export async function loadRoster(db, state, q) {
  const rows = await q(db.from("players").select("id,name,username,elo,tier,games_total,profile_image_path").eq("active", true).order("name"));
  state.roster = rows.map((p) => ({ ...p, elo: Number(p.elo) }));
}

// Rebuild the whole live session from the database (used on open, after refresh, and after errors)
export async function loadSession(db, state, q, id) {
  const [sess, sps, courts, games, prev] = await Promise.all([
    q(db.from("sessions").select("id,started_at,status,rank_new_games").eq("id", id).single()),
    q(db.from("session_players")
      .select("player_id,games,consec,status,pending_remove,players(id,name,username,elo,tier,games_total,profile_image_path)")
      .eq("session_id", id).is("left_at", null)),
    q(db.from("courts").select("id,court_no,closing,hold_started_at,removed_at").eq("session_id", id).order("court_no")),
    q(db.from("games")
      .select("id,court_id,status,winner,ended_at,ranked,game_players(player_id,team,elo_before,elo_after,tier_before,tier_after,players(name,username))")
      .eq("session_id", id).in("status", ["playing", "finished"]).order("id")),
    q(db.from("sessions").select("id").eq("status", "ended").order("started_at", { ascending: false }).limit(HISTORY_SESSIONS)),
  ]);

  if (sess.status !== "active") { state.session = null; return false; }
  state.session = sess;

  state.names = new Map();
  state.players = sps.map((r) => ({
    id: r.player_id,
    name: r.players.name,
    username: r.players.username,
    profile_image_path: r.players.profile_image_path || "",
    elo: Number(r.players.elo),
    tier: r.players.tier,
    gamesTotal: r.players.games_total,
    games: r.games,
    consec: r.consec,
    status: r.status,
    pendingRemove: r.pending_remove,
    eloStart: Number(r.players.elo),
  }));
  state.players.sort((a, b) => a.name.localeCompare(b.name)); // stable chip order across refreshes
  state.players.forEach((p) => state.names.set(p.id, p.name));

  state.nextCourtNo = Math.max(0, ...courts.map((c) => c.court_no)) + 1;
  const courtNoById = new Map(courts.map((c) => [c.id, c.court_no]));
  state.courts = courts.filter((c) => !c.removed_at).map((c) => ({
    id: c.id, no: c.court_no, closing: c.closing, holdStartedAt: c.hold_started_at, game: null,
  }));

  state.partnerHist = new Map();
  state.matchHist = new Map();
  state.recentMatches = [];
  state.lastPartner = new Map();
  state.log = [];

  // previous sessions: lighter-weight repeat-avoidance
  if (prev.length) {
    const old = await q(db.from("games").select("game_players(player_id,team)")
      .in("session_id", prev.map((s) => s.id)).eq("status", "finished"));
    for (const g of old) {
      const A = g.game_players.filter((r) => r.team === "A").map((r) => r.player_id);
      const B = g.game_players.filter((r) => r.team === "B").map((r) => r.player_id);
      if (A.length === 2 && B.length === 2) recordHistory(state, A, B, W.olderFactor);
    }
  }

  // today's finished games, in the order they finished
  const finished = games.filter((g) => g.status === "finished")
    .sort((a, b) => Date.parse(a.ended_at) - Date.parse(b.ended_at));
  const seen = new Set();
  for (const g of finished) {
    g.game_players.forEach((r) => { if (r.players?.name) state.names.set(r.player_id, r.players.name); });
    const e = makeLogEntry(state, g.id, courtNoById.get(g.court_id), g.winner, g.ended_at, g.game_players);
    e.ranked = g.ranked;
    state.log.push(e);
    recordToday(state, e.teamA.map((p) => p.id), e.teamB.map((p) => p.id));
    for (const p of [...e.teamA, ...e.teamB]) {
      const pl = state.players.find((player) => player.id === p.id);
      if (pl && !seen.has(p.id)) { pl.eloStart = p.before; seen.add(p.id); }
    }
  }

  // games in progress go back onto their courts
  for (const g of games.filter((x) => x.status === "playing")) {
    const court = state.courts.find((c) => c.id === g.court_id);
    if (!court) continue;
    court.game = {
      id: g.id,
      ranked: g.ranked,
      teamA: g.game_players.filter((r) => r.team === "A").map((r) => r.player_id),
      teamB: g.game_players.filter((r) => r.team === "B").map((r) => r.player_id),
    };
  }
  return true;
}

