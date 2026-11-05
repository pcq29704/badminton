"use client";

import { useRef } from "react";

// Tab row (DESIGN.md, Components > Tabs). `tabs` is [{ id, label }]. Each tab controls the panel with id `${idBase}-${id}`;
// give that panel role="tabpanel" and aria-labelledby={`${idBase}-tab-${id}`} (see tabPanelProps).
// Left/Right move between tabs, Home/End jump to the ends; only the active tab is in the Tab order.
export default function Tabs({ tabs, active, onChange, label, idBase = "tabs" }) {
  const refs = useRef([]);

  function onKeyDown(event, index) {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return <div className="cb-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab, index) => <button
      key={tab.id}
      ref={(node) => { refs.current[index] = node; }}
      id={`${idBase}-tab-${tab.id}`}
      className="cb-tab"
      type="button"
      role="tab"
      aria-selected={active === tab.id}
      aria-controls={`${idBase}-${tab.id}`}
      tabIndex={active === tab.id ? 0 : -1}
      onClick={() => onChange(tab.id)}
      onKeyDown={(event) => onKeyDown(event, index)}
    >{tab.label}</button>)}
  </div>;
}

export function tabPanelProps(idBase, id) {
  return { id: `${idBase}-${id}`, role: "tabpanel", "aria-labelledby": `${idBase}-tab-${id}` };
}
