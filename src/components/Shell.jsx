import { TopNav } from "@/components/AuthShell";

// `page` is the class of the main element: "ds-page" for screens on the old system, "cb-page" for the new one (DESIGN.md).
export default function Shell({ children, current = "player", viewer, onSignOut, page = "ds-page", pageProps }) {
  return <div className="ds-root"><TopNav current={current} viewer={viewer} onSignOut={onSignOut} /><main className={page} {...pageProps}>{children}</main></div>;
}
