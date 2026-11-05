import { RankIcon } from "../../components/PlayerAvatar";
import { RANK_NAMES } from "../../lib/rank-names";

// Tiers from lowest to highest, shown left to right.
const RANKS = ["D", "C", "B", "A", "S"].map((tier) => ({ tier, name: RANK_NAMES[tier] }));

export default function RankLadder() {
  return <section className="ds-ladder" aria-labelledby="ladder-title">
    <h2 id="ladder-title" className="ds-title ds-ranking-title">Ranks</h2>
    <ol className="ds-ladder-list">{RANKS.map(({ tier, name }) => <li key={tier} className="ds-ladder-step" data-tier={tier}>
      <RankIcon tier={tier} className="ds-ladder-badge" />
      <span className="ds-ladder-name">{name}</span>
    </li>)}</ol>
  </section>;
}
