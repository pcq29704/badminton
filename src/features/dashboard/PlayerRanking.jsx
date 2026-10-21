export default function PlayerRanking({ ranking, viewer }) {
  return <section className="ds-ranking" aria-labelledby="ranking-title">
    <h2 id="ranking-title" className="ds-ranking-title">Player ranking</h2>
    {ranking.length ? <ol className="ds-ranking-list">{ranking.map((player, index) => {
      const me = Boolean(viewer?.username) && player.username === viewer.username;
      const body = <>
        <span className="ds-rank-pos">{index + 1}</span>
        <span className="ds-rank-name">{player.name}{me ? " (you)" : ""}</span>
        <span className={`ds-tier t-${player.tier}`}>{player.tier}</span>
        <span className="ds-rank-elo">{player.elo}</span>
      </>;
      return <li key={`${player.username}-${player.name}-${index}`} className={me ? "ds-rank-row me" : "ds-rank-row"}>
        {player.username ? <a href={`/profile.html?u=${encodeURIComponent(player.username)}`} className="ds-rank-link">{body}</a> : <div className="ds-rank-link">{body}</div>}
      </li>;
    })}</ol> : <p className="ds-empty">No players yet.</p>}
  </section>;
}
