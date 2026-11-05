// Status or error message (DESIGN.md, Components > Notices). Errors are announced at once (role="alert").
export default function Notice({ tone = "status", children }) {
  if (!children) return null;
  return <p className={`cb-notice${tone === "error" ? " error" : ""}`} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}
