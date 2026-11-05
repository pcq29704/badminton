// Label above, control, hint below (DESIGN.md, Components > Inputs). Pass the control's id as `htmlFor`.
// The hint gets the id `${htmlFor}-hint`; point the control's aria-describedby at it.
export default function Field({ label, htmlFor, hint, children }) {
  return <div className="cb-field">
    <label className="cb-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <p className="cb-note" id={`${htmlFor}-hint`}>{hint}</p>}
  </div>;
}
