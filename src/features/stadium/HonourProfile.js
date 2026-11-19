import { tierKey } from "@/components/PlayerAvatar";
import { RANK_NAMES } from "@/lib/rank-names";
import { INK, drawAvatar, fitFont, fonts, thread, wrap } from "./wallCanvas";

// One honour profile, drawn on its banner under the title: the honour label, the holder's avatar in a
// gold ring, name, rank name and the stat. An honour nobody holds yet shows an empty ring,
// "Unclaimed" and the rule to win it. (ctx is translated to the cell; m converts metres to px.)
export function drawHonourProfile(ctx, honour, { width, m, assets }) {
  const { display, body } = fonts();
  const cx = width / 2;
  const maxW = width - m(0.1);
  const holder = honour.holder;

  // label, with a gold rule each side
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${m(0.085)}px ${body}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${m(0.014)}px`;
  const label = honour.label.toUpperCase();
  thread(ctx, label, cx, m(0.12), INK.goldHi, 4);
  const lw = ctx.measureText(label).width;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.fillStyle = INK.gold;
  for (const s of [-1, 1]) ctx.fillRect(cx + s * (lw / 2 + m(0.06)) - (s < 0 ? m(0.18) : 0), m(0.12) - 2, m(0.18), 4);

  // gold ring
  const ringY = m(0.74);
  const ringR = m(0.46);
  const g = ctx.createLinearGradient(cx - ringR, ringY - ringR, cx + ringR, ringY + ringR);
  g.addColorStop(0, "#f6dc95");
  g.addColorStop(0.35, "#b98a2c");
  g.addColorStop(0.6, "#f6dc95");
  g.addColorStop(1, INK.goldDeep);
  ctx.save();
  ctx.shadowColor = INK.shadow;
  ctx.shadowBlur = m(0.04);
  ctx.beginPath();
  ctx.arc(cx, ringY, ringR, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, ringY, ringR - m(0.035), 0, Math.PI * 2);
  ctx.fillStyle = "#061712";
  ctx.fill();

  if (!holder) {
    ctx.font = `700 ${m(0.42)}px ${display}`;
    thread(ctx, "?", cx, ringY + m(0.03), "#7f978b", 0);
    ctx.font = `700 ${m(0.17)}px ${body}`;
    thread(ctx, "Unclaimed", cx, m(1.42), INK.creamSoft);
    ctx.font = `400 ${m(0.085)}px ${body}`;
    wrap(ctx, honour.rule, maxW).forEach((line, i) => thread(ctx, line, cx, m(1.66 + i * 0.12), INK.creamSoft, 4));
    return;
  }

  drawAvatar(ctx, cx, ringY, (ringR - m(0.035)) * 2 * 1.06, holder, assets);

  // name, rank name, stat
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  thread(ctx, fitFont(ctx, holder.name, 700, m(0.21), body, maxW), cx, m(1.42), INK.cream, 8);
  const tier = tierKey(holder.tier).toUpperCase();
  if (tier) {
    ctx.font = `400 ${m(0.095)}px ${body}`;
    thread(ctx, RANK_NAMES[tier], cx, m(1.64), INK.creamSoft, 4);
  }
  // gold diamond between the who and the stat
  ctx.save();
  ctx.translate(cx, m(1.8));
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = INK.gold;
  ctx.fillRect(-m(0.03), -m(0.03), m(0.06), m(0.06));
  ctx.restore();
  ctx.fillStyle = "rgba(226,189,98,0.6)";
  ctx.fillRect(cx - m(0.5), m(1.8) - 1, m(0.4), 2);
  ctx.fillRect(cx + m(0.1), m(1.8) - 1, m(0.4), 2);
  thread(ctx, fitFont(ctx, honour.stat, 700, m(0.16), display, maxW), cx, m(2.0), INK.goldHi, 8);
}
