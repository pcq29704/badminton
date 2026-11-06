import { Fragment } from "react";
import { logFlags } from "../history";
import { formatScore, resultLabel } from "../scoring.mjs";
import { Delta, PlayerTag, playerInfo } from "./Shared";

export default function GameLog({ state, actions }) {
  function side(players, won, ranked, right) {
    return <div className={`ds-org-log-side${won ? " won" : ""}${right ? " right" : ""}`}>{players.map((player) =>
      <PlayerTag key={player.id} player={playerInfo(state, player.id, player)} size="sm">{ranked && <Delta value={player.after - player.before} />}</PlayerTag>)}{won && <span className="ds-dp-win">Won</span>}</div>;
  }
  return <section className="ds-org-card">
    <div className="ds-org-card-head"><h2 className="ds-org-label">Match history ({state.log.length})</h2><button className="ds-btn tertiary ds-org-mini" onClick={actions.copyLog} disabled={!state.log.length}>⧉ Copy as text</button></div>
    {!state.log.length && <p className="ds-hint">No games finished yet.</p>}
    {state.log.map((entry, index) => ({ entry, index })).reverse().map(({ entry, index }) => {
      const flags = logFlags(state, entry, index);
      const labels = [];
      if (flags.gap > (state.settings?.balance_deadzone ?? 30)) labels.push(["rest", `Elo gap ${Math.round(flags.gap)}`]);
      if (flags.repeatA || flags.repeatB) labels.push(["rest", `repeat team (x${Math.max(flags.repeatA, flags.repeatB)})`]);
      if (flags.repeatMatch) labels.push(["danger", `repeat matchup (x${flags.repeatMatch})`]);
      if (!labels.length) labels.push(["good", "balanced · all fresh"]);
      return <div className="ds-org-log" key={entry.gameId}>
        <div className="ds-org-log-head">
          <span>#{index + 1} · Court {entry.courtNo} · {entry.ranked ? "Ranked" : "Unranked"} · {new Date(entry.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{entry.scoreA != null && <> · {resultLabel(entry.scoreA, entry.scoreB)}</>}</span>
          <button className="ds-btn tertiary ds-org-mini" onClick={() => actions.correctResult(entry.gameId)}>✎ Edit score</button>
        </div>
        <div className="ds-org-log-teams">{side(entry.teamA, entry.winner === "A", entry.ranked, false)}{entry.scoreA != null
          ? <span className="ds-org-log-score">{formatScore(entry.scoreA, entry.scoreB)}</span>
          : <span className="ds-org-vs">vs</span>}{side(entry.teamB, entry.winner === "B", entry.ranked, true)}</div>
        <div className="ds-org-log-meta">{labels.map(([tone, label], i) => <Fragment key={label}>{i > 0 && " · "}<span className={`ds-org-status ${tone}`}>{label}</span></Fragment>)}</div>
      </div>;
    })}
    <p className="ds-hint">“Elo gap” = difference in combined team ratings before the game. Repeat flags mean nothing fresher was available. Unranked scores can be edited later; ranked scores can be edited until a player finishes another ranked game.</p>
  </section>;
}
