import { Card } from "@/components/ui";

// Shared sign-in layout: top nav, title column with the form.
// The nav is the same on every page. viewer ({ role, username }) is set on signed-in pages and adds the
// dashboard menu; signed-out visitors see only the brand.
export function TopNav({ current, viewer, onSignOut }) {
  return <nav className="cb-nav" aria-label="Main">
    <div className="cb-nav-inner">
      <a className="cb-brand" href={viewer ? "/dashboard" : "/"}><img src="/assets/brand/crown-shuttle-nav.png" width="34" height="34" alt="" /><span className="cb-brand-text">Court Balancer</span></a>
      {viewer && <>
        <a className="cb-navlink" href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}>Dashboard</a>
        <a className="cb-navlink" href="/ranking" aria-current={current === "ranking" ? "page" : undefined}>Ranking</a>
        {viewer.role === "organiser" && <a className="cb-navlink" href="/organiser" aria-current={current === "courts" ? "page" : undefined}>Courts</a>}
        {viewer.role === "player" && <a className="cb-navlink" href={`/?u=${encodeURIComponent(viewer.username)}`} aria-current={current === "profile" ? "page" : undefined}><span className="cb-navlink-extra">My&nbsp;</span>profile</a>}
        <button className="cb-navlink" type="button" onClick={onSignOut}>Sign out</button>
      </>}
    </div>
  </nav>;
}

export default function AuthShell({ current, title, lead, cardTitle, children }) {
  return <div className="cb-root">
    <TopNav current={current} />
    <main className="cb-page cb-auth">
      <header className="cb-auth-head">
        <h1 className="cb-auth-title">{title}</h1>
        <p className="cb-note">{lead}</p>
      </header>
      <Card title={cardTitle} className="cb-auth-card">
        <div className="cb-chips cb-roles" role="group" aria-label="Sign in as">
          <a className="cb-chip" href="/" aria-current={current === "player" ? "page" : undefined}>Player</a>
          <a className="cb-chip" href="/organiser" aria-current={current === "organiser" ? "page" : undefined}>Organiser</a>
        </div>
        {children}
      </Card>
    </main>
  </div>;
}
