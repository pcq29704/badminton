import { Fragment } from "react";
import { playingIds } from "../matchmaking";
import { isDebug, winStreaks, streakIcon, STREAK_MIN } from "../helpers";
import { HelpPanel, ProfileName, StreakBadge } from "./Shared";
import CourtCard from "./CourtCard";
import ManagePlayers from "./ManagePlayers";
import StatsPanel from "./StatsPanel";
import GameLog from "./GameLog";

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

export default function PlayScreen({ state, actions }) {
  const busy = playingIds(state);
  const waiting = state.players.filter((p) => p.status !== "break" && !busy.has(p.id));
  const tired = new Set(state.players.filter((p) => p.consec >= 2).map((p) => p.id));
  const debug = isDebug();
  const streaks = winStreaks(state.log);
  const hot = state.players.map((player) => ({ player, n: streaks.get(player.id) || 0 }))
    .filter((x) => x.n >= STREAK_MIN).sort((a, b) => b.n - a.n);
  return <>
    <div className="header-bar">
      <div><div className="label" style={{ letterSpacing: 2 }}>Games done · v8</div><div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: "var(--accent)" }}>{state.log.length}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button className={`btn rank-toggle${state.session.rank_new_games ? " on" : ""}`} onClick={actions.toggleRanked} aria-pressed={state.session.rank_new_games}>{state.session.rank_new_games ? "Ranked" : "Unranked"} for new matches</button>
        <button className="btn ghost" onClick={actions.addCourt}>+ Court</button><button className="btn ghost" onClick={actions.reshuffleAll}>↻ All</button>
        <button className="btn ghost" onClick={actions.toggleManage}>{state.showManage ? "Hide players" : "Players"}</button>{debug && <><button className="btn ghost" onClick={actions.toggleStats}>{state.showStats ? "Hide stats" : "Stats"}</button><button className="btn ghost" onClick={actions.toggleLog}>{state.showLog ? "Hide log" : "Log"}</button></>}<button className="btn ghost" onClick={actions.toggleHelp} title="How to use">?</button>
      </div>
    </div>
    {state.showHelp && <HelpPanel state={state} actions={actions} />}
    {hot.length > 0 && <div className="streak-banner">
      <div className="label">On a streak</div>
      <div className="streak-list">{hot.map(({ player, n }) =>
        <span className="streak-item" key={player.id}>{streakIcon(n)} <b>{player.name}</b> · {n} wins in a row</span>)}</div>
    </div>}
    <div className="courts-grid" style={{ gridTemplateColumns: `repeat(${courtCols(state.courts.length)}, 1fr)` }}>{state.courts.map((court) => <CourtCard key={court.id} court={court} state={state} actions={actions} tired={tired} streaks={streaks} />)}</div>
    {waiting.length > 0 && <div className="card" style={{ background: "var(--card-lite)" }}><div className="label" style={{ marginBottom: 6 }}>Waiting to play</div><div style={{ fontSize: 18, fontWeight: 600 }}>{waiting.map((player, index) => <Fragment key={player.id}>{index > 0 && ", "}<ProfileName player={player} /><StreakBadge count={streaks.get(player.id) || 0} />{player.status === "keen" ? " ⚡" : ""}</Fragment>)}</div></div>}
    {state.showManage && <ManagePlayers state={state} actions={actions} />}
    <div className="card"><div className="label" style={{ marginBottom: 8 }}>Player status — tap to cycle</div><div className="chips">
      {state.players.map((player) => <button key={player.id} className={`chip${player.status === "break" ? " break" : player.status === "keen" ? " keen" : ""}`} onClick={() => actions.cycleStatus(player.id)}>
        {player.status === "break" ? "☕ " : player.status === "keen" ? "⚡ " : ""}{player.name}<StreakBadge count={streaks.get(player.id) || 0} />{tired.has(player.id) && player.status !== "break" ? " 💃" : ""}
      </button>)}
    </div><div className="legend"><span>plain = normal</span><span style={{ color: "var(--keen)" }}>⚡ = wants to play (priority)</span><span style={{ color: "var(--rest)" }}>☕ = on break</span><span>💃 = 2+ games in a row</span><span>⭐ 3 · 🔥 4 · 👑 5+ wins in a row</span></div>
      <p className="hint" style={{ fontSize: 11 }}>Status changes apply when a court picks its next game. To redo a game that hasn't started, use ↻ Remix.</p>
    </div>
    {debug && state.showStats && <StatsPanel state={state} />}{debug && state.showLog && <GameLog state={state} actions={actions} />}
    <div className="center" style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}><button className="btn danger" onClick={actions.endDay}>End play day</button><button className="btn ghost" onClick={actions.signOut}>Sign out</button></div>
  </>;
}
