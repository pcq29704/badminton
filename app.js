// =====================================================================
// Court Balancer v8 — Supabase edition
// One organiser phone runs the session. Every action is saved to the
// database, so a refresh or a flat battery no longer loses the day.
// config.js must define SUPABASE_URL and SUPABASE_ANON_KEY.
// =====================================================================

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------- matchmaking weights (lower score = better game) ----------------
const W = {
  aheadSoft: 40,       // per game a player is ahead of the least-played person
  aheadHard: 300,      // extra per game beyond 1 ahead (effectively a hard block)
  streak: 15,          // per game in a player's current back-to-back streak
  keen: -350,          // ⚡ wants to play
  partnerRepeat: 45,   // per previous time this duo partnered
  matchRepeat: 45,     // per previous time this exact 2v2 happened
  olderFactor: 0.5,    // previous sessions count at half weight
  recentPartner: 120,  // these two were partners in their latest game today
  recentRematch: 500,  // this exact 2v2 was one of the last few games today
  remixAvoid: 1000,    // ↻ Remix should give a different game, not the same one
};
const HISTORY_SESSIONS = 3; // how many previous sessions feed repeat-avoidance

// ---------------- state ----------------
let state = {
  phase: "loading",       // loading | login | not-organiser | error | setup | play
  user: null,
  errorMsg: "",
  busy: false,
  toast: null,            // {kind:'info'|'error', html, gameId?}
  loginEmail: "", loginPassword: "",
  settings: null,
  tiers: [],              // rows from the tiers table, strongest first
  roster: [],             // every active player in the database
  // setup screen
  setupCourts: 2, picked: new Set(), newName: "", newTier: "B",
  // live session
  session: null,
  players: [],            // here today: {id,name,elo,tier,gamesTotal,games,consec,status,pendingRemove,eloStart}
  courts: [],             // {id,no,game:{id,teamA:[id,id],teamB:[id,id]}|null,closing,holdStartedAt}
  nextCourtNo: 1,
  partnerHist: new Map(), // pairKey  -> weighted times partnered
  matchHist: new Map(),   // matchKey -> weighted times played
  recentMatches: [],      // matchKeys of today's finished games, oldest first
  lastPartner: new Map(), // playerId -> partner in their latest finished game today
  log: [],                // today's finished games, oldest first
  names: new Map(),       // id -> name (includes people who have left)
  // panels
  showStats: false, showLog: false, showHelp: false, showManage: false, helpLang: "en",
  addExistingId: "",
};

// ---------------- helpers ----------------
const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
const matchKey = (A, B) => [pairKey(A[0], A[1]), pairKey(B[0], B[1])].sort((x, y) => x.localeCompare(y)).join("||");
const cnt = (m, k) => m.get(k) || 0;
const inc = (m, k, w = 1) => m.set(k, cnt(m, k) + w);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const byId = (id) => state.players.find((p) => p.id === id);
const courtByNo = (no) => state.courts.find((c) => c.no === no);
const nameOf = (id) => byId(id)?.name || state.names.get(id) || "?";
const holdMs = () => (state.settings?.hold_minutes ?? 10) * 60000;
const signed = (d) => { const r = Math.round(d); return (r > 0 ? "+" : r < 0 ? "−" : "±") + Math.abs(r); };
const nowIso = () => new Date().toISOString();
const seedTiers = () => state.tiers.filter((t) => t.seed_elo != null);
const tierBadge = (code) => (code ? `<span class="tier t-${esc(code)}">${esc(code)}</span>` : "");

const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

// A problem the organiser can fix (e.g. a missing name) — shown as-is, not as a save failure.
class Oops extends Error {}

// Supabase calls return {data, error}. This turns an error into a thrown exception.
async function q(promise) {
  const { data, error } = await promise;
  if (error) {
    // P0001 = a rule in the database said no (e.g. "too late to correct") — not a connection problem
    if (error.code === "P0001") throw new Oops(error.message);
    throw new Error(error.message || String(error));
  }
  return data;
}

// Run an action that talks to the database: shows "Saving…", blocks double taps,
// and on any failure shows the error and reloads the session so the screen
// matches what's actually saved.
async function run(fn) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await fn();
  } catch (e) {
    if (e instanceof Oops) { showToast("error", esc(e.message)); return; }
    console.error(e);
    showToast("error", "Couldn't save: " + esc(e.message || e) + "<br><small>Check your signal and try again.</small>");
    if (state.session) {
      try { await loadSession(state.session.id); } catch (_) { /* still offline */ }
    }
  } finally {
    state.busy = false;
    render();
  }
}

let toastTimer = null;
function showToast(kind, html, gameId) {
  state.toast = { kind, html, gameId };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = null; toastTimer = null; render(); }, kind === "error" ? 15000 : 12000);
}
function hideToast() {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  state.toast = null;
  render();
}

// ---------------- matchmaking ----------------
// ids of players currently on any court
function playingIds() {
  const s = new Set();
  for (const c of state.courts) {
    if (c.game) [...c.game.teamA, ...c.game.teamB].forEach((id) => s.add(id));
  }
  return s;
}

// players who can be picked for a new game right now
function freeCandidates() {
  const busy = playingIds();
  return state.players.filter((p) => p.status !== "break" && !p.pendingRemove && !busy.has(p.id));
}

// Score how good a 2v2 split is. Balance (by Elo), then fresh partners and matchups.
function scoreGame(A, B, avoidKey) {
  const gap = Math.abs(A[0].elo + A[1].elo - B[0].elo - B[1].elo);
  let s = Math.max(0, gap - (state.settings?.balance_deadzone ?? 30)); // small gaps count as balanced
  const kA = pairKey(A[0].id, A[1].id);
  const kB = pairKey(B[0].id, B[1].id);
  const mk = matchKey([A[0].id, A[1].id], [B[0].id, B[1].id]);
  s += (cnt(state.partnerHist, kA) + cnt(state.partnerHist, kB)) * W.partnerRepeat;
  s += cnt(state.matchHist, mk) * W.matchRepeat;
  if (state.lastPartner.get(A[0].id) === A[1].id) s += W.recentPartner;
  if (state.lastPartner.get(B[0].id) === B[1].id) s += W.recentPartner;
  if (state.recentMatches.slice(-Math.max(2, state.courts.length)).includes(mk)) s += W.recentRematch;
  if (mk === avoidKey) s += W.remixAvoid;
  return s;
}

// Best of the 3 possible doubles splits for a fixed group of 4
function bestPairing(four, avoidKey) {
  let best = null;
  for (const [aIdx, bIdx] of PAIRINGS) {
    const t1 = [four[aIdx[0]], four[aIdx[1]]];
    const t2 = [four[bIdx[0]], four[bIdx[1]]];
    const s = scoreGame(t1, t2, avoidKey);
    if (!best || s < best.s) best = { t1, t2, s };
  }
  return best;
}

function* combos4(arr) {
  const n = arr.length;
  for (let a = 0; a < n - 3; a++)
    for (let b = a + 1; b < n - 2; b++)
      for (let c = b + 1; c < n - 1; c++)
        for (let d = c + 1; d < n; d++)
          yield [arr[a], arr[b], arr[c], arr[d]];
}

// Choose the best game from free players. Who plays: fewest games > ⚡ keen > shortest streak.
// How they split: Elo balance, then repeat-avoidance. Returns team ids, or null if < 4 free.
function pickGame(avoidKey) {
  const cands = freeCandidates();
  if (cands.length < 4) return null;
  const minGames = Math.min(...cands.map((p) => p.games));
  let best = null;
  for (const combo of combos4(cands)) {
    let fairness = 0;
    for (const p of combo) {
      const ahead = p.games - minGames;
      fairness += Math.max(0, ahead - 1) * W.aheadHard + ahead * W.aheadSoft;
      fairness += p.consec * W.streak;
      if (p.status === "keen") fairness += W.keen;
    }
    const bp = bestPairing(combo, avoidKey);
    const total = fairness + bp.s + Math.random() * 5; // NOSONAR tiny noise so ties rotate
    if (!best || total < best.total) {
      best = { total, teamA: bp.t1.map((p) => p.id), teamB: bp.t2.map((p) => p.id) };
    }
  }
  return best;
}

// ---------------- history bookkeeping ----------------
function recordHistory(teamA, teamB, weight) {
  inc(state.partnerHist, pairKey(teamA[0], teamA[1]), weight);
  inc(state.partnerHist, pairKey(teamB[0], teamB[1]), weight);
  inc(state.matchHist, matchKey(teamA, teamB), weight);
}
function recordToday(teamA, teamB) {
  recordHistory(teamA, teamB, 1);
  state.recentMatches.push(matchKey(teamA, teamB));
  state.lastPartner.set(teamA[0], teamA[1]); state.lastPartner.set(teamA[1], teamA[0]);
  state.lastPartner.set(teamB[0], teamB[1]); state.lastPartner.set(teamB[1], teamB[0]);
}

// Turn game_players rows into a log entry
function makeLogEntry(gameId, courtNo, winner, endedAt, rows) {
  const side = (t) => rows.filter((r) => r.team === t).map((r) => ({
    id: r.player_id,
    name: r.players?.name || nameOf(r.player_id),
    before: Number(r.elo_before),
    after: Number(r.elo_after),
    tierBefore: r.tier_before,
    tierAfter: r.tier_after,
  }));
  return { gameId, courtNo, winner, endedAt, teamA: side("A"), teamB: side("B") };
}

// Apply new ratings returned by finish_game / correct_result
function applyRatingRows(rows) {
  for (const r of rows) {
    const elo = Number(r.elo_after);
    const p = byId(r.player_id);
    if (p) { p.elo = elo; p.tier = r.tier_after; }
    const rp = state.roster.find((x) => x.id === r.player_id);
    if (rp) { rp.elo = elo; rp.tier = r.tier_after; }
  }
}

// ---------------- loading from the database ----------------
async function loadBasics() {
  const [settings, tiers] = await Promise.all([
    q(db.from("settings").select("*").eq("id", 1).single()),
    q(db.from("tiers").select("*").order("rank")),
  ]);
  state.settings = settings;
  state.tiers = tiers;
  if (!seedTiers().some((t) => t.code === state.newTier)) state.newTier = seedTiers()[0]?.code || "";
  await loadRoster();
}

async function loadRoster() {
  const rows = await q(db.from("players").select("id,name,elo,tier,games_total").eq("active", true).order("name"));
  state.roster = rows.map((p) => ({ ...p, elo: Number(p.elo) }));
}

// Rebuild the whole live session from the database (used on open, after refresh, and after errors)
async function loadSession(id) {
  const [sess, sps, courts, games, prev] = await Promise.all([
    q(db.from("sessions").select("id,started_at,status").eq("id", id).single()),
    q(db.from("session_players")
      .select("player_id,games,consec,status,pending_remove,players(id,name,elo,tier,games_total)")
      .eq("session_id", id).is("left_at", null)),
    q(db.from("courts").select("id,court_no,closing,hold_started_at,removed_at").eq("session_id", id).order("court_no")),
    q(db.from("games")
      .select("id,court_id,status,winner,ended_at,game_players(player_id,team,elo_before,elo_after,tier_before,tier_after,players(name))")
      .eq("session_id", id).in("status", ["playing", "finished"]).order("id")),
    q(db.from("sessions").select("id").eq("status", "ended").order("started_at", { ascending: false }).limit(HISTORY_SESSIONS)),
  ]);

  if (sess.status !== "active") { state.session = null; return false; }
  state.session = sess;

  state.names = new Map();
  state.players = sps.map((r) => ({
    id: r.player_id,
    name: r.players.name,
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
      if (A.length === 2 && B.length === 2) recordHistory(A, B, W.olderFactor);
    }
  }

  // today's finished games, in the order they finished
  const finished = games.filter((g) => g.status === "finished")
    .sort((a, b) => Date.parse(a.ended_at) - Date.parse(b.ended_at));
  const seen = new Set();
  for (const g of finished) {
    g.game_players.forEach((r) => { if (r.players?.name) state.names.set(r.player_id, r.players.name); });
    const e = makeLogEntry(g.id, courtNoById.get(g.court_id), g.winner, g.ended_at, g.game_players);
    state.log.push(e);
    recordToday(e.teamA.map((p) => p.id), e.teamB.map((p) => p.id));
    for (const p of [...e.teamA, ...e.teamB]) {
      const pl = byId(p.id);
      if (pl && !seen.has(p.id)) { pl.eloStart = p.before; seen.add(p.id); }
    }
  }

  // games in progress go back onto their courts
  for (const g of games.filter((x) => x.status === "playing")) {
    const court = state.courts.find((c) => c.id === g.court_id);
    if (!court) continue;
    court.game = {
      id: g.id,
      teamA: g.game_players.filter((r) => r.team === "A").map((r) => r.player_id),
      teamB: g.game_players.filter((r) => r.team === "B").map((r) => r.player_id),
    };
  }
  return true;
}

// ---------------- sign in ----------------
async function init() {
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      Object.assign(state, { phase: "login", user: null, session: null, players: [], courts: [] });
      render();
    }
  });
  const { data } = await db.auth.getSession();
  if (!data.session) { state.phase = "login"; render(); return; }
  await afterLogin(data.session.user);
}

async function afterLogin(user) {
  state.user = user;
  state.phase = "loading";
  render();
  try {
    const org = await q(db.from("organisers").select("user_id").eq("user_id", user.id));
    if (!org.length) { state.phase = "not-organiser"; render(); return; }
    await loadBasics();
    const active = await q(db.from("sessions").select("id").eq("status", "active").limit(1));
    if (active.length && await loadSession(active[0].id)) {
      // a hold may have expired while the app was closed; settle that before showing the board
      try { await checkHolds(); } catch (e) { console.error(e); /* the ticker retries */ }
      state.phase = "play";
    } else {
      await enterSetup();
    }
  } catch (e) {
    console.error(e);
    state.phase = "error";
    state.errorMsg = e.message || String(e);
  }
  render();
}

function updateLoginEmail(v) { state.loginEmail = v; }
function updateLoginPassword(v) { state.loginPassword = v; }

async function login() {
  if (state.busy) return;
  const email = state.loginEmail.trim();
  if (!email || !state.loginPassword) { showToast("error", "Enter your email and password."); render(); return; }
  state.busy = true; render();
  const { data, error } = await db.auth.signInWithPassword({ email, password: state.loginPassword });
  state.busy = false;
  if (error) { showToast("error", esc(error.message)); render(); return; }
  state.loginPassword = "";
  await afterLogin(data.user);
}

async function signOut() {
  if (state.session && !confirm("Sign out? The session stays saved and continues when you sign in again.")) return;
  await db.auth.signOut();
}

function retryLoad() { if (state.user) void afterLogin(state.user); else void init(); }

// ---------------- setup screen ----------------
async function enterSetup() {
  await loadRoster();
  state.session = null;
  state.players = [];
  state.courts = [];
  state.picked = new Set();
  // pre-tick everyone who came to the last session
  const last = await q(db.from("sessions").select("id,session_players(player_id)")
    .eq("status", "ended").order("started_at", { ascending: false }).limit(1));
  if (last.length) {
    for (const r of last[0].session_players) {
      if (state.roster.some((p) => p.id === r.player_id)) state.picked.add(r.player_id);
    }
  }
  state.phase = "setup";
}

function bumpCourts(d) { state.setupCourts = Math.max(1, Math.min(6, state.setupCourts + d)); render(); }
function togglePick(id) { state.picked.has(id) ? state.picked.delete(id) : state.picked.add(id); render(); }
function pickAll() { state.picked = new Set(state.roster.map((p) => p.id)); render(); }
function pickNone() { state.picked = new Set(); render(); }
function updateNewName(v) { state.newName = v; }
function updateNewTier(v) { state.newTier = v; }

// Create a brand-new player in the database (their Elo comes from the chosen tier)
async function createPlayer() {
  const name = state.newName.trim();
  if (!name) throw new Oops("Type a name first.");
  if (state.roster.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Oops(`${name} is already in your player list.`);
  }
  const row = await q(db.from("players").insert({ name, tier: state.newTier })
    .select("id,name,elo,tier,games_total").single());
  const p = { ...row, elo: Number(row.elo) };
  state.roster.push(p);
  state.roster.sort((a, b) => a.name.localeCompare(b.name));
  state.newName = "";
  return p;
}

function addNewPlayerAtSetup() {
  void run(async () => {
    const p = await createPlayer();
    state.picked.add(p.id);
  });
}

function startDay() {
  void run(async () => {
    const ids = state.roster.filter((p) => state.picked.has(p.id)).map((p) => p.id);
    if (ids.length < 4) throw new Oops("Tick at least 4 players to start.");
    const sess = await q(db.from("sessions").insert({ status: "active" }).select("id").single());
    await q(db.from("session_players").insert(ids.map((pid) => ({ session_id: sess.id, player_id: pid }))));
    await q(db.from("courts").insert(
      Array.from({ length: state.setupCourts }, (_, i) => ({ session_id: sess.id, court_no: i + 1 }))));
    await loadSession(sess.id);
    state.phase = "play";
    await fillEmptyCourts();
  });
}

// ---------------- play: filling courts ----------------
async function fillCourt(court, avoidKey) {
  const pick = pickGame(avoidKey);
  if (!pick) return false;
  const gameId = await q(db.rpc("start_game", {
    p_court_id: court.id, p_team_a: pick.teamA, p_team_b: pick.teamB,
  }));
  court.game = { id: gameId, teamA: pick.teamA, teamB: pick.teamB };
  court.holdStartedAt = null;
  // same as the server: anyone free who wasn't picked is resting, so their streak resets
  const busy = playingIds();
  state.players.forEach((p) => { if (p.status !== "break" && !busy.has(p.id)) p.consec = 0; });
  return true;
}

// Fill every court that is empty, open, and not in its waiting window
async function fillEmptyCourts() {
  for (const court of state.courts) {
    if (!court.game && !court.closing && !court.holdStartedAt) await fillCourt(court);
  }
}

// ---------------- the waiting window ("hold") ----------------
// A court that finishes while others are still playing waits (up to hold_minutes)
// for a second court to finish, so the next games are drawn from a bigger pool.
// The start time is saved on the court, so the countdown survives a refresh.
async function holdCourtForSync(court) {
  if (state.courts.some((c) => c !== court && c.holdStartedAt && !c.game)) {
    await releaseHolds(); // another court was already waiting: release both now
    return;
  }
  const othersPlaying = state.courts.some((c) => c !== court && c.game && !c.closing);
  if (!othersPlaying) { await fillCourt(court); return; }
  const t = nowIso();
  await q(db.from("courts").update({ hold_started_at: t }).eq("id", court.id));
  court.holdStartedAt = t;
}

async function releaseHolds() {
  const held = state.courts.filter((c) => c.holdStartedAt);
  if (held.length) {
    await q(db.from("courts").update({ hold_started_at: null }).in("id", held.map((c) => c.id)));
    held.forEach((c) => { c.holdStartedAt = null; });
  }
  await fillEmptyCourts();
}

// Release holds that have run out of time, or that have nothing left to wait for
// (e.g. the only other court just closed).
async function checkHolds() {
  const held = state.courts.filter((c) => c.holdStartedAt && !c.game);
  if (!held.length) return;
  const othersPlaying = state.courts.some((c) => c.game && !c.closing);
  const expired = held.some((c) => Date.now() - Date.parse(c.holdStartedAt) >= holdMs());
  if (!othersPlaying || expired) await releaseHolds();
}

function fillNow() { void run(releaseHolds); }

function holdExpiredSomewhere() {
  return state.courts.some((c) => c.holdStartedAt && !c.game && Date.now() - Date.parse(c.holdStartedAt) >= holdMs());
}

function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// Countdown ticker. Works off saved timestamps, so a phone that slept just catches up.
function tick() {
  if (state.phase !== "play") return;
  document.querySelectorAll("[data-hold]").forEach((el) => {
    el.textContent = fmtLeft(Date.parse(el.dataset.hold) + holdMs() - Date.now());
  });
  if (!state.busy && holdExpiredSomewhere()) void run(checkHolds);
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

// ---------------- play: results ----------------
function finishCourt(no, winner) {
  void run(async () => {
    const court = courtByNo(no);
    if (!court || !court.game) return;
    const g = court.game;
    const rows = await q(db.rpc("finish_game", { p_game_id: g.id, p_winner: winner }));
    applyRatingRows(rows);

    const played = new Set([...g.teamA, ...g.teamB]);
    state.players.forEach((p) => {
      if (played.has(p.id)) { p.games++; p.consec++; p.gamesTotal++; }
    });
    const entry = makeLogEntry(g.id, court.no, winner, nowIso(), rows);
    state.log.push(entry);
    recordToday(g.teamA, g.teamB);
    court.game = null;
    showResultToast(entry, false);

    // players who asked to leave drop out now that their game is over
    const leaving = state.players.filter((p) => p.pendingRemove && played.has(p.id));
    for (const p of leaving) {
      await q(db.from("session_players").update({ left_at: nowIso() })
        .eq("session_id", state.session.id).eq("player_id", p.id));
    }
    state.players = state.players.filter((p) => !leaving.includes(p));

    if (court.closing) {
      await removeCourt(court);
      await checkHolds();
    } else {
      await holdCourtForSync(court);
    }
  });
}

function showResultToast(e, corrected) {
  const winners = e.winner === "A" ? e.teamA : e.teamB;
  const parts = [...e.teamA, ...e.teamB].map((p) => {
    const d = p.after - p.before;
    const tierMove = p.tierAfter && p.tierAfter !== p.tierBefore
      ? ` <span class="tier-move">${esc(p.tierBefore)}→${esc(p.tierAfter)}</span>` : "";
    return `${esc(p.name)} <span class="delta ${d >= 0 ? "up" : "down"}">${signed(d)}</span>${tierMove}`;
  });
  showToast("info",
    `<div class="toast-title">${corrected ? "Corrected — " : ""}Court ${e.courtNo}: ${winners.map((p) => esc(p.name)).join(" & ")} won</div>` +
    `<div class="toast-body">${parts.join(" · ")}</div>`,
    e.gameId);
}

// Fix a result where the wrong side was tapped
function correctResult(gameId) {
  const e = state.log.find((x) => x.gameId === gameId);
  if (!e) return;
  const newWinner = e.winner === "A" ? "B" : "A";
  const newNames = (newWinner === "A" ? e.teamA : e.teamB).map((p) => p.name).join(" & ");
  if (!confirm(`Change the result of game #${state.log.indexOf(e) + 1} so that ${newNames} won?`)) return;
  void run(async () => {
    const rows = await q(db.rpc("correct_result", { p_game_id: gameId, p_winner: newWinner }));
    applyRatingRows(rows);
    const fresh = makeLogEntry(gameId, e.courtNo, newWinner, e.endedAt, rows);
    Object.assign(e, { winner: newWinner, teamA: fresh.teamA, teamB: fresh.teamB });
    showResultToast(e, true);
  });
}

// ---------------- play: players ----------------
// Tap a chip: normal -> keen -> break -> normal
function cycleStatus(id) {
  void run(async () => {
    const p = byId(id);
    if (!p) return;
    const next = p.status === "normal" ? "keen" : p.status === "keen" ? "break" : "normal";
    await q(db.from("session_players").update({ status: next })
      .eq("session_id", state.session.id).eq("player_id", id));
    p.status = next;
    await fillEmptyCourts(); // someone back from a break may complete a waiting court
  });
}

function removePlayer(id) {
  const p = byId(id);
  if (!p) return;
  if (playingIds().has(id)) {
    // on court: flag them to leave once this game ends (tap again to undo)
    void run(async () => {
      await q(db.from("session_players").update({ pending_remove: !p.pendingRemove })
        .eq("session_id", state.session.id).eq("player_id", id));
      p.pendingRemove = !p.pendingRemove;
    });
    return;
  }
  if (!confirm(`Remove ${p.name} from today's session?`)) return;
  void run(async () => {
    await q(db.from("session_players").update({ left_at: nowIso() })
      .eq("session_id", state.session.id).eq("player_id", id));
    state.players = state.players.filter((x) => x.id !== id);
  });
}

// Bring someone into today's session (also works for people who left and came back)
async function joinSession(playerId) {
  await q(db.from("session_players").upsert(
    { session_id: state.session.id, player_id: playerId, left_at: null, pending_remove: false, status: "normal" },
    { onConflict: "session_id,player_id" }));
  await loadSession(state.session.id);
  await fillEmptyCourts();
}

function updateAddExisting(v) { state.addExistingId = v; }
function addExistingPlayer() {
  const id = Number(state.addExistingId);
  if (!id) return;
  void run(async () => { state.addExistingId = ""; await joinSession(id); });
}
function addNewPlayerDuringPlay() {
  void run(async () => { const p = await createPlayer(); await joinSession(p.id); });
}

// ---------------- play: courts ----------------
async function removeCourt(court) {
  await q(db.from("courts").update({ removed_at: nowIso(), hold_started_at: null }).eq("id", court.id));
  state.courts = state.courts.filter((c) => c !== court);
}

function addCourt() {
  void run(async () => {
    const row = await q(db.from("courts").insert({ session_id: state.session.id, court_no: state.nextCourtNo })
      .select("id,court_no").single());
    state.nextCourtNo++;
    state.courts.push({ id: row.id, no: row.court_no, closing: false, holdStartedAt: null, game: null });
    await fillEmptyCourts();
  });
}

// A court's booking ended. Idle: remove now. Mid-game: close after this game (tap again to cancel).
function endCourt(no) {
  const court = courtByNo(no);
  if (!court) return;
  if (!court.game) {
    if (!confirm(`Remove Court ${no}? It isn't playing right now.`)) return;
    void run(async () => { await removeCourt(court); await checkHolds(); });
    return;
  }
  void run(async () => {
    await q(db.from("courts").update({ closing: !court.closing }).eq("id", court.id));
    court.closing = !court.closing;
  });
}

// ↻ Remix: throw away an unplayed game and draw a different one. Never touches Elo.
function reshuffleCourt(no) {
  void run(async () => {
    const court = courtByNo(no);
    if (!court || !court.game || court.closing) return;
    const old = court.game;
    await q(db.rpc("remix_game", { p_game_id: old.id }));
    court.game = null;
    await fillCourt(court, matchKey(old.teamA, old.teamB));
  });
}

function reshuffleAll() {
  if (!confirm("Redraw the games on every court? Only do this before anyone starts playing.")) return;
  void run(async () => {
    for (const c of state.courts) {
      if (c.game && !c.closing) {
        await q(db.rpc("remix_game", { p_game_id: c.game.id }));
        c.game = null;
      }
    }
    await releaseHolds(); // clears any waiting windows and fills every court
  });
}

function endDay() {
  if (!confirm("End today's session? Ratings are kept; games still in progress won't count.")) return;
  void run(async () => {
    await q(db.rpc("end_session", { p_session_id: state.session.id }));
    state.showStats = state.showLog = state.showManage = false;
    await enterSetup();
  });
}

function toggleStats() { state.showStats = !state.showStats; render(); }
function toggleManage() { state.showManage = !state.showManage; render(); }
function toggleLog() { state.showLog = !state.showLog; render(); }
function toggleHelp() { state.showHelp = !state.showHelp; render(); }
function setHelpLang(l) { state.helpLang = l; render(); }

// ---------------- help text ----------------
const HELP = {
  en: {
    title: "How to use",
    sections: [
      ["Before you start (organiser only)", [
        "Sign in with the organiser email and password. Only this phone needs to run the app.",
        "<b>Who's here today</b> — tap names to tick who came. Everyone from last session is pre-ticked.",
        "<b>New player</b> — type their name and pick a starting tier (<b>A</b> strongest, then B, C). You only do this once; after that their rating updates itself.",
        "<b>Courts</b> — how many courts you booked. Then tap <b>Start play day</b>."
      ]],
      ["Playing a game", [
        "Each court shows two teams either side of the dashed net. When the game ends, tap <b>🏆 Won</b> under the winning side.",
        "A pop-up shows everyone's rating change. Tapped the wrong side? Tap <b>⇄ Flip result</b> in the pop-up or in the Log. This works until one of those four players finishes another game.",
        "If other courts are still playing, the finished court shows <b>⏳ Holding</b> for up to 10 minutes, waiting for another court so there's a bigger pool to draw a fresh, fair game from. <b>▶ Fill now</b> skips the wait.",
        "<b>↻ Remix</b> redraws one court's game (only before it starts). <b>↻ All</b> redraws every court."
      ]],
      ["Taking a break or asking to play", [
        "Tap a name chip to cycle through three states:",
        "<b>plain</b> — normal, in the rotation.",
        "<b>⚡ keen</b> — wants to play next; gets priority for the next free spot.",
        "<b>☕ break</b> — resting; won't be picked until tapped back to normal.",
        "<b>🔥</b> next to a name means that person has played 2+ games in a row."
      ]],
      ["Ratings and tiers", [
        "Everyone has an Elo rating. Winners gain points, losers lose them — more for an upset, fewer for an expected win. Both players on a team get the same change.",
        "Teams are balanced on the exact ratings, and the app avoids repeating partners and matchups (today and recent sessions).",
        "Tiers are labels from the rating: <b>S</b> (earned only), <b>A</b>, <b>B</b>, <b>C</b>, <b>D</b> (earned only, organiser-only label). A small buffer stops people flickering between tiers.",
        "New players' ratings move faster for their first 10 games, so a wrong starting tier corrects itself quickly."
      ]],
      ["Adjusting on the fly", [
        "<b>+ Court</b> adds a court mid-session. <b>✕ End</b> removes one — straight away if empty, or after its current game.",
        "<b>Players</b> panel: add someone who arrives late (existing or new), or remove someone leaving early. Removing a player mid-game flags them to leave once that game ends."
      ]],
      ["Good to know", [
        "Everything is saved as you go. Refreshing, closing the app or a flat battery is fine — sign in again and the session continues.",
        "Tap <b>End play day</b> when you finish. Ratings are kept for next time.",
        "Add the link to your home screen so it opens like a normal app."
      ]]
    ]
  },
  vi: {
    title: "Hướng dẫn sử dụng",
    sections: [
      ["Trước khi bắt đầu (người tổ chức)", [
        "Đăng nhập bằng email và mật khẩu của người tổ chức. Chỉ cần một điện thoại chạy app.",
        "<b>Who's here today</b> — bấm vào tên để đánh dấu ai có mặt. Những người đến buổi trước đã được đánh dấu sẵn.",
        "<b>Người chơi mới</b> — nhập tên và chọn tier ban đầu (<b>A</b> mạnh nhất, rồi B, C). Chỉ làm một lần; sau đó điểm sẽ tự cập nhật.",
        "<b>Courts</b> — số sân đã đặt. Sau đó bấm <b>Start play day</b>."
      ]],
      ["Khi chơi", [
        "Mỗi sân hiển thị hai đội ở hai bên lưới. Khi trận kết thúc, bấm <b>🏆 Won</b> ở dưới đội thắng.",
        "Một thông báo hiện thay đổi điểm của từng người. Bấm nhầm đội? Bấm <b>⇄ Flip result</b> trong thông báo hoặc trong Log. Chỉ sửa được khi chưa ai trong bốn người đó đánh xong trận khác.",
        "Nếu các sân khác vẫn đang chơi, sân vừa xong sẽ hiện <b>⏳ Holding</b> tối đa 10 phút, đợi thêm một sân xong để có nhiều người hơn, xếp trận mới và công bằng hơn. <b>▶ Fill now</b> để xếp ngay.",
        "<b>↻ Remix</b> xếp lại trận của một sân (chỉ trước khi bắt đầu đánh). <b>↻ All</b> xếp lại tất cả các sân."
      ]],
      ["Nghỉ hoặc xin được chơi", [
        "Bấm vào tên để đổi giữa ba trạng thái:",
        "<b>bình thường</b> — vẫn trong vòng xoay.",
        "<b>⚡ keen</b> — muốn chơi tiếp; được ưu tiên vào trận kế.",
        "<b>☕ break</b> — đang nghỉ; không bị xếp trận cho tới khi bấm về bình thường.",
        "<b>🔥</b> cạnh tên nghĩa là người đó đã chơi 2 trận liên tiếp trở lên."
      ]],
      ["Điểm Elo và tier", [
        "Mỗi người có điểm Elo. Thắng thì được cộng, thua thì bị trừ — thắng bất ngờ được nhiều hơn, thắng như dự đoán được ít hơn. Hai người cùng đội nhận cùng mức thay đổi.",
        "Các đội được cân theo điểm chính xác, và app tránh lặp lại cặp đôi hoặc cặp đấu (hôm nay và vài buổi gần đây).",
        "Tier là nhãn dựa trên điểm: <b>S</b> (chỉ đạt được qua thi đấu), <b>A</b>, <b>B</b>, <b>C</b>, <b>D</b> (chỉ đạt được qua thi đấu, chỉ người tổ chức thấy). Có một vùng đệm nhỏ để tier không nhảy qua lại liên tục.",
        "Người mới thay đổi điểm nhanh hơn trong 10 trận đầu, nên nếu chọn tier ban đầu sai thì sẽ tự điều chỉnh nhanh."
      ]],
      ["Điều chỉnh giữa buổi", [
        "<b>+ Court</b> thêm sân giữa buổi. <b>✕ End</b> xoá sân — xoá ngay nếu sân trống, hoặc sau khi trận hiện tại xong.",
        "Bảng <b>Players</b>: thêm người đến muộn (đã có hoặc mới), hoặc xoá người về sớm. Xoá người đang thi đấu chỉ đánh dấu để họ rời sau khi trận đó kết thúc."
      ]],
      ["Lưu ý", [
        "Mọi thứ được lưu ngay. Refresh, tắt app hay hết pin đều không sao — đăng nhập lại là tiếp tục buổi chơi.",
        "Bấm <b>End play day</b> khi kết thúc. Điểm được giữ cho lần sau.",
        "Thêm link vào màn hình chính để mở như một app bình thường."
      ]]
    ]
  }
};

function renderHelp() {
  const h = HELP[state.helpLang];
  let html = `<div class="card">
    <div class="card-head">
      <div class="label">${h.title}</div>
      <div style="display:flex;gap:6px">
        <button class="mini-btn${state.helpLang === "en" ? " on" : ""}" onclick="setHelpLang('en')">EN</button>
        <button class="mini-btn${state.helpLang === "vi" ? " on" : ""}" onclick="setHelpLang('vi')">VI</button>
      </div>
    </div>`;
  for (const [heading, items] of h.sections) {
    html += `<div class="help-sec"><div class="help-h">${heading}</div><ul class="help-ul">`;
    for (const it of items) html += `<li>${it}</li>`;
    html += `</ul></div>`;
  }
  html += `<button class="btn subtle" style="width:100%;margin-top:6px" onclick="toggleHelp()">Close</button></div>`;
  return html;
}

// ---------------- log as text (for copying) ----------------
function logFlags(e, idx) {
  const before = state.log.slice(0, idx);
  const kA = pairKey(e.teamA[0].id, e.teamA[1].id);
  const kB = pairKey(e.teamB[0].id, e.teamB[1].id);
  const mk = matchKey(e.teamA.map((p) => p.id), e.teamB.map((p) => p.id));
  const pairs = (x) => [pairKey(x.teamA[0].id, x.teamA[1].id), pairKey(x.teamB[0].id, x.teamB[1].id)];
  const repeatA = before.filter((x) => pairs(x).includes(kA)).length;
  const repeatB = before.filter((x) => pairs(x).includes(kB)).length;
  const repeatMatch = before.filter((x) => matchKey(x.teamA.map((p) => p.id), x.teamB.map((p) => p.id)) === mk).length;
  const sumA = e.teamA[0].before + e.teamA[1].before;
  const sumB = e.teamB[0].before + e.teamB[1].before;
  return { gap: Math.abs(sumA - sumB), repeatA, repeatB, repeatMatch };
}

function logAsText() {
  const nm = (t) => t.map((p) => `${p.name} (${Math.round(p.before)}→${Math.round(p.after)})`).join(" + ");
  const lines = state.log.map((e, i) => {
    const f = logFlags(e, i);
    const flags = [];
    if (f.gap > (state.settings?.balance_deadzone ?? 30)) flags.push("Elo gap " + Math.round(f.gap));
    if (f.repeatA) flags.push(`team A repeated (x${f.repeatA} before)`);
    if (f.repeatB) flags.push(`team B repeated (x${f.repeatB} before)`);
    if (f.repeatMatch) flags.push(`MATCHUP REPEATED (x${f.repeatMatch} before)`);
    const time = new Date(e.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `#${i + 1} [${time}] Court ${e.courtNo} — Team ${e.winner} won\n` +
      `   A: ${nm(e.teamA)}\n   B: ${nm(e.teamB)}\n` +
      `   ${flags.length ? flags.join(", ") : "balanced, all fresh"}`;
  });
  const tally = [...state.players].sort((a, b) => b.games - a.games)
    .map((p) => `${p.name}: ${p.games} (${Math.round(p.elo)}, ${p.tier})`).join(", ");
  return `Court Balancer log — ${state.log.length} games\n\n` + lines.join("\n\n") + `\n\nToday: ${tally}`;
}

function copyLog() {
  const txt = logAsText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(
      () => alert("Log copied to clipboard."),
      () => window.prompt("Copy the log below:", txt));
  } else {
    window.prompt("Copy the log below:", txt);
  }
}

// ---------------- rendering ----------------
function courtCols(n) {
  if (n <= 1) return 1;
  if (n <= 3) return n;
  let best = 3, bestEmpty = Infinity;
  for (const cols of [3, 2]) {
    const rem = n % cols;
    const empty = rem === 0 ? 0 : cols - rem;
    if (empty < bestEmpty) { best = cols; bestEmpty = empty; }
  }
  return best;
}

function badges(p, tired) {
  let b = "";
  if (p.pendingRemove) b += ' <span title="Leaving after this game">🚪</span>';
  if (p.status === "keen") b += ' <span title="Wants to play">⚡</span>';
  if (tired.has(p.id)) b += ' <span title="Played 2+ in a row">🔥</span>';
  return b;
}

function isNewPlayer(p) {
  return (p.gamesTotal ?? p.games_total ?? 0) < (state.settings?.provisional_games ?? 10);
}

function renderHeader(sub) {
  return `<div id="app-header">
    <div style="font-size:46px">🏸</div>
    <h1>Court Balancer</h1>
    <p class="sub">${sub}</p>
  </div>`;
}

function renderLoading() {
  return renderHeader("Loading…") + `<div class="card center"><p class="hint">Connecting to the database…</p></div>`;
}

function renderError() {
  return renderHeader("Something went wrong") + `<div class="card">
    <p style="margin-top:0">Couldn't load your data:</p>
    <p class="hint" style="color:var(--danger)">${esc(state.errorMsg)}</p>
    <p class="hint">Check your internet connection. If this keeps happening, check config.js and that the database setup ran.</p>
    <div class="row" style="margin-top:12px">
      <button class="btn" style="flex:1" onclick="retryLoad()">Try again</button>
      <button class="btn ghost" onclick="signOut()">Sign out</button>
    </div>
  </div>`;
}

function renderLogin() {
  return renderHeader("Fair doubles rotations, balanced by Elo · v8") + `<div class="card">
    <div class="label" style="margin-bottom:6px">Organiser sign in</div>
    <input type="email" placeholder="Email" autocomplete="username" value="${esc(state.loginEmail)}"
      oninput="updateLoginEmail(this.value)">
    <input type="password" placeholder="Password" autocomplete="current-password" style="margin-top:8px"
      oninput="updateLoginPassword(this.value)" onkeydown="if(event.key==='Enter')login()">
    <button class="btn big" style="margin-top:12px" onclick="login()">Sign in</button>
    <p class="hint">Only the organiser needs an account. Players don't sign in.</p>
  </div>`;
}

function renderNotOrganiser() {
  const email = state.user?.email || "your@email.com";
  return renderHeader("Almost there") + `<div class="card">
    <p style="margin-top:0">You're signed in as <b>${esc(email)}</b>, but this account isn't set as the organiser yet.</p>
    <p class="hint">In Supabase, open <b>SQL Editor</b>, run this once, then tap “Check again”:</p>
    <pre class="code">insert into public.organisers (user_id)
select id from auth.users where email = '${esc(email)}';</pre>
    <div class="row" style="margin-top:12px">
      <button class="btn" style="flex:1" onclick="retryLoad()">Check again</button>
      <button class="btn ghost" onclick="signOut()">Sign out</button>
    </div>
  </div>`;
}

function renderSetup() {
  const s = state;
  let html = renderHeader("Fair doubles rotations, balanced by Elo · v8") + `
    <div class="center" style="display:flex;gap:8px;justify-content:center">
      <button class="mini-btn" onclick="toggleHelp()">? How to use / Hướng dẫn</button>
      <button class="mini-btn" onclick="signOut()">Sign out</button>
    </div>`;
  if (s.showHelp) html += renderHelp();

  html += `<div class="row" style="margin-top:18px">
    <div class="stepper">
      <div class="label">Courts</div>
      <div class="controls">
        <button class="btn subtle" onclick="bumpCourts(-1)">−</button>
        <span class="val">${s.setupCourts}</span>
        <button class="btn subtle" onclick="bumpCourts(1)">+</button>
      </div>
    </div>
  </div>`;

  html += `<div class="card">
    <div class="card-head">
      <div class="label">Who's here today (${s.picked.size})</div>
      <div style="display:flex;gap:6px">
        <button class="mini-btn" onclick="pickAll()">All</button>
        <button class="mini-btn" onclick="pickNone()">None</button>
      </div>
    </div>`;
  if (!s.roster.length) {
    html += `<p class="hint" style="margin:0">No players yet — add your group below. You only do this once.</p>`;
  } else {
    html += `<div class="chips">`;
    for (const p of s.roster) {
      const on = s.picked.has(p.id);
      html += `<button class="chip pick${on ? " on" : ""}" onclick="togglePick(${p.id})">
        ${on ? "✓ " : ""}${esc(p.name)} ${tierBadge(p.tier)}<span class="elo">${Math.round(p.elo)}${isNewPlayer(p) ? " · new" : ""}</span></button>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div class="card">
    <div class="label" style="margin-bottom:8px">Add a new player</div>
    <div class="player-row">
      <input type="text" value="${esc(s.newName)}" placeholder="Name" oninput="updateNewName(this.value)"
        onkeydown="if(event.key==='Enter')addNewPlayerAtSetup()">
      ${renderSeedTierSelect()}
      <button class="btn subtle" onclick="addNewPlayerAtSetup()">+ Add</button>
    </div>
    <p class="hint" style="margin-top:0">${seedTiers().map((t) => `<b>${esc(t.code)}</b> starts at ${t.seed_elo}`).join(" · ")}. Pick once — after that the rating updates itself.</p>
  </div>`;

  html += `<div class="center" style="margin-top:16px;padding-bottom:30px">
    <button class="btn big" onclick="startDay()" ${s.picked.size < 4 ? "disabled" : ""}>Start play day →</button>`;
  if (s.picked.size < 4) {
    html += `<p class="warn">Tick at least 4 players.</p>`;
  } else if (s.picked.size < s.setupCourts * 4) {
    html += `<p class="warn">Heads up: ${s.picked.size} players can fill ${Math.floor(s.picked.size / 4)} court(s) at a time.</p>`;
  }
  html += `</div>`;
  return html;
}

function renderSeedTierSelect() {
  return `<select onchange="updateNewTier(this.value)">` +
    seedTiers().map((t) => `<option value="${esc(t.code)}" ${state.newTier === t.code ? "selected" : ""}>Tier ${esc(t.code)}</option>`).join("") +
    `</select>`;
}

function renderManage() {
  const s = state;
  const busy = playingIds();
  let html = `<div class="card">
    <div class="label" style="margin-bottom:8px">Manage players</div>`;
  for (const p of s.players) {
    const status = p.pendingRemove
      ? '<span style="color:var(--danger)">leaving after this game…</span>'
      : p.status === "break" ? '<span style="color:var(--rest)">on break</span>'
      : busy.has(p.id) ? '<span style="color:var(--keen)">on court</span>'
      : '<span style="color:var(--dim)">waiting</span>';
    html += `<div class="player-row" style="align-items:center">
      <div style="flex:1">
        <div style="font-weight:700">${esc(p.name)} ${tierBadge(p.tier)} <span class="elo">${Math.round(p.elo)}</span></div>
        <div style="font-size:11px">${status}</div>
      </div>
      <button class="mini-btn" onclick="removePlayer(${p.id})">${p.pendingRemove ? "Undo" : "Remove"}</button>
    </div>`;
  }
  const here = new Set(s.players.map((p) => p.id));
  const absent = s.roster.filter((p) => !here.has(p.id));
  html += `<div class="label" style="margin:14px 0 6px">Arrived late?</div>`;
  if (absent.length) {
    html += `<div class="player-row">
      <select style="flex:1;padding:9px 6px" onchange="updateAddExisting(this.value)">
        <option value="">Choose a player…</option>
        ${absent.map((p) => `<option value="${p.id}" ${String(s.addExistingId) === String(p.id) ? "selected" : ""}>${esc(p.name)} (${esc(p.tier)})</option>`).join("")}
      </select>
      <button class="btn subtle" onclick="addExistingPlayer()">+ Add</button>
    </div>`;
  }
  html += `<div class="player-row">
    <input type="text" value="${esc(s.newName)}" placeholder="New player name" oninput="updateNewName(this.value)">
    ${renderSeedTierSelect()}
    <button class="btn subtle" onclick="addNewPlayerDuringPlay()">+ New</button>
  </div>
  <p class="hint" style="font-size:11px">Removing someone mid-game marks them “leaving after this game” — they drop out once that court finishes (tap again to undo).</p>
  </div>`;
  return html;
}

function renderPlay() {
  const s = state;
  const busy = playingIds();
  const waiting = s.players.filter((p) => p.status !== "break" && !busy.has(p.id));
  const tired = new Set(s.players.filter((p) => p.consec >= 2).map((p) => p.id));

  let html = `
    <div class="header-bar">
      <div>
        <div class="label" style="letter-spacing:2px">Games done · v8</div>
        <div style="font-size:34px;font-weight:800;line-height:1;color:var(--accent)">${s.log.length}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn ghost" onclick="addCourt()">+ Court</button>
        <button class="btn ghost" onclick="reshuffleAll()">↻ All</button>
        <button class="btn ghost" onclick="toggleManage()">${s.showManage ? "Hide players" : "Players"}</button>
        <button class="btn ghost" onclick="toggleStats()">${s.showStats ? "Hide stats" : "Stats"}</button>
        <button class="btn ghost" onclick="toggleLog()">${s.showLog ? "Hide log" : "Log"}</button>
        <button class="btn ghost" onclick="toggleHelp()" title="How to use">?</button>
      </div>
    </div>`;

  if (s.showHelp) html += renderHelp();

  html += `<div class="courts-grid" style="grid-template-columns: repeat(${courtCols(s.courts.length)}, 1fr)">`;
  for (const court of s.courts) {
    const g = court.game;
    if (!g) {
      const body = court.holdStartedAt
        ? `<div style="font-size:34px;margin:10px 0 6px">⏳</div>
           <div style="font-size:15px">Holding — waiting for another court to finish</div>
           <div class="countdown" data-hold="${esc(court.holdStartedAt)}">${fmtLeft(Date.parse(court.holdStartedAt) + holdMs() - Date.now())}</div>
           <button class="mini-btn" style="margin-top:6px" onclick="fillNow()">▶ Fill now</button>`
        : `<div style="font-size:34px;margin:10px 0 6px">💤</div>
           <div style="font-size:15px">Waiting — need 4 free players here.</div>`;
      html += `<div class="match-card center" style="color:var(--dim)">
        <div class="court-head" style="justify-content:center;position:relative">
          <div class="court-label">Court ${court.no}</div>
          <button class="mini-btn" style="position:absolute;right:0" onclick="endCourt(${court.no})" title="Remove this court">✕ End</button>
        </div>
        ${body}
      </div>`;
      continue;
    }
    const teamHtml = (team, right) =>
      `<div class="team${right ? " right" : ""}">` +
      team.map((id) => {
        const p = byId(id) || { id, name: nameOf(id), tier: "", status: "normal" };
        return `<div class="p">${esc(p.name)} ${tierBadge(p.tier)}${badges(p, tired)}</div>`;
      }).join("") + `</div>`;
    html += `<div class="match-card">
      <div class="court-head">
        <div class="court-label">Court ${court.no}${court.closing ? ' <span class="closing-tag">· closing after this game</span>' : ""}</div>
        <div style="display:flex;gap:6px">
          ${court.closing ? "" : `<button class="mini-btn" onclick="reshuffleCourt(${court.no})" title="Redraw this game">↻ Remix</button>`}
          <button class="mini-btn" onclick="endCourt(${court.no})">${court.closing ? "↩ Keep open" : "✕ End"}</button>
        </div>
      </div>
      <div class="teams">
        ${teamHtml(g.teamA, false)}
        <div class="net"><span>VS</span></div>
        ${teamHtml(g.teamB, true)}
      </div>
      <div class="win-row">
        <button class="btn win" onclick="finishCourt(${court.no},'A')">🏆 Won</button>
        <button class="btn win" onclick="finishCourt(${court.no},'B')">Won 🏆</button>
      </div>
      <div class="win-hint">Tap under the winning side</div>
    </div>`;
  }
  html += `</div>`;

  if (waiting.length > 0) {
    html += `<div class="card" style="background:var(--card-lite)">
      <div class="label" style="margin-bottom:6px">Waiting to play</div>
      <div style="font-size:18px;font-weight:600">${waiting.map((p) => esc(p.name) + (p.status === "keen" ? " ⚡" : "")).join(", ")}</div>
    </div>`;
  }

  if (s.showManage) html += renderManage();

  html += `<div class="card">
    <div class="label" style="margin-bottom:8px">Player status — tap to cycle</div>
    <div class="chips">`;
  for (const p of s.players) {
    const cls = p.status === "break" ? " break" : p.status === "keen" ? " keen" : "";
    const icon = p.status === "break" ? "☕ " : p.status === "keen" ? "⚡ " : "";
    html += `<button class="chip${cls}" onclick="cycleStatus(${p.id})">
      ${icon}${esc(p.name)}${tired.has(p.id) && p.status !== "break" ? " 🔥" : ""}</button>`;
  }
  html += `</div>
    <div class="legend">
      <span>plain = normal</span>
      <span style="color:var(--keen)">⚡ = wants to play (priority)</span>
      <span style="color:var(--rest)">☕ = on break</span>
      <span>🔥 = 2+ games in a row</span>
    </div>
    <p class="hint" style="font-size:11px">Status changes apply when a court picks its next game. To redo a game that hasn't started, use ↻ Remix.</p>
  </div>`;

  if (s.showStats) {
    html += `<div class="card"><div class="label" style="margin-bottom:8px">Today</div>
      <div class="stat-row stat-head"><span>Player</span><span>Rating · games</span></div>`;
    for (const p of [...s.players].sort((a, b) => b.elo - a.elo)) {
      const d = p.elo - p.eloStart;
      const st = p.status === "break" ? ' <span style="color:var(--rest)">· break</span>'
        : p.status === "keen" ? ' <span style="color:var(--keen)">· keen ⚡</span>' : "";
      html += `<div class="stat-row">
        <span>${esc(p.name)} ${tierBadge(p.tier)}${isNewPlayer(p) ? ' <span class="elo">new</span>' : ""}${st}</span>
        <span><b>${Math.round(p.elo)}</b> ${Math.round(d) ? `<span class="delta ${d > 0 ? "up" : "down"}">${signed(d)}</span>` : ""} · ${p.games}${p.consec >= 2 ? " 🔥" : ""}</span>
      </div>`;
    }
    html += `</div>`;
  }

  if (s.showLog) {
    html += `<div class="card">
      <div class="card-head">
        <div class="label">Match history (${s.log.length})</div>
        <button class="mini-btn" onclick="copyLog()" ${s.log.length ? "" : "disabled"}>⧉ Copy as text</button>
      </div>`;
    if (!s.log.length) html += `<p class="hint" style="margin:0">No games finished yet.</p>`;
    for (let i = s.log.length - 1; i >= 0; i--) {
      const e = s.log[i];
      const f = logFlags(e, i);
      const nm = (t, won) => `<span class="${won ? "won" : ""}">` + t.map((p) =>
        `${esc(p.name)} <span class="delta ${p.after >= p.before ? "up" : "down"}">${signed(p.after - p.before)}</span>`).join(" + ") +
        (won ? " 🏆" : "") + `</span>`;
      const flags = [];
      if (f.gap > (s.settings?.balance_deadzone ?? 30)) flags.push(`<span style="color:var(--rest)">Elo gap ${Math.round(f.gap)}</span>`);
      if (f.repeatA || f.repeatB) flags.push(`<span style="color:var(--rest)">repeat team (x${Math.max(f.repeatA, f.repeatB)})</span>`);
      if (f.repeatMatch) flags.push(`<span style="color:var(--danger)">repeat matchup (x${f.repeatMatch})</span>`);
      if (!flags.length) flags.push(`<span style="color:var(--accent)">balanced · all fresh</span>`);
      const time = new Date(e.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      html += `<div class="log-row">
        <div class="log-head" style="display:flex;justify-content:space-between;align-items:center">
          <span>#${i + 1} · Court ${e.courtNo} · ${time}</span>
          <button class="mini-btn small" onclick="correctResult(${e.gameId})">⇄ Flip result</button>
        </div>
        <div class="log-teams">${nm(e.teamA, e.winner === "A")}
          <span style="color:var(--dim)"> vs </span>${nm(e.teamB, e.winner === "B")}</div>
        <div class="log-meta">${flags.join(" · ")}</div>
      </div>`;
    }
    html += `<p class="hint" style="font-size:11px">“Elo gap” = difference in combined team ratings before the game. Repeat flags mean nothing fresher was available. A result can be flipped until one of its players finishes another game.</p>
    </div>`;
  }

  html += `<div class="center" style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <button class="btn danger" onclick="endDay()">End play day</button>
    <button class="btn ghost" onclick="signOut()">Sign out</button>
  </div>`;
  return html;
}

function renderToast() {
  if (!state.toast) return "";
  const t = state.toast;
  return `<div class="toast ${t.kind}">
    <button class="toast-x" onclick="hideToast()" aria-label="Close">✕</button>
    <div>${t.html}</div>
    ${t.gameId ? `<button class="mini-btn" style="margin-top:8px" onclick="correctResult(${t.gameId})">⇄ Wrong side? Flip result</button>` : ""}
  </div>`;
}

function render() {
  const el = document.getElementById("root");
  const screens = {
    loading: renderLoading, login: renderLogin, "not-organiser": renderNotOrganiser,
    error: renderError, setup: renderSetup, play: renderPlay,
  };
  el.className = "wrap" + (state.phase === "play" ? " wide" : "") + (state.busy ? " busy" : "");
  el.innerHTML = (screens[state.phase] || renderLoading)() +
    (state.busy ? `<div class="saving">Saving…</div>` : "") + renderToast();
}

render();
void init();
