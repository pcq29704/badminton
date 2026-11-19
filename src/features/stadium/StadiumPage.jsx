"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import Shell from "@/components/Shell";
import { Notice } from "@/components/ui";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { profileHref } from "../court-balancer/helpers";
import { useClubGames } from "../dashboard/useClubGames";
import { RANKING_WALL } from "./constants";
import { computeHonours, rankingBoard } from "./honours.mjs";
import "./stadium.css";

function StadiumLoading() {
  return <div className="cb-stadium-loading" role="status">
    <span className="cb-stadium-gem" aria-hidden="true" />
    <span className="cb-label">Loading the stadium…</span>
  </div>;
}

// three.js, drei and Rapier load only on this page, and only in the browser.
const StadiumScene = dynamic(() => import("./StadiumScene"), { ssr: false, loading: StadiumLoading });

const noWebGL = <div className="cb-stadium-loading"><Notice tone="error">This browser cannot show 3D (WebGL is off or not supported).</Notice></div>;

// Back goes to the page the player came from, or to the dashboard when they opened this page directly.
function BackLink() {
  const router = useRouter();
  const onClick = (event) => {
    const fromApp = document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (!fromApp || window.history.length < 2) return;
    event.preventDefault();
    router.back();
  };
  return <a className="cb-back cb-link" href="/dashboard" onClick={onClick}>← Back</a>;
}

// The hint near the ranking banner or an honour banner. aria-live, so screen readers hear it change.
function TargetHint({ target }) {
  return <p className="cb-stadium-prompt" aria-live="polite">
    {target && <>
      <span className="cb-stadium-prompt-what">{target.title}</span>
      {target.username
        ? <><b>{target.name}</b><span className="cb-stadium-prompt-do">Tap / press <kbd>E</kbd> to view profile</span></>
        : <span className="cb-stadium-prompt-do">{target.name}</span>}
    </>}
  </p>;
}

// The banners are drawn in 3D; this is the same ranking and honours as text, for screen readers.
function WallsText({ ranking, games, viewer }) {
  const board = useMemo(() => rankingBoard(ranking, viewer, RANKING_WALL.rows), [ranking, viewer]);
  const honours = useMemo(() => computeHonours(games, ranking), [games, ranking]);
  const line = (row) => `${row.position}. ${row.name}${row.me ? " (you)" : ""}, Elo ${Math.round(row.elo)}`;
  return <div className="cb-sr">
    <h2>Hall of Ranks</h2>
    {board.rows.length ? <ol>{board.rows.map((row) => <li key={row.position}>{line(row)}</li>)}</ol> : <p>No players yet</p>}
    {board.you && <p>Your place: {line(board.you)}</p>}
    <h2>Honours</h2>
    <ul>{honours.map((h) => <li key={h.key}>{h.title}: {h.holder ? `${h.holder.name}, ${h.stat}` : `Unclaimed (${h.rule})`}</li>)}</ul>
  </div>;
}

// Signed-in players and organisers only. Signed-out visitors go to "/" (sign-in), as on the dashboard.
export default function StadiumPage() {
  const router = useRouter();
  const { loading, viewer, games, ranking, error, signOut } = useClubGames();
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState(null);
  const openProfile = useCallback((username) => {
    if (username) router.push(profileHref(username));
  }, [router]);

  const shell = { current: "stadium", viewer, onSignOut: signOut, page: "cb-page cb-stadium" };
  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (error) return <Shell {...shell}><Notice tone="error">{error}</Notice></Shell>;
  if (loading || !viewer) return <Shell {...shell}><StadiumLoading /></Shell>;

  return <Shell {...shell}>
    <header className="cb-stadium-head">
      <BackLink />
      <h1 className="cb-stadium-title">Stadium <span className="cb-tag cb-beta">Beta</span></h1>
    </header>
    <section className="cb-stadium-stage" aria-label="3D stadium">
      <StadiumScene
        ranking={ranking}
        games={games}
        viewer={viewer}
        onTarget={setTarget}
        onOpenProfile={openProfile}
        onReady={() => setReady(true)}
        fallback={noWebGL}
      />
      {!ready && <StadiumLoading />}
      <p className="cb-stadium-hint">
        <span className="cb-stadium-hint-keys"><b>W A S D</b> or <b>arrows</b> move · <b>Shift</b> runs · <b>drag</b> to look · <b>click</b> the floor to walk there</span>
        <span className="cb-stadium-hint-touch"><b>Tap</b> the floor to walk there · <b>drag</b> to look</span>
      </p>
      <TargetHint target={ready ? target : null} />
      <WallsText ranking={ranking} games={games} viewer={viewer} />
    </section>
  </Shell>;
}
