import { fmtLeft } from "../helpers";
import { ProfileName, StreakBadge } from "./Shared";

export default function CourtCard({ court, state, actions, tired, streaks }) {
  const game = court.game;
  if (!game) return <div className="match-card center" style={{ color: "var(--dim)" }}>
    <div className="court-head" style={{ justifyContent: "center", position: "relative" }}>
      <div className="court-label">Court {court.no}</div><button className="mini-btn" style={{ position: "absolute", right: 0 }} onClick={() => actions.endCourt(court.no)} title="Remove this court">✕ End</button>
    </div>
    <div style={{ fontSize: 34, margin: "10px 0 6px" }}>{court.holdStartedAt ? "⏳" : "💤"}</div>
    {court.holdStartedAt ? <>
      <div style={{ fontSize: 15 }}>Holding — waiting for the other courts to finish</div>
      <div className="countdown">{fmtLeft(Date.parse(court.holdStartedAt) + (state.settings?.hold_minutes ?? 10) * 60000 - state.now)}</div>
      <button className="mini-btn" style={{ marginTop: 6 }} onClick={actions.fillNow}>▶ Fill now</button>
    </> : <div style={{ fontSize: 15 }}>Waiting — need 4 free players here.</div>}
  </div>;

  function team(ids, right) {
    return <div className={`team${right ? " right" : ""}`}>{ids.map((id) => {
      const player = state.players.find((p) => p.id === id) || { id, name: state.names.get(id) || "?", status: "normal" };
      return <div className="p" key={id}><ProfileName player={player} /><StreakBadge count={streaks.get(id) || 0} />
        {player.pendingRemove && <> <span title="Leaving after this game">🚪</span></>}
        {player.status === "keen" && <> <span title="Wants to play">⚡</span></>}
        {tired.has(id) && <> <span title="Played 2+ in a row">💃</span></>}
      </div>;
    })}</div>;
  }

  return <div className="match-card">
    <div className="court-head">
      <div className="court-label">Court {court.no} <span className="mode-tag">{game.ranked ? "Ranked" : "Unranked"}</span>{court.closing && <span className="closing-tag"> · closing after this game</span>}</div>
      <div style={{ display: "flex", gap: 6 }}>{!court.closing && <button className="mini-btn" onClick={() => actions.reshuffleCourt(court.no)} title="Redraw this game">↻ Remix</button>}<button className="mini-btn" onClick={() => actions.endCourt(court.no)}>{court.closing ? "↩ Keep open" : "✕ End"}</button></div>
    </div>
    <div className="teams">{team(game.teamA, false)}<div className="net"><span>VS</span></div>{team(game.teamB, true)}</div>
    <div className="win-row"><button className="btn win" disabled={state.busy} onClick={() => actions.finishCourt(court.no, "A")}>🏆 Won</button><button className="btn win" disabled={state.busy} onClick={() => actions.finishCourt(court.no, "B")}>Won 🏆</button></div>
    <div className="win-hint">Tap under the winning side</div>
  </div>;
}
