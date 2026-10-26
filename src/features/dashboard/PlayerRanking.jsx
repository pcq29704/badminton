import PlayerAvatar, { RankIcon, tierKey } from "../../components/PlayerAvatar";

export default function PlayerRanking({ ranking, viewer }) {
  return <section className="ds-ranking" aria-labelledby="ranking-title">
    <h2 id="ranking-title" className="ds-title ds-ranking-title">Player ranking</h2>
    {ranking.length ? <div className="ds-table-wrap ds-ranking-wrap"><div className="ds-ranking-scroll"><table className="ds-table ds-ranking-table">
      <thead>
        <tr>
          <th scope="col" className="ds-rank-pos">#</th>
          <th scope="col">Player</th>
          <th scope="col" className="ds-rank-tier">Tier</th>
          <th scope="col" className="ds-rank-elo">Elo</th>
        </tr>
      </thead>
      <tbody>{ranking.map((player, index) => {
        const me = Boolean(viewer?.username) && player.username === viewer.username;
        const name = `${player.name}${me ? " (you)" : ""}`;
        return <tr key={`${player.username}-${player.name}-${index}`} data-tier={tierKey(player.tier).toUpperCase() || undefined} className={me ? "ds-rank-row me" : "ds-rank-row"}>
          <td className="ds-rank-pos">{index + 1}</td>
          <td>
            <div className="ds-rank-player">
              <PlayerAvatar className="ds-rank-avatar" path={player.profile_image_path} tier={player.tier} />
              {player.username
                ? <a href={`/profile.html?u=${encodeURIComponent(player.username)}`} className="ds-rank-name ds-rank-link">{name}</a>
                : <span className="ds-rank-name">{name}</span>}
            </div>
          </td>
          <td className="ds-rank-tier"><RankIcon tier={player.tier} className="ds-rank-badge" /></td>
          <td className="ds-rank-elo">{player.elo}</td>
        </tr>;
      })}</tbody>
    </table></div></div> : <p className="ds-empty">No players yet.</p>}
  </section>;
}
