// Shared sign-in layout: top nav, title column with the form.
// The nav is the same on every page. viewer ({ role, username }) is set on signed-in pages and adds the
// dashboard menu; signed-out visitors see only the brand.
export function TopNav({ current, viewer, onSignOut }) {
  return <nav className="ds-nav" aria-label="Main">
    <div className="ds-nav-inner">
      <a className="ds-brand" href={viewer ? "/dashboard" : "/"}><img className="ds-brand-mark" src="/assets/brand/crown-shuttle-nav.png" width="32" height="32" alt="" /><span className="ds-brand-text">Court Balancer</span></a>
      {viewer && <>
        <a className="ds-chip" href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}>Dashboard</a>
        <a className="ds-chip" href="/ranking" aria-current={current === "ranking" ? "page" : undefined}>Ranking</a>
        {viewer.role === "organiser" && <a className="ds-chip" href="/organiser" aria-current={current === "courts" ? "page" : undefined}>Courts</a>}
        {viewer.role === "player" && <a className="ds-chip" href={`/?u=${encodeURIComponent(viewer.username)}`} aria-current={current === "profile" ? "page" : undefined}><span className="ds-chip-extra">My </span>profile</a>}
        <button className="ds-chip" type="button" onClick={onSignOut}>Sign out</button>
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
          <div className="ds-tabs ds-role-switch" role="group" aria-label="Sign in as">
            <a className="ds-chip" href="/" aria-current={current === "player" ? "page" : undefined}>Player</a>
            <a className="ds-chip" href="/organiser" aria-current={current === "organiser" ? "page" : undefined}>Organizer</a>
          </div>
          <h2 className="ds-card-title">{cardTitle}</h2>
          {children}
        </section>
      </div>
    </main>
  </div>;
}
