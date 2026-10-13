import { playingIds } from "../matchmaking";
import { PlayerForm, ProfileName } from "./Shared";

export default function ManagePlayers({ state, actions }) {
  const busy = playingIds(state);
  const here = new Set(state.players.map((p) => p.id));
  const absent = state.roster.filter((p) => !here.has(p.id));
  return <div className="card">
    <div className="label" style={{ marginBottom: 8 }}>Manage players</div>
    {state.players.map((player) => {
      const status = player.pendingRemove ? ["var(--danger)", "leaving after this game…"] : player.status === "break" ? ["var(--rest)", "on break"] : busy.has(player.id) ? ["var(--keen)", "on court"] : ["var(--dim)", "waiting"];
      return <div className="player-row" style={{ alignItems: "center" }} key={player.id}>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}><ProfileName player={player} /> <span className="elo">{Math.round(player.elo)}</span></div><div style={{ fontSize: 11, color: status[0] }}>{status[1]}</div></div>
        <button className="mini-btn" onClick={() => actions.removePlayer(player.id)}>{player.pendingRemove ? "Undo" : "Remove"}</button>
      </div>;
    })}
    <div className="label" style={{ margin: "14px 0 6px" }}>Arrived late?</div>
    {absent.length > 0 && <div className="player-row">
      <select aria-label="Late arrival" style={{ flex: 1, padding: "9px 6px" }} value={state.addExistingId} onChange={(event) => actions.updateAddExisting(event.target.value)}>
        <option value="">Choose a player…</option>{absent.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select><button className="btn subtle" onClick={actions.addExistingPlayer}>+ Add</button>
    </div>}
    <PlayerForm state={state} actions={actions} duringPlay />
    <p className="hint" style={{ fontSize: 11 }}>Removing someone mid-game marks them “leaving after this game” — they drop out once that court finishes (tap again to undo).</p>
  </div>;
}
