import { Fragment } from "react";
import { logFlags } from "../history";
import { Delta } from "./Shared";

export default function GameLog({ state, actions }) {
  function side(players, won, ranked) {
    return <span className={won ? "won" : ""}>{players.map((player, index) => <Fragment key={player.id}>{index > 0 && " + "}{player.name}{ranked && <> <Delta value={player.after - player.before} /></>}</Fragment>)}{won ? " 🏆" : ""}</span>;
  }
  return <div className="card">
    <div className="card-head"><div className="label">Match history ({state.log.length})</div><button className="mini-btn" onClick={actions.copyLog} disabled={!state.log.length}>⧉ Copy as text</button></div>
    {!state.log.length && <p className="hint" style={{ margin: 0 }}>No games finished yet.</p>}
    {state.log.map((entry, index) => ({ entry, index })).reverse().map(({ entry, index }) => {
      const flags = logFlags(state, entry, index);
      const labels = [];
      if (flags.gap > (state.settings?.balance_deadzone ?? 30)) labels.push(["var(--rest)", `Elo gap ${Math.round(flags.gap)}`]);
      if (flags.repeatA || flags.repeatB) labels.push(["var(--rest)", `repeat team (x${Math.max(flags.repeatA, flags.repeatB)})`]);
      if (flags.repeatMatch) labels.push(["var(--danger)", `repeat matchup (x${flags.repeatMatch})`]);
      if (!labels.length) labels.push(["var(--accent)", "balanced · all fresh"]);
      return <div className="log-row" key={entry.gameId}>
        <div className="log-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>#{index + 1} · Court {entry.courtNo} · {entry.ranked ? "Ranked" : "Unranked"} · {new Date(entry.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <button className="mini-btn small" onClick={() => actions.correctResult(entry.gameId)}>⇄ Flip result</button>
        </div>
        <div className="log-teams">{side(entry.teamA, entry.winner === "A", entry.ranked)}<span style={{ color: "var(--dim)" }}> vs </span>{side(entry.teamB, entry.winner === "B", entry.ranked)}</div>
        <div className="log-meta">{labels.map(([color, label], i) => <Fragment key={label}>{i > 0 && " · "}<span style={{ color }}>{label}</span></Fragment>)}</div>
      </div>;
    })}
    <p className="hint" style={{ fontSize: 11 }}>“Elo gap” = difference in combined team ratings before the game. Repeat flags mean nothing fresher was available. Unranked results can be flipped later; ranked results can be flipped until a player finishes another ranked game.</p>
  </div>;
}
