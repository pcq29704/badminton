// Shared sign-in layout: top nav, title column with the form.
// viewer ({ role, username }) is set on signed-in pages; it swaps the public links for the dashboard menu.
export function TopNav({ current, viewer, onSignOut }) {
  return <nav className="ds-nav" aria-label="Main">
    <div className="ds-nav-inner">
      <a className="ds-brand" href={viewer ? "/dashboard" : "/"}><img className="ds-brand-mark" src="/assets/brand/crown-shuttle-nav.png" width="32" height="32" alt="" />Court Balancer</a>
      {viewer ? <>
        <a className="ds-chip" href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}>Dashboard</a>
        <a className="ds-chip" href="/ranking" aria-current={current === "ranking" ? "page" : undefined}>Ranking</a>
        {viewer.role === "player" && <a className="ds-chip" href={`/?u=${encodeURIComponent(viewer.username)}`} aria-current={current === "profile" ? "page" : undefined}>My profile</a>}
        <button className="ds-chip" type="button" onClick={onSignOut}>Sign out</button>
      </> : (current === "player" || current === "organiser") && <>
        <a className="ds-chip" href="/" aria-current={current === "player" ? "page" : undefined}>Player</a>
        <a className="ds-chip" href="/organiser" aria-current={current === "organiser" ? "page" : undefined}>Organiser</a>
      </>}
    </div>
  </nav>;
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
    </main>
  </div>;
}
