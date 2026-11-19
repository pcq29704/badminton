"use client";

import { useEffect, useRef, useState } from "react";
import { formatDelta } from "@/features/court-balancer/scoring.mjs";
import { Card } from "@/components/ui";
import { TIER_BANDS, rankProgress } from "@/lib/tier-bands";

const MAX_POINTS = 40; // the chart shows the latest games only, so a long history stays readable
const PAD = { left: 44, right: 14, top: 18, bottom: 28 };

const scoreText = (score) => (score ? `${score.mine}–${score.theirs}` : "");
const shortDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

// Round axis steps (10, 20, 50, 100 ...) so the gridlines read as clean numbers.
function niceTicks(min, max, count) {
  const raw = (max - min) / count;
  const base = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * base).find((s) => s >= raw) || base * 10;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
  return ticks;
}

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// Elo over time. Drawn at real pixel size so the axis text matches the rest of the page.
function Chart({ points, peak, active, onActive }) {
  const box = useRef(null);
  const width = useWidth(box);
  const height = width && width < 420 ? 200 : 260;
  const last = points.length - 1;
  const values = points.map((point) => point.elo);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.max(high - low, 40);
  const min = low - spread * 0.15;
  const max = high + spread * 0.15;
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const x = (index) => PAD.left + (index / last) * innerW;
  const y = (elo) => PAD.top + (1 - (elo - min) / (max - min)) * (height - PAD.top - PAD.bottom);
  const ticks = niceTicks(min, max, 4);
  const bands = TIER_BANDS.filter((band) => band.min > min && band.min < max);
  const peakIndex = points.findIndex((point) => point.elo === peak);
  const [fromX, toX] = [x(0), x(last)];

  const move = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - PAD.left) / innerW;
    onActive(Math.max(0, Math.min(last, Math.round(ratio * last))));
  };
  const key = (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -last, End: last }[event.key];
    if (!step) return;
    event.preventDefault();
    onActive(Math.max(0, Math.min(last, (active ?? last) + step)));
  };

  let line = "";
  if (width) line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.elo).toFixed(1)}`).join(" ");
  const bottom = height - PAD.bottom;
  const focus = active ?? last;

  return <div className="cb-elo-plot" ref={box} onPointerMove={move} onPointerDown={move} onPointerLeave={() => onActive(null)} onKeyDown={key} onBlur={() => onActive(null)} tabIndex={0} role="group" aria-label="Elo chart. Use the left and right arrow keys to read each game.">
    {width > 0 && <svg className="cb-elo-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cb-elo-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--cb-t-main)" stopOpacity=".34" />
          <stop offset="1" stopColor="var(--cb-t-main)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => <g key={tick}>
        <line className="cb-elo-grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
        <text className="cb-elo-axis" x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">{tick}</text>
      </g>)}
      {bands.map((band) => <g key={band.code}>
        <line className="cb-elo-band" x1={PAD.left} x2={width - PAD.right} y1={y(band.min)} y2={y(band.min)} />
        <text className="cb-elo-band-label" x={width - PAD.right} y={y(band.min) - 6} textAnchor="end">Tier {band.code} starts at {band.min}</text>
      </g>)}
      <path d={`${line} L${toX.toFixed(1)} ${bottom} L${fromX.toFixed(1)} ${bottom} Z`} fill="url(#cb-elo-fill)" />
      <path className="cb-elo-line" d={line} />
      {points.map((point, index) => point.start ? null : <circle key={index} className={`cb-elo-dot ${point.won ? "w" : "l"}`} cx={x(index)} cy={y(point.elo)} r={index === focus ? 5 : 3.5} />)}
      {peakIndex >= 0 && peakIndex !== last && <rect className="cb-elo-peak" x={x(peakIndex) - 5} y={y(peak) - 5} width="10" height="10" transform={`rotate(45 ${x(peakIndex)} ${y(peak)})`} />}
      {active != null && <line className="cb-elo-cursor" x1={x(active)} x2={x(active)} y1={PAD.top} y2={bottom} />}
      <g transform={`translate(${x(last)} ${y(points[last].elo)})`}>
        <circle className="cb-elo-now" r="8" />
        <circle className="cb-elo-now-core" r="3" />
      </g>
      <text className="cb-elo-axis" x={fromX} y={height - 6} textAnchor="start">{points[0].start ? "Start" : shortDate(points[0].at)}</text>
      <text className="cb-elo-axis" x={toX} y={height - 6} textAnchor="end">{shortDate(points[last].at) || "Latest"}</text>
    </svg>}
  </div>;
}

// What the cursor (or the latest game) says, written out above the chart.
function Readout({ point, number, total, isLatest }) {
  if (point.start) return <p className="cb-elo-read"><b>{Math.round(point.elo)}</b><span>Rating before your first game</span></p>;
  const result = `${point.won ? "Won" : "Lost"}${point.score ? ` ${scoreText(point.score)}` : ""}`;
  return <p className="cb-elo-read" aria-live="polite">
    <b>{Math.round(point.elo)}</b>
    <span className={point.change >= 0 ? "up" : "down"}>{formatDelta(point.change)}</span>
    <span>{isLatest ? "Latest game" : `Game ${number} of ${total}`} · {result}{point.at ? ` · ${shortDate(point.at)}` : ""}</span>
  </p>;
}

// The Elo card: the chart, three numbers, and progress to the next tier.
export default function EloJourney({ stats, elo, tier }) {
  const [active, setActive] = useState(null);
  const points = (stats.eloSeries || []).slice(-MAX_POINTS);
  if (points.length < 2) {
    return <Card className="span2" title="Elo journey" note="Rating after every game">
      <p className="cb-empty">Your rating line appears after your first rated game.</p>
    </Card>;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.elo - first.elo;
  const peak = Math.max(...points.map((point) => point.elo));
  const progress = rankProgress(elo ?? last.elo, tier);
  const games = points.filter((point) => !point.start).length;
  const shown = active ?? points.length - 1;
  const offset = points.length - games; // 1 when the series starts with the pre-game rating
  return <Card className="span2" title="Elo journey" note={`Rating after each of your last ${games} ${games === 1 ? "game" : "games"}`}>
    <Readout point={points[shown]} number={shown - offset + 1} total={games} isLatest={active == null} />
    <Chart points={points} peak={peak} active={active} onActive={setActive} />
    <ul className="cb-elo-legend" aria-hidden="true">
      <li><i className="dot w" />Won</li>
      <li><i className="dot l" />Lost</li>
      <li><i className="diamond" />Peak</li>
      <li><i className="ring" />Now</li>
    </ul>
    <p className="cb-sr">Elo went from {Math.round(first.elo)} to {Math.round(last.elo)} ({formatDelta(change)}). Peak {Math.round(peak)}.</p>
    <dl className="cb-elo-facts">
      <div><dt className="cb-label">Now</dt><dd>{Math.round(last.elo)}</dd></div>
      <div><dt className="cb-label">Peak</dt><dd>{Math.round(peak)}</dd></div>
      <div><dt className="cb-label">Over this stretch</dt><dd className={change >= 0 ? "up" : "down"}>{formatDelta(change)}</dd></div>
    </dl>
    {progress
      ? <div className="cb-progress">
        <p className="cb-progress-text"><b>{progress.needed} Elo</b> to reach tier {progress.next}</p>
        <span className="cb-progress-bar" role="progressbar" aria-label={`Progress to tier ${progress.next}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.pct}><i style={{ width: `${progress.pct}%` }} /></span>
      </div>
      : String(tier || "").toUpperCase() === "S" && <p className="cb-progress-text cb-progress-top">Top tier. Hold it.</p>}
  </Card>;
}
