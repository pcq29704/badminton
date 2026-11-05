import { Delta, PlayerTag, isNewPlayer } from "./Shared";

export default function StatsPanel({ state }) {
  return <section className="cb-org-group"><h2 className="cb-org-label">Today</h2>
    <div className="cb-org-stat cb-org-stat-head"><span>Player</span><span>Rating · games</span></div>
    {[...state.players].sort((a, b) => b.elo - a.elo).map((player) => <div className="cb-org-stat" key={player.id}>
      <PlayerTag player={player} size="sm">{isNewPlayer(player, state.settings) && <span className="cb-org-note">new</span>}
        {player.status === "break" && <span className="cb-org-status rest">break</span>}{player.status === "keen" && <span className="cb-org-status keen">keen ⚡</span>}
      </PlayerTag>
      <span><b>{Math.round(player.elo)}</b> {Math.round(player.elo - player.eloStart) !== 0 && <Delta value={player.elo - player.eloStart} />} · {player.games}{player.consec >= 2 ? " 💃" : ""}</span>
    </div>)}
  </section>;
}
