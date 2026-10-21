import { useMemo } from "react";
import { computeDashboard } from "./dashboard.mjs";
import { profileHref } from "../court-balancer/helpers";

const weekLabel = (index, total) => (index === total - 1 ? "Now" : `-${total - 1 - index}w`);
const record = (entry) => `${entry.wins}-${entry.games - entry.wins}`;

function Tile({ label, value, note, tone = "", className = "", children }) {
  return <div className={`ds-tile ${tone} ${className}`}>
    <div className="ds-tile-label">{label}</div>
    {value !== undefined && <div className="ds-tile-value">{value}</div>}
    {note && <div className="ds-tile-note">{note}</div>}
    {children}
  </div>;
}

function People({ title, rows, empty }) {
  return <Tile label={title} className="span2">
    {rows.length ? <ul className="ds-list">{rows.map((row) => <li key={row.name}>
      <span>{row.username ? <a href={profileHref(row.username)}>{row.name}</a> : row.name}</span>
      <span className="muted">{row.games} games · {record(row)}</span>
    </li>)}</ul> : <p className="ds-tile-note" style={{ marginTop: 12 }}>{empty}</p>}
  </Tile>;
}

export default function ProfileStats({ profile }) {
  const stats = useMemo(() => computeDashboard(profile.history, profile.username), [profile]);
  if (!stats.played) return <p className="ds-empty">No finished games yet. Stats appear after the first game.</p>;
  const peak = Math.max(1, ...stats.weekly);
  return <div className="ds-section">
    <h2 className="ds-h2">Overview</h2>
    <div className="ds-tile-grid">
      <Tile tone="mint" label="Elo" value={profile.elo} note={<><span className={`ds-tier t-${profile.tier}`}>{profile.tier}</span> tier</>} />
      <Tile tone="lime" label="Win rate" value={`${stats.winRate}%`} note={`${stats.wins} wins · ${stats.losses} losses`} />
      <Tile tone="sky" label="Games" value={profile.games_total ?? stats.played} note={stats.lastPlayed ? `Last on ${new Date(stats.lastPlayed).toLocaleDateString([], { dateStyle: "medium" })}` : undefined} />
      <Tile tone="sand" label="Win streak" value={stats.streak} note={`Best ${stats.bestStreak}`} />
      <Tile label="Recent form" className="span2" note="Newest first">
        <div className="ds-form" role="list" aria-label="Last results">{stats.form.map((won, index) =>
          <span key={index} role="listitem" className={`ds-result${won ? "" : " loss"}`} title={won ? "Win" : "Loss"}>{won ? "W" : "L"}</span>)}</div>
      </Tile>
      <Tile label="Games per week" className="span2" note="Last 8 weeks">
        <div className="ds-bars" aria-hidden="true">{stats.weekly.map((count, index) =>
          <div key={index} className={`ds-bar${count ? "" : " zero"}`} style={{ height: `${Math.max(4, (count / peak) * 100)}%` }} title={`${count} games`} />)}</div>
        <div className="ds-bar-labels" aria-hidden="true">{stats.weekly.map((_, index) => <span key={index}>{weekLabel(index, stats.weekly.length)}</span>)}</div>
      </Tile>
      <People title="Top partners" rows={stats.partners} empty="No partners yet." />
      <People title="Most faced opponents" rows={stats.opponents} empty="No opponents yet." />
      {stats.bestPartner && <Tile label="Best partner" value={stats.bestPartner.name} note={`${record(stats.bestPartner)} together`} className="span2" />}
    </div>
  </div>;
}
