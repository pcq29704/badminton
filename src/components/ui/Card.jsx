// Filigree card (DESIGN.md, Components > Card): a square frame with a double gold line and four bracket corners.
// `title` and `note` make the centred head; `tools` sits under the head (filter chips); `footer` is a centred link row.
export default function Card({ as: Tag = "section", title, titleAs: Title = "h2", note, tools, footer, className = "", children, ...rest }) {
  return <Tag className={`cb-card ${className}`.trim()} {...rest}>
    <span className="cb-corner tl" aria-hidden="true" />
    <span className="cb-corner tr" aria-hidden="true" />
    <span className="cb-corner bl" aria-hidden="true" />
    <span className="cb-corner br" aria-hidden="true" />
    {(title || note) && <div className="cb-card-head">
      {title && <Title className="cb-title">{title}</Title>}
      {note && <p className="cb-note">{note}</p>}
      <span className="cb-rule" aria-hidden="true"><i /></span>
      {tools && <div className="cb-card-tools">{tools}</div>}
    </div>}
    {children}
    {footer && <div className="cb-card-foot">{footer}</div>}
  </Tag>;
}
