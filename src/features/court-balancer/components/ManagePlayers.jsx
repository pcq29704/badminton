import { playingIds } from "../matchmaking";
import { isDebug } from "../helpers";
import { PlayerForm, PlayerTag } from "./Shared";

export default function ManagePlayers({ state, actions }) {
  const busy = playingIds(state);
  const here = new Set(state.players.map((p) => p.id));
  const absent = state.roster.filter((p) => !here.has(p.id));
  return <section className="cb-org-group">
    <h2 className="cb-org-label">Manage players</h2>
    <ul className="cb-org-rows">{state.players.map((player) => {
      const status = player.pendingRemove ? ["danger", "leaving after this game…"] : player.status === "break" ? ["rest", "on break"] : busy.has(player.id) ? ["keen", "on court"] : ["", "waiting"];
      return <li className="cb-org-row" key={player.id}>
        <PlayerTag player={player}>{isDebug() && <span className="cb-org-note">{Math.round(player.elo)}</span>}</PlayerTag>
        <span className={`cb-org-status ${status[0]}`}>{status[1]}</span>
        <button className="cb-btn quiet mini" onClick={() => actions.removePlayer(player.id)}>{player.pendingRemove ? "Undo" : "Remove"}</button>
      </li>;
    })}</ul>
    <h3 className="cb-org-label cb-org-sub">Arrived late?</h3>
    {absent.length > 0 && <div className="cb-org-form-row">
      <select className="cb-input" aria-label="Late arrival" value={state.addExistingId} onChange={(event) => actions.updateAddExisting(event.target.value)}>
        <option value="">Choose a player…</option>{absent.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select><button className="cb-btn quiet" onClick={actions.addExistingPlayer}>Add</button>
    </div>}
    <PlayerForm state={state} actions={actions} duringPlay />
    <p className="cb-note">Removing someone mid-game marks them “leaving after this game” — they drop out once that court finishes (tap again to undo).</p>
  </section>;
}
