import Card from "./Card";

// One card split into equal cells (DESIGN.md, Components > Stat strip). `items` is [{ label, value, unit, note }].
export default function StatStrip({ items, label = "Summary" }) {
  return <Card className="cb-stats" aria-label={label} style={{ "--cb-stat-count": items.length }}>
    {items.map((item) => <div className="cb-stat" key={item.label}>
      <span className="cb-label">{item.label}</span>
      <span className="cb-stat-value">{item.value}{item.unit && <small>{item.unit}</small>}</span>
      {item.note && <span className="cb-note">{item.note}</span>}
    </div>)}
  </Card>;
}
