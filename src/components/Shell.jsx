import { TopNav } from "@/components/AuthShell";

export default function Shell({ children, current = "player", viewer, onSignOut }) {
  return <div className="ds-root"><TopNav current={current} viewer={viewer} onSignOut={onSignOut} /><main className="ds-page">{children}</main></div>;
}
