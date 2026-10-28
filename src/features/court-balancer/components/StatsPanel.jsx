import { Delta, PlayerTag, isNewPlayer } from "./Shared";

export default function StatsPanel({ state }) {
  return <section className="ds-org-card"><h2 className="ds-org-label">Today</h2>
    <div className="ds-org-stat ds-org-stat-head"><span>Player</span><span>Rating · games</span></div>
    {[...state.players].sort((a, b) => b.elo - a.elo).map((player) => <div className="ds-org-stat" key={player.id}>
      <PlayerTag player={player} size="sm">{isNewPlayer(player, state.settings) && <span className="ds-org-note">new</span>}
        {player.status === "break" && <span className="ds-org-status rest">break</span>}{player.status === "keen" && <span className="ds-org-status keen">keen ⚡</span>}
      </PlayerTag>
      <span><b>{Math.round(player.elo)}</b> {Math.round(player.elo - player.eloStart) !== 0 && <Delta value={player.elo - player.eloStart} />} · {player.games}{player.consec >= 2 ? " 💃" : ""}</span>
    </div>)}
  </section>;
}
