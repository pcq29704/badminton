import { RankIcon } from "../../components/PlayerAvatar";

// Tiers from lowest to highest, shown left to right.
const RANKS = [
  { tier: "D", name: "Ếch vồ hoa mướp" },
  { tier: "C", name: "Lính mới ôm sào" },
  { tier: "B", name: "Bác tiều đốn củi" },
  { tier: "A", name: "Ngư ông thả lưới" },
  { tier: "S", name: "Trạng nguyên múa vợt" },
];

export default function RankLadder() {
  return <section className="ds-ladder" aria-labelledby="ladder-title">
    <h2 id="ladder-title" className="ds-title ds-ranking-title">Ranks</h2>
    <ol className="ds-ladder-list">{RANKS.map(({ tier, name }) => <li key={tier} className="ds-ladder-step" data-tier={tier}>
      <RankIcon tier={tier} className="ds-ladder-badge" />
      <span className="ds-ladder-name">{name}</span>
    </li>)}</ol>
  </section>;
}
