import { initialState } from "./state";
import { Oops, query } from "./repository";
import { playingIds as getPlayingIds, pickGame as chooseGame } from "./matchmaking";
import { recordToday as addHistory, makeLogEntry as buildLog, applyRatingRows as applyRatings, logAsText as formatLog } from "./history";
import { loadBasics as fetchBasics, loadRoster as fetchRoster, loadSession as fetchSession } from "./session";
import { matchKey, usernameFromName, winStreaks, streakIcon, STREAK_MIN } from "./helpers";

// Commands keep a current working state for sequential court fills. React only
// receives detached snapshots, so an in-flight command cannot mutate its view.
export function createCourtBalancer(db, onChange) {
  const state = initialState();
  let disposed = false;
  let subscription;
  let interval;
  let authVersion = 0;
  class Cancelled extends Error {}
  const byId = (id) => state.players.find((p) => p.id === id);
  const courtByNo = (no) => state.courts.find((c) => c.no === no);
  const holdMs = () => (state.settings?.hold_minutes ?? 10) * 60000;
  const nowIso = () => new Date().toISOString();
  const playingIds = () => getPlayingIds(state);
  const pickGame = (avoidKey) => chooseGame(state, avoidKey);
  const recordToday = (A, B) => addHistory(state, A, B);
  const makeLogEntry = (...args) => buildLog(state, ...args);
  const applyRatingRows = (rows) => applyRatings(state, rows);
  const logAsText = () => formatLog(state);
  const loadBasics = () => fetchBasics(db, state, q);
  const loadRoster = () => fetchRoster(db, state, q);
  const loadSession = (id) => fetchSession(db, state, q, id);

  function render() {
    if (!disposed) onChange(structuredClone(state));
  }

  async function q(promise) {
    const version = authVersion;
    const data = await query(promise);
    if (disposed || version !== authVersion) throw new Cancelled();
    return data;
  }

  async function run(fn) {
    if (disposed || state.busy) return;
    const version = authVersion;
    state.busy = true;
    render();
    try {
      await fn();
    } catch (e) {
      if (disposed || version !== authVersion || e instanceof Cancelled) return;
      if (e instanceof Oops) { showToast("error", e.message); return; }
      console.error(e);
      showToast("error", "Couldn't save: " + String(e.message || e) + "\nCheck your signal and try again.");
      if (state.phase === "loading") {
        state.phase = "error";
        state.errorMsg = e.message || String(e);
      }
      if (state.session) {
        try { await loadSession(state.session.id); } catch (_) { /* still offline */ }
      }
    } finally {
      if (!disposed && version === authVersion) {
        state.busy = false;
        render();
      }
    }
  }

  let toastTimer = null;
  function showToast(kind, message, gameId) {
    state.toast = { kind, message, gameId };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { state.toast = null; toastTimer = null; render(); }, kind === "error" ? 15000 : 12000);
  }
  function hideToast() {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    state.toast = null;
    render();
  }

  async function init() {
    const version = authVersion;
    const { data, error } = await db.auth.getSession();
    if (disposed || version !== authVersion) return;
    if (error) throw error;
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
        try { await checkHolds(); } catch (e) {
          if (disposed || e instanceof Cancelled) return;
          console.error(e); // the ticker retries
        }
        state.phase = "play";
      } else {
        await enterSetup();
      }
    } catch (e) {
      if (disposed || e instanceof Cancelled) return;
      console.error(e);
      state.phase = "error";
      state.errorMsg = e.message || String(e);
    }
    render();
  }

  function updateLoginEmail(v) { state.loginEmail = v; render(); }
  function updateLoginPassword(v) { state.loginPassword = v; render(); }

  function login() {
    const email = state.loginEmail.trim();
    if (!email || !state.loginPassword) { showToast("error", "Enter your email and password."); render(); return; }
    return run(async () => {
      const version = authVersion;
      const { data, error } = await db.auth.signInWithPassword({ email, password: state.loginPassword });
      if (disposed || version !== authVersion) return;
      if (error) throw new Oops(error.message);
      state.loginPassword = "";
      await afterLogin(data.user);
    });
  }

  function signOut() {
    if (state.session && !confirm("Sign out? The session stays saved and continues when you sign in again.")) return;
    return run(async () => {
      const { error } = await db.auth.signOut();
      if (error) throw new Oops(error.message);
    });
  }

  function retryLoad() { void run(() => state.user ? afterLogin(state.user) : init()); }

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
  function updateNewName(v) {
    state.newName = v;
    if (!state.newUsernameManual) state.newUsername = usernameFromName(v);
    render();
  }
  function updateNewUsername(v) { state.newUsername = v; state.newUsernameManual = true; render(); }
  function updateNewTier(v) { state.newTier = v; render(); }

  // Create a brand-new player in the database (their Elo comes from the chosen tier)
  async function createPlayer() {
    const name = state.newName.trim();
    const username = state.newUsername.trim().toLowerCase();
    if (!name) throw new Oops("Type a name first.");
    if (!/^[a-z0-9._-]{1,32}$/.test(username)) throw new Oops("Use 1–32 letters, numbers, dots, underscores, or hyphens for the username.");
    if (state.roster.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new Oops(`${name} is already in your player list.`);
    }
    if (state.roster.some((p) => (p.username || "").trim().toLowerCase() === username)) {
      throw new Oops("That username is already taken. Choose another one.");
    }
    let row;
    try {
      row = await q(db.from("players").insert({ name, username, tier: state.newTier })
        .select("id,name,username,elo,tier,games_total,profile_image_path").single());
    } catch (e) {
      if (disposed) return;
      if (/players_username_unique|duplicate key value/i.test(e.message || "")) {
        throw new Oops("That username is already taken. Choose another one.");
      }
      throw e;
    }
    const p = { ...row, elo: Number(row.elo) };
    state.roster.push(p);
    state.roster.sort((a, b) => a.name.localeCompare(b.name));
    state.newName = "";
    state.newUsername = "";
    state.newUsernameManual = false;
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
    const game = await q(db.from("games").select("ranked").eq("id", gameId).single());
    court.game = { id: gameId, ranked: game.ranked, teamA: pick.teamA, teamB: pick.teamB };
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
  // A court that finishes while others are still playing waits until every
  // court has finished, then all of them are filled together from the full pool,
  // so every court runs on the same timeline. The first court to start waiting
  // sets the limit: after hold_minutes everything waiting is filled anyway.
  // The start time is saved on the court, so the countdown survives a refresh.
  async function holdCourtForSync(court) {
    const othersPlaying = state.courts.some((c) => c !== court && c.game && !c.closing);
    if (!othersPlaying) { await releaseHolds(); return; } // last court done: fill them all
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

  function tick() {
    if (disposed || state.phase !== "play") return;
    state.now = Date.now();
    render();
    if (!state.busy && holdExpiredSomewhere()) void run(checkHolds);
  }

  // ---------------- play: results ----------------
  function finishCourt(no, winner) {
    void run(async () => {
      const court = courtByNo(no);
      if (!court || !court.game) return;
      const g = court.game;
      const rows = await q(db.rpc("finish_game", { p_game_id: g.id, p_winner: winner }));
      if (g.ranked) applyRatingRows(rows);

      const played = new Set([...g.teamA, ...g.teamB]);
      state.players.forEach((p) => {
        if (played.has(p.id)) { p.games++; p.consec++; if (g.ranked) p.gamesTotal++; }
      });
      const entry = makeLogEntry(g.id, court.no, winner, nowIso(), rows);
      entry.ranked = g.ranked;
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

  function showResultToast(entry, corrected) {
    showToast("info", "", entry.gameId);
    state.toast.result = structuredClone(entry);
    state.toast.corrected = corrected;
    const idx = state.log.findIndex((x) => x.gameId === entry.gameId);
    const before = winStreaks(state.log, idx), after = winStreaks(state.log, idx + 1);
    state.toast.shouts = [...entry.teamA, ...entry.teamB].map((p) => {
      const n = after.get(p.id) || 0, was = before.get(p.id) || 0;
      if (n >= STREAK_MIN) return { icon: streakIcon(n), name: p.name, text: ` is on a ${n}-win streak!` };
      if (was >= STREAK_MIN) return { icon: "💪", name: p.name, text: `'s streak ended at ${was}. Great run!` };
      return null;
    }).filter(Boolean);
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
      if (e.ranked) applyRatingRows(rows);
      const fresh = makeLogEntry(gameId, e.courtNo, newWinner, e.endedAt, rows);
      Object.assign(e, { winner: newWinner, teamA: fresh.teamA, teamB: fresh.teamB });
      showResultToast(e, true);
    });
  }

  function toggleRanked() {
    void run(async () => {
      const ranked = !state.session.rank_new_games;
      await q(db.from("sessions").update({ rank_new_games: ranked }).eq("id", state.session.id));
      state.session.rank_new_games = ranked;
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

  function updateAddExisting(v) { state.addExistingId = v; render(); }
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
    if (!confirm("End today's session? Games still in progress won't count.")) return;
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


  const actions = {
    login, signOut, retryLoad, bumpCourts, togglePick, pickAll, pickNone,
    updateLoginEmail, updateLoginPassword, updateNewName, updateNewUsername,
    updateNewTier, addNewPlayerAtSetup, startDay, fillNow, finishCourt,
    correctResult, toggleRanked, cycleStatus, removePlayer, updateAddExisting,
    addExistingPlayer, addNewPlayerDuringPlay, addCourt, endCourt,
    reshuffleCourt, reshuffleAll, endDay, toggleStats, toggleManage,
    toggleLog, toggleHelp, setHelpLang, copyLog, hideToast,
  };

  async function start() {
    state.now = Date.now();
    subscription = db.auth.onAuthStateChange((event) => {
      if (disposed || event !== "SIGNED_OUT") return;
      authVersion++;
      Object.assign(state, initialState(), { phase: "login", now: Date.now() });
      hideToast();
      render();
    }).data.subscription;
    interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisible);
    await run(init);
  }

  function onVisible() { if (!document.hidden) tick(); }

  function dispose() {
    disposed = true;
    subscription?.unsubscribe();
    clearInterval(interval);
    clearTimeout(toastTimer);
    document.removeEventListener("visibilitychange", onVisible);
    state.loginPassword = "";
  }

  return { actions, start, dispose };
}
