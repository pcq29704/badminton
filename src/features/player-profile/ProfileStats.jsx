import PlayerAvatar from "@/components/PlayerAvatar";
import { Card } from "@/components/ui";
import { profileHref } from "../court-balancer/helpers";

const weekLabel = (index, total) => (index === total - 1 ? "Now" : `-${total - 1 - index}w`);
const record = (entry) => `${entry.wins}–${entry.games - entry.wins}`;
const winPercent = (entry) => (entry.games ? Math.round((entry.wins / entry.games) * 100) : 0);

function PlayerName({ entry, className }) {
  return entry.username
    ? <a className={className} href={profileHref(entry.username)}>{entry.name}</a>
    : <span className={className}>{entry.name}</span>;
}

// Rows of players with their framed avatar, a win bar, and the record with this player.
function Ledger({ rows, empty }) {
  if (!rows.length) return <p className="cb-empty">{empty}</p>;
  return <ul className="cb-ledger">{rows.map((row) => <li key={row.username || row.name}>
    <PlayerAvatar className="cb-avatar-sm" path={row.profile_image_path} tier={row.tier} name={row.name} />
    <div>
      <PlayerName entry={row} className="cb-ledger-name" />
      <span className="cb-ledger-bar" aria-hidden="true"><i style={{ width: `${winPercent(row)}%` }} /></span>
    </div>
    <span className="cb-ledger-rec"><b>{record(row)}</b> · {row.games} games<span className="cb-sr">, {winPercent(row)}% won</span></span>
  </li>)}</ul>;
}

// Overview tab: recent form, games per week, best partner, top partners, most faced.
export default function ProfileStats({ stats }) {
  if (!stats?.played) return <Card><p className="cb-empty">No finished games yet. Stats appear after the first game.</p></Card>;
  const peak = Math.max(1, ...stats.weekly);
  const formWins = stats.form.filter(Boolean).length;
  const best = stats.bestPartner;
  return <div className="cb-overview">
    <Card className="span2" title="Recent form" note="Newest first">
      <ol className="cb-results" aria-label={`Last ${stats.form.length} results, newest first`}>{stats.form.map((won, index) =>
        <li key={index} className={`cb-token ${won ? "w" : "l"}`}><span aria-hidden="true">{won ? "W" : "L"}</span><span className="cb-sr">{won ? "Win" : "Loss"}</span></li>)}</ol>
      <p className="cb-results-sum cb-note"><b>{formWins} {formWins === 1 ? "win" : "wins"}</b> in the last {stats.form.length} {stats.form.length === 1 ? "game" : "games"}</p>
    </Card>

    <Card className={best ? "" : "span2"} title="Games per week" note="Last 8 weeks">
      <div className="cb-bars" aria-hidden="true">{stats.weekly.map((count, index) =>
        <div key={index} className={`cb-bar${count ? "" : " zero"}${index === stats.weekly.length - 1 ? " now" : ""}`} style={{ height: `${Math.max(4, (count / peak) * 100)}%` }} title={`${count} games`} />)}</div>
      <div className="cb-bar-labels" aria-hidden="true">{stats.weekly.map((_, index) =>
        <span key={index} className={index === stats.weekly.length - 1 ? "now" : undefined}>{weekLabel(index, stats.weekly.length)}</span>)}</div>
      <p className="cb-sr">Games per week, oldest first: {stats.weekly.join(", ")}.</p>
    </Card>

    {best && <Card title="Best partner" note="Highest win rate together">
      <div className="cb-ally">
        <PlayerAvatar className="cb-avatar-lg" path={best.profile_image_path} tier={best.tier} name={best.name} />
        <div className="cb-ally-text">
          <p className="cb-ally-name"><PlayerName entry={best} className="cb-link" /></p>
          <dl className="cb-ally-rec">
            <div><dt className="cb-label">Together</dt><dd>{record(best)}</dd></div>
            <div><dt className="cb-label">Win rate</dt><dd>{winPercent(best)}%</dd></div>
          </dl>
        </div>
      </div>
    </Card>}

    <Card title="Top partners" note="Most games together">
      <Ledger rows={stats.partners} empty="No partners yet." />
    </Card>
    <Card title="Most faced" note="Most games against">
      <Ledger rows={stats.opponents} empty="No opponents yet." />
    </Card>
  </div>;
}
