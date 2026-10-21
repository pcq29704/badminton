// Shared sign-in layout: top nav, title column with the form, and a sample-stats preview column.
// viewer ({ role, username }) is set on signed-in pages; it swaps the public links for the dashboard menu.
export function TopNav({ current, viewer, onSignOut }) {
  return <nav className="ds-nav" aria-label="Main">
    <div className="ds-nav-inner">
      <a className="ds-brand" href={viewer ? "/dashboard" : "/"}><span className="ds-brand-mark" aria-hidden="true">🏸</span>Court Balancer</a>
      {viewer ? <>
        <a className="ds-chip" href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}>Dashboard</a>
        {viewer.role === "player" && <a className="ds-chip" href={`/?u=${encodeURIComponent(viewer.username)}`}>My profile</a>}
        {viewer.role === "organiser" && <a className="ds-chip" href="/organiser">Court manager</a>}
        <button className="ds-chip" type="button" onClick={onSignOut}>Sign out</button>
      </> : <>
        <a className="ds-chip" href="/" aria-current={current === "player" ? "page" : undefined}>Player</a>
        <a className="ds-chip" href="/organiser" aria-current={current === "organiser" ? "page" : undefined}>Organiser</a>
      </>}
    </div>
  </nav>;
}

function Preview() {
  return <div className="ds-auth-preview" aria-hidden="true">
    <div className="ds-preview-tile a"><div><div className="ds-tile-label">Sample · Elo</div><div className="big">1240</div></div><span className="pill">Your rating</span></div>
    <div className="ds-preview-tile b"><div><div className="ds-tile-label">Sample · Tier</div><div className="big">A</div></div><span className="pill">Climb tiers</span></div>
    <div className="ds-preview-tile c"><div><div className="ds-tile-label">Sample · Win rate</div><div className="big">62%</div></div><span className="pill">See your form</span></div>
    <div className="ds-preview-tile d"><div><div className="ds-tile-label">Sample · Partners</div><div className="big">12</div></div><span className="pill">Find your best pair</span></div>
  </div>;
}

export default function AuthShell({ current, eyebrow, title, lead, cardTitle, children }) {
  return <div className="ds-root">
    <TopNav current={current} />
    <main className="ds-auth">
      <div>
        <div className="ds-eyebrow">{eyebrow}</div>
        <h1 className="ds-title">{title}</h1>
        <p className="ds-lead">{lead}</p>
        <section className="ds-auth-card" aria-label={cardTitle}>
          <h2 className="ds-card-title">{cardTitle}</h2>
          {children}
        </section>
      </div>
      <Preview />
    </main>
  </div>;
}
