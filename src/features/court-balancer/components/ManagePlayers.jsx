import { playingIds } from "../matchmaking";
import { isDebug } from "../helpers";
import { PlayerForm, PlayerTag } from "./Shared";

export default function ManagePlayers({ state, actions }) {
  const busy = playingIds(state);
  const here = new Set(state.players.map((p) => p.id));
  const absent = state.roster.filter((p) => !here.has(p.id));
  return <section className="ds-org-card">
    <h2 className="ds-org-label">Manage players</h2>
    <ul className="ds-org-rows">{state.players.map((player) => {
      const status = player.pendingRemove ? ["danger", "leaving after this game…"] : player.status === "break" ? ["rest", "on break"] : busy.has(player.id) ? ["keen", "on court"] : ["", "waiting"];
      return <li className="ds-org-row" key={player.id}>
        <PlayerTag player={player}>{isDebug() && <span className="ds-org-note">{Math.round(player.elo)}</span>}</PlayerTag>
        <span className={`ds-org-status ${status[0]}`}>{status[1]}</span>
        <button className="ds-btn tertiary ds-org-mini" onClick={() => actions.removePlayer(player.id)}>{player.pendingRemove ? "Undo" : "Remove"}</button>
      </li>;
    })}</ul>
    <h3 className="ds-org-label ds-org-sub">Arrived late?</h3>
    {absent.length > 0 && <div className="ds-org-form-row">
      <select className="ds-input" aria-label="Late arrival" value={state.addExistingId} onChange={(event) => actions.updateAddExisting(event.target.value)}>
        <option value="">Choose a player…</option>{absent.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select><button className="ds-btn tertiary ds-org-form-btn" onClick={actions.addExistingPlayer}>+ Add</button>
    </div>}
    <PlayerForm state={state} actions={actions} duringPlay />
    <p className="ds-hint">Removing someone mid-game marks them “leaving after this game” — they drop out once that court finishes (tap again to undo).</p>
  </section>;
}
