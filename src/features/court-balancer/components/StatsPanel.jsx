import { Delta, TierBadge, isNewPlayer } from "./Shared";

export default function StatsPanel({ state }) {
  return <div className="card"><div className="label" style={{ marginBottom: 8 }}>Today</div>
    <div className="stat-row stat-head"><span>Player</span><span>Rating · games</span></div>
    {[...state.players].sort((a, b) => b.elo - a.elo).map((player) => <div className="stat-row" key={player.id}>
      <span>{player.name} <TierBadge code={player.tier} />{isNewPlayer(player, state.settings) && <span className="elo"> new</span>}
        {player.status === "break" && <span style={{ color: "var(--rest)" }}> · break</span>}{player.status === "keen" && <span style={{ color: "var(--keen)" }}> · keen ⚡</span>}
      </span>
      <span><b>{Math.round(player.elo)}</b> {Math.round(player.elo - player.eloStart) !== 0 && <Delta value={player.elo - player.eloStart} />} · {player.games}{player.consec >= 2 ? " 🔥" : ""}</span>
    </div>)}
  </div>;
}
