import PlayerAvatar from "@/components/PlayerAvatar";
import { formatDelta } from "@/features/court-balancer/scoring.mjs";
import { Card } from "@/components/ui";
import { profileHref } from "../court-balancer/helpers";
import EloJourney from "./EloJourney";

const winPercent = (entry) => (entry.games ? Math.round((entry.wins / entry.games) * 100) : 0);
const scoreText = (score) => (score ? `${score.mine}–${score.theirs}` : "");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function PlayerName({ entry, className }) {
  return entry.username
    ? <a className={className} href={profileHref(entry.username)}>{entry.name}</a>
    : <span className={className}>{entry.name}</span>;
}

// "Won 3 · Lost 2": the profile owner's results in games with or against this player.
const Record = ({ entry }) => <span className="cb-ledger-rec">Won <b>{entry.wins}</b> · Lost <b>{entry.losses}</b></span>;

// A win-versus-loss bar: green for the owner's wins, grey-rose for losses.
function SplitBar({ wins, losses }) {
  const total = wins + losses || 1;
  return <span className="cb-split" aria-hidden="true"><i className="w" style={{ width: `${(wins / total) * 100}%` }} /><i className="l" style={{ width: `${(losses / total) * 100}%` }} /></span>;
}

function RivalRow({ entry }) {
  return <li>
    <PlayerAvatar className="cb-avatar-sm" path={entry.profile_image_path} tier={entry.tier} name={entry.name} />
    <div>
      <PlayerName entry={entry} className="cb-ledger-name" />
      <SplitBar wins={entry.wins} losses={entry.losses} />
    </div>
    <Record entry={entry} />
  </li>;
}

const STATUS = {
  nemesis: { label: "Your nemesis", line: (name) => `${name} has the upper hand.` },
  victim: { label: "Your victim", line: (name) => `You have the upper hand over ${name}.` },
  even: { label: "Neck and neck", line: (name) => `Too close to call between you and ${name}.` },
};

// The most-faced opponent as a tug of war between you and them.
function Spotlight({ rival, profile }) {
  const status = STATUS[rival.status];
  return <div className="cb-duel">
    <p className="cb-label cb-duel-tag">{status ? status.label : "Rivalry building"}</p>
    <div className="cb-duel-row">
      <div className="cb-duel-side">
        <PlayerAvatar className="cb-avatar-lg" path={profile.profile_image_path} tier={profile.tier} name={profile.name || profile.username} />
        <p className="cb-duel-name">You</p>
      </div>
      <p className="cb-duel-score" aria-label={`You won ${rival.wins}, ${rival.name} won ${rival.losses}`}>
        <b className="w">{rival.wins}</b><span aria-hidden="true">:</span><b className="l">{rival.losses}</b>
      </p>
      <div className="cb-duel-side">
        <PlayerAvatar className="cb-avatar-lg" path={rival.profile_image_path} tier={rival.tier} name={rival.name} />
        <p className="cb-duel-name"><PlayerName entry={rival} className="cb-link" /></p>
      </div>
    </div>
    <SplitBar wins={rival.wins} losses={rival.losses} />
    <p className="cb-note cb-duel-line">
      {plural(rival.games, "game")} against each other.{" "}
      {status ? status.line(rival.name) : `${MIN_LABEL_GAMES - rival.games} more ${MIN_LABEL_GAMES - rival.games === 1 ? "game" : "games"} to settle it.`}
    </p>
  </div>;
}
const MIN_LABEL_GAMES = 3;

function DuoBlock({ kind, entry }) {
  return <div className={`cb-duo ${kind}`}>
    <p className="cb-label">{kind === "best" ? "Best duo" : "Toughest duo"}</p>
    <div className="cb-duo-row">
      <PlayerAvatar className="cb-avatar-md" path={entry.profile_image_path} tier={entry.tier} name={entry.name} />
      <div>
        <PlayerName entry={entry} className="cb-ledger-name" />
        <p className="cb-note">Won {entry.wins} of {entry.games} together · {winPercent(entry)}%</p>
        <SplitBar wins={entry.wins} losses={entry.losses} />
      </div>
    </div>
  </div>;
}

function Cell({ label, children, note }) {
  return <div className="cb-cell"><dt className="cb-label">{label}</dt><dd>{children}</dd>{note && <p className="cb-note">{note}</p>}</div>;
}

// Overview tab: Elo journey, recent form with scores, rivalries, duos, win quality and records.
export default function ProfileStats({ stats, profile }) {
  if (!stats?.played) return <Card><p className="cb-empty">No finished games yet. Stats appear after the first game.</p></Card>;
  const formWins = stats.form.filter(Boolean).length;
  const [spotlight, ...otherRivals] = stats.rivals;
  const { best, worst } = stats.duos;
  const q = stats.quality;
  const r = stats.records;
  return <div className="cb-overview">
    <EloJourney stats={stats} elo={profile.elo} tier={profile.tier} />

    <Card className="span2" title="Recent form" note="Newest first, with the score">
      <ol className="cb-results" aria-label={`Last ${stats.recent.length} results, newest first`}>{stats.recent.map((game, index) =>
        <li key={index} className="cb-form" title={`${game.won ? "Won" : "Lost"}${game.score ? ` ${scoreText(game.score)}` : ""} against ${game.against.join(" and ")}`}>
          <span className={`cb-token ${game.won ? "w" : "l"}`}><span aria-hidden="true">{game.won ? "W" : "L"}</span></span>
          <span className="cb-form-score" aria-hidden="true">{game.score ? scoreText(game.score) : "–"}</span>
          <span className="cb-sr">{game.won ? "Win" : "Loss"}{game.score ? `, ${game.score.mine} to ${game.score.theirs}` : ""}, against {game.against.join(" and ")}</span>
        </li>)}</ol>
      <p className="cb-results-sum cb-note"><b>{plural(formWins, "win")}</b> in the last {plural(stats.recent.length, "game")} · played in {stats.activeWeeks} of the last 8 weeks</p>
    </Card>

    <Card className="span2" title="Rivalries" note="Your record against the players you face most">
      <Spotlight rival={spotlight} profile={profile} />
      {otherRivals.length > 0 && <ul className="cb-ledger cb-rivals">{otherRivals.map((entry) => <RivalRow key={entry.username || entry.name} entry={entry} />)}</ul>}
    </Card>

    <Card title="Duos" note="Your record with a partner, from 3 games together">
      {best
        ? <>
          <DuoBlock kind="best" entry={best} />
          {worst && <DuoBlock kind="worst" entry={worst} />}
        </>
        : <p className="cb-empty">Play 3 games with the same partner to see your best duo.</p>}
    </Card>

    <Card title="Win quality" note="How your games are decided">
      {q
        ? <dl className="cb-cells">
          <Cell label="Average win">{q.avgWinMargin == null ? "–" : `+${q.avgWinMargin}`}<span className="cb-unit"> pts</span></Cell>
          <Cell label="Average loss">{q.avgLossMargin == null ? "–" : `−${q.avgLossMargin}`}<span className="cb-unit"> pts</span></Cell>
          <Cell label="Close games" note="Decided by 2 or fewer">Won {q.closeWins} · Lost {q.closeLosses}</Cell>
          <Cell label="Blowouts" note="Decided by 10 or more">Won {q.blowoutWins} · Lost {q.blowoutLosses}</Cell>
        </dl>
        : <p className="cb-empty">Scores appear here once your games are recorded with points.</p>}
      {q && <p className="cb-note cb-cells-foot">From {plural(q.scored, "game")} with a score.</p>}
    </Card>

    <Card className="span2" title="Records" note="Your personal bests">
      <dl className="cb-cells four">
        <Cell label="Peak Elo">{r.peakElo == null ? "–" : Math.round(r.peakElo)}</Cell>
        <Cell label="Best streak" note="Wins in a row">{r.bestStreak}</Cell>
        <Cell label="Biggest win" note={r.biggestWin?.score ? `${scoreText(r.biggestWin.score)}` : undefined}>{r.biggestWin ? `+${r.biggestWin.margin}` : "–"}</Cell>
        <Cell label="Biggest Elo gain" note="In one game">{r.biggestGain ? formatDelta(r.biggestGain.change) : "–"}</Cell>
      </dl>
      {stats.giantSlayer && <p className="cb-giant"><b>Giant slayer.</b> Against teams rated higher than yours you won {stats.giantSlayer.wins} of {stats.giantSlayer.games}.</p>}
    </Card>
  </div>;
}
