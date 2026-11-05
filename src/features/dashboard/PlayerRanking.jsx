import { Card } from "../../components/ui";
import PlayerAvatar, { RankIcon, tierKey } from "../../components/PlayerAvatar";
import { RANK_NAMES } from "../../lib/rank-names";

export default function PlayerRanking({ ranking, viewer }) {
  return <Card title="Player ranking" note={ranking.length ? `${ranking.length} players, best Elo first.` : undefined} className="cb-ranking">
    {ranking.length ? <table className="cb-rank-table">
      <thead>
        <tr>
          <th scope="col" className="cb-c-pos">#</th>
          <th scope="col">Player</th>
          <th scope="col" className="cb-c-tier">Tier</th>
          <th scope="col" className="cb-c-elo">Elo</th>
        </tr>
      </thead>
      <tbody>{ranking.map((player, index) => {
        const me = Boolean(viewer?.username) && player.username === viewer.username;
        const name = `${player.name}${me ? " (you)" : ""}`;
        const tier = tierKey(player.tier).toUpperCase();
        return <tr key={`${player.username}-${player.name}-${index}`} data-tier={tier || undefined} className={me ? "cb-me" : undefined}>
          <td className="cb-c-pos">{index + 1}</td>
          <td>
            <div className="cb-rank-player">
              <PlayerAvatar className="cb-avatar-sm" path={player.profile_image_path} tier={player.tier} name={player.name} />
              <span className="cb-rank-who">
                {player.username
                  ? <a href={`/profile?u=${encodeURIComponent(player.username)}`} className="cb-ledger-name">{name}</a>
                  : <span className="cb-ledger-name">{name}</span>}
                {tier && <span className="cb-rank-title">{RANK_NAMES[tier]}</span>}
              </span>
            </div>
          </td>
          <td className="cb-c-tier"><RankIcon tier={player.tier} className="cb-rank-badge" /></td>
          <td className="cb-c-elo">{Math.round(player.elo)}</td>
        </tr>;
      })}</tbody>
    </table> : <p className="cb-empty">No players yet.</p>}
  </Card>;
}
