import { Card } from "../../components/ui";
import { RankIcon } from "../../components/PlayerAvatar";
import { RANK_NAMES } from "../../lib/rank-names";

// Tiers from lowest to highest, shown left to right.
const RANKS = ["D", "C", "B", "A", "S"].map((tier) => ({ tier, name: RANK_NAMES[tier] }));

export default function RankLadder() {
  return <section aria-labelledby="ladder-title">
    <h2 id="ladder-title" className="cb-sr">The five ranks, lowest to highest</h2>
    <ol className="cb-ladder">{RANKS.map(({ tier, name }, index) => <li key={tier} data-tier={tier} style={{ "--cb-step": index }}>
      <Card as="div" className="cb-rung">
        <span className="cb-rung-art"><RankIcon tier={tier} /></span>
        <span className="cb-rung-name">{name}</span>
      </Card>
    </li>)}</ol>
  </section>;
}
