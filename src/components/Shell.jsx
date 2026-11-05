import { TopNav } from "@/components/AuthShell";

// `page` is the class of the main element (DESIGN.md).
export default function Shell({ children, current = "player", viewer, onSignOut, page = "cb-page", pageProps }) {
  return <div className="cb-root"><TopNav current={current} viewer={viewer} onSignOut={onSignOut} /><main className={page} {...pageProps}>{children}</main></div>;
}
