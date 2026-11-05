import { playingIds } from "../matchmaking";
import { isDebug, winStreaks, streakIcon, STREAK_MIN } from "../helpers";
import { HelpPanel, PlayerTag, StreakBadge } from "./Shared";
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
    <div className="cb-org-bar">
      <div><div className="cb-org-label">Games done · v8</div><div className="cb-org-count">{state.log.length}</div></div>
      <div className="cb-org-actions">
        {/* Unranked toggle hidden for now: new matches are always ranked.
            <button className={`cb-btn quiet cb-org-rank${state.session.rank_new_games ? " on" : ""}`} onClick={actions.toggleRanked} aria-pressed={state.session.rank_new_games}>{state.session.rank_new_games ? "Ranked" : "Unranked"} for new matches</button> */}
        <button className="cb-btn quiet" onClick={actions.addCourt}>Add court</button><button className="cb-btn quiet" onClick={actions.reshuffleAll}>Remix all</button>
        <button className="cb-btn quiet" onClick={actions.toggleManage}>{state.showManage ? "Hide players" : "Players"}</button>{debug && <><button className="cb-btn quiet" onClick={actions.toggleStats}>{state.showStats ? "Hide stats" : "Stats"}</button><button className="cb-btn quiet" onClick={actions.toggleLog}>{state.showLog ? "Hide log" : "Log"}</button></>}<button className="cb-btn quiet" onClick={actions.toggleHelp} title="How to use">?</button>
      </div>
    </div>
    {state.showHelp && <HelpPanel state={state} actions={actions} />}
    {hot.length > 0 && <section className="cb-org-group cb-org-streak">
      <h2 className="cb-org-label">On a streak</h2>
      <div className="cb-org-streak-list">{hot.map(({ player, n }) =>
        <PlayerTag key={player.id} player={player} size="sm"><span className="cb-org-streak-text">{streakIcon(n)} {n} wins in a row</span></PlayerTag>)}</div>
    </section>}
    <div className="cb-org-courts" style={{ gridTemplateColumns: `repeat(${courtCols(state.courts.length)}, minmax(0, 1fr))` }}>{state.courts.map((court) => <CourtCard key={court.id} court={court} state={state} actions={actions} tired={tired} streaks={streaks} />)}</div>
    {waiting.length > 0 && <section className="cb-org-group cb-org-waiting"><h2 className="cb-org-label">Waiting to play</h2><div className="cb-org-player-list">{waiting.map((player) =>
      <PlayerTag key={player.id} player={player}><StreakBadge count={streaks.get(player.id) || 0} />{player.status === "keen" && <span title="Wants to play">⚡</span>}</PlayerTag>)}</div></section>}
    {state.showManage && <ManagePlayers state={state} actions={actions} />}
    <section className="cb-org-group"><h2 className="cb-org-label">Player status — tap to cycle</h2><div className="cb-org-chips">
      {state.players.map((player) => <button key={player.id} className={`cb-org-pchip${player.status === "break" ? " break" : player.status === "keen" ? " keen" : ""}`} onClick={() => actions.cycleStatus(player.id)}>
        <PlayerTag player={player} size="sm">
          {player.status === "break" && <span title="On break">☕</span>}{player.status === "keen" && <span title="Wants to play">⚡</span>}
          <StreakBadge count={streaks.get(player.id) || 0} />{tired.has(player.id) && player.status !== "break" && <span title="Played 2+ in a row">💃</span>}
        </PlayerTag>
      </button>)}
    </div><div className="cb-org-legend"><span>plain = normal</span><span className="keen">⚡ = wants to play (priority)</span><span className="rest">☕ = on break</span><span>💃 = 2+ games in a row</span><span>⭐ 3 · 🔥 4 · 👑 5+ wins in a row</span></div>
      <p className="cb-note">Status changes apply when a court picks its next game. To redo a game that hasn't started, use Remix.</p>
    </section>
    {debug && state.showStats && <StatsPanel state={state} />}{debug && state.showLog && <GameLog state={state} actions={actions} />}
    <div className="cb-org-footer"><button className="cb-btn quiet cb-org-danger" onClick={actions.endDay}>End play day</button><button className="cb-btn quiet" onClick={actions.signOut}>Sign out</button></div>
  </>;
}
