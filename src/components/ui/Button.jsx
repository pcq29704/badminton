// Pointed-end button (DESIGN.md, Components > Buttons). `variant` is "primary" (gold, one per card) or "quiet".
// With `href` it renders a link; otherwise a button that defaults to type="button".
export default function Button({ variant = "primary", href, type = "button", className = "", children, ...rest }) {
  const classes = `cb-btn${variant === "quiet" ? " quiet" : ""} ${className}`.trim();
  if (href) return <a className={classes} href={href} {...rest}>{children}</a>;
  return <button className={classes} type={type} {...rest}>{children}</button>;
}
