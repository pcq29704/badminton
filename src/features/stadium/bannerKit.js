import {
  BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, PMREMGenerator, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Shape,
  ShapeGeometry, Vector2,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HONOURS } from "./honours.mjs";
import { HONOURS_HALL, RANKING_WALL } from "./constants";

// Everything the royal banners share, made once per renderer: cloth textures (drawn in code, no
// downloaded art), materials, and geometries. Each honour banner varies only its crest and title,
// which come from two shared atlases, so 6 banners use the same textures and materials.

// ---------- banner colours (only the banners use crimson, cream and blue) ----------
const C = {
  crimson: "#6a0c1a",
  crimsonDeep: "#33050c",
  crimsonHi: "#8e1426",
  cream: "#efe2c2",
  creamShade: "#d9c79f",
  blue: "#1d3d8f",
  blueDeep: "#122a66",
  gold: "#d8a841",
  goldHi: "#f7dc8a",
  goldDeep: "#7f5a1b",
  ink: "#2a1606",
};

// ORM map: green = roughness, blue = metalness (three reads them from those channels).
const ORM = { velvet: "rgb(0,235,0)", cream: "rgb(0,185,0)", gold: "rgb(0,105,235)", stitch: "rgb(0,140,200)" };

export const CREST_RANKING = HONOURS.length; // atlas cell 6: the ranking banner's S-rank crest

// ---------- banner sizes ----------
export const BANNERS = {
  honour: { ...HONOURS_HALL.banner, ppm: 300, fold: { amp: 0.032, wave: 0.55, bow: 0.04 }, fringe: 0.22, rodR: 0.03, ornament: false },
  ranking: { ...RANKING_WALL.banner, ppm: 120, fold: { amp: 0.018, wave: 1.15, bow: 0.05 }, fringe: 0.34, rodR: 0.055, ornament: false },
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Forward offset of the cloth at (x, y) in banner space: the top edge (y = 0) hangs straight from the rod,
// the cloth bows out a little and folds deepen toward the bottom. y runs down from 0 to -height.
export function clothZ(spec, x, y) {
  const { width: W, height: H, fold } = spec;
  const s = Math.min(1, Math.max(0, -y / H));
  const edge = (2 * x) / W;
  const folds = fold.amp * smooth(0.12, 1, s) * Math.sin((2 * Math.PI * x) / fold.wave + 0.6);
  const bow = fold.bow * Math.sin(Math.PI * Math.min(1, s * 1.1)) * (1 - 0.5 * edge * edge);
  return folds + bow;
}
// The highest forward offset in a box, so flat parts (crest, title) sit just in front of the cloth.
export function clothFront(spec, x0, x1, y0, y1) {
  let best = -Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) best = Math.max(best, clothZ(spec, x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * j) / 8));
  return best;
}

// ---------- geometry ----------
// A subdivided plane whose bottom edge is a V. uv v runs 0 (tip) to 1 (top), so the canvas lines up.
function clothGeometry(spec, segX, segY) {
  const { width: W, height: H, vDepth: V } = spec;
  const g = new PlaneGeometry(W, 1, segX, segY); // segX is even, so x = 0 (the tip) is a vertex
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = 0.5 - pos.getY(i); // 0 at the top, 1 at the bottom edge
    const len = H - V + V * (1 - Math.abs((2 * x) / W));
    const y = -t * len;
    pos.setXYZ(i, x, y, clothZ(spec, x, y));
    uv.setXY(i, x / W + 0.5, (y + H) / H);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// A patch of the cloth (a box in banner space) that follows the same folds, just in front of it, for
// the info drawn on the banner. uv runs 0..1 over the box; with `cell` it maps to one cell of an atlas.
export function patchGeometry(spec, { x0, x1, y0, y1 }, segX, segY, cell = null) {
  const g = new PlaneGeometry(x1 - x0, y0 - y1, segX, segY);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const x = x0 + (x1 - x0) * u;
    const y = y1 + (y0 - y1) * v;
    pos.setXYZ(i, x, y, clothZ(spec, x, y) + 0.006);
    if (cell) uv.setXY(i, (cell.col + u) / cell.cols, 1 - (cell.row + 1 - v) / cell.rows);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// A gold fringe hanging straight down from both edges of the V.
function fringeGeometry(spec) {
  const { width: W, height: H, vDepth: V, fringe: L } = spec;
  const corner = H - V;
  const edges = [[[-W / 2, -corner], [0, -H]], [[0, -H], [W / 2, -corner]]];
  const positions = [];
  const uvs = [];
  const index = [];
  let along = 0;
  const n = 24;
  for (const [[ax, ay], [bx, by]] of edges) {
    const len = Math.hypot(bx - ax, by - ay);
    const base = positions.length / 3;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = ax + (bx - ax) * k;
      const y = ay + (by - ay) * k;
      const z = clothZ(spec, x, y) + 0.004;
      const u = (along + len * k) / 0.25; // one texture repeat per 25 cm
      positions.push(x, y + 0.03, z, x, y - L, z);
      uvs.push(u, 1, u, 0);
      if (i < n) {
        const a = base + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    along += len;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Heater shield in a 1 × 1.2 box, centred. Shared by the 3D crest and the crest atlas drawing.
function shieldPath(p, w, h) {
  const x = (u) => u * w;
  const y = (v) => v * h;
  p.moveTo(x(-0.5), y(0.5));
  p.lineTo(x(0.5), y(0.5));
  p.lineTo(x(0.5), y(0.04));
  p.quadraticCurveTo(x(0.5), y(-0.32), x(0), y(-0.5));
  p.quadraticCurveTo(x(-0.5), y(-0.32), x(-0.5), y(0.04));
  p.closePath();
}
function shieldShape(w, h) {
  const s = new Shape();
  shieldPath(s, w, h);
  return s;
}

const CREST_CELLS = { cols: 4, rows: 2, w: 256, h: 308 };

// One face geometry per atlas cell: the same shield, uv moved to that cell.
function crestFaceGeometry(w, h, cell) {
  const g = new ShapeGeometry(shieldShape(w, h), 24);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const col = cell % CREST_CELLS.cols;
  const row = Math.floor(cell / CREST_CELLS.cols);
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w + 0.5;
    const v = pos.getY(i) / h + 0.5;
    uv.setXY(i, (col + u) / CREST_CELLS.cols, 1 - (row + 1 - v) / CREST_CELLS.rows);
  }
  return g;
}

// Tassel: cord loop, round head, neck ring and a flared skirt. 1 m long, hangs down from y = 0.
function tasselGeometry() {
  const pts = [[0, 0], [0.025, -0.01], [0.04, -0.05], [0.03, -0.09], [0.09, -0.12], [0.13, -0.19], [0.12, -0.26], [0.07, -0.31],
    [0.09, -0.33], [0.09, -0.37], [0.07, -0.39], [0.1, -0.5], [0.15, -0.8], [0.19, -0.98], [0.16, -1], [0, -1]];
  return new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 20);
}

// Finial: collar, neck, ball and a small point. Axis along +y from y = 0.
function finialGeometry() {
  const pts = [[0, 0], [0.05, 0], [0.055, 0.02], [0.035, 0.035], [0.03, 0.05], [0.06, 0.07], [0.078, 0.11], [0.07, 0.15],
    [0.04, 0.18], [0.02, 0.2], [0.012, 0.24], [0, 0.27]];
  return new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 18);
}

// ---------- canvas drawing ----------
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

// Offsets a convex polygon (clockwise on screen) inward by d.
function inset(points, d) {
  const n = points.length;
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    const nx = -dy / len; // inward for clockwise-on-screen (y down)
    const ny = dx / len;
    return { px: p[0] + nx * d, py: p[1] + ny * d, dx, dy };
  });
  return lines.map((a, i) => {
    const b = lines[(i + n - 1) % n];
    const den = a.dx * b.dy - a.dy * b.dx;
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / den;
    return [a.px + a.dx * t, a.py + a.dy * t];
  });
}
function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Blue scrollwork: a running row of spirals joined by S-curves, with small leaves above and below.
function drawScroll(ctx, x0, x1, y0, y1) {
  const h = y1 - y0;
  const mid = (y0 + y1) / 2;
  const period = h * 1.15;
  const count = Math.max(2, Math.round((x1 - x0) / period));
  const p = (x1 - x0) / count;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.blue;
  ctx.fillStyle = C.blue;
  ctx.lineWidth = h * 0.07;
  for (let i = 0; i < count; i++) {
    const cx = x0 + (i + 0.5) * p;
    const R = h * 0.26;
    const flip = i % 2 ? -1 : 1;
    ctx.beginPath();
    for (let k = 0; k <= 48; k++) {
      const t = k / 48;
      const a = -Math.PI / 2 * flip + t * Math.PI * 2.4 * flip;
      const r = R * (1 - 0.8 * t);
      const x = cx + Math.cos(a) * r;
      const y = mid + Math.sin(a) * r * flip;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // S-curve to the next spiral
    ctx.beginPath();
    ctx.moveTo(cx, mid - R * flip);
    ctx.bezierCurveTo(cx + p * 0.35, mid - R * flip, cx + p * 0.65, mid + R * flip, cx + p, mid + R * flip);
    ctx.stroke();
    // leaves
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + p / 2, mid + s * h * 0.36, h * 0.09, h * 0.035, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.lineWidth = h * 0.035;
  for (const y of [y0 + h * 0.08, y1 - h * 0.08]) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  ctx.restore();
}

function addNoise(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.6));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.6));
  }
  ctx.putImageData(img, 0, 0);
}

// The cloth: crimson velvet with a faint damask lattice, cream header band with blue scrollwork,
// and a gold embroidered border that follows the V-bottom. Returns the colour map and the ORM map.
function drawCloth(spec) {
  const { width: W, height: H, vDepth: V, header, border: b, ppm, ornament } = spec;
  const color = canvas(W * ppm, H * ppm);
  const orm = canvas(W * ppm, H * ppm);
  const outline = [[0, 0], [W, 0], [W, H - V], [W / 2, H], [0, H - V]];
  const bandTop = b;
  const bandBottom = b + header;

  for (const [cv, mode] of [[color, "color"], [orm, "orm"]]) {
    const ctx = cv.getContext("2d");
    ctx.scale(ppm, ppm);
    const isColor = mode === "color";
    // velvet
    if (isColor) {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, C.crimsonDeep);
      g.addColorStop(0.18, C.crimson);
      g.addColorStop(0.5, C.crimsonHi);
      g.addColorStop(0.82, C.crimson);
      g.addColorStop(1, C.crimsonDeep);
      ctx.fillStyle = g;
    } else ctx.fillStyle = ORM.velvet;
    ctx.fillRect(0, 0, W, H);
    // damask lattice: diamonds with a small four-petal flower where the lines cross
    if (isColor) {
      const step = 0.34;
      ctx.save();
      ctx.strokeStyle = "rgba(255,150,150,0.07)";
      ctx.lineWidth = 0.012;
      for (let k = -H; k < W + H; k += step) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - H, H); ctx.stroke();
      }
      ctx.fillStyle = "rgba(20,0,4,0.18)";
      for (let y = step / 2; y < H; y += step / 2) {
        for (let x = ((y / (step / 2)) % 2 ? 0 : step / 2); x < W; x += step) {
          for (let a = 0; a < 4; a++) {
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(a * Math.PI / 2) * 0.025, y + Math.sin(a * Math.PI / 2) * 0.025, 0.024, 0.011, a * Math.PI / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
    // header band
    ctx.fillStyle = isColor ? C.cream : ORM.cream;
    ctx.fillRect(b, bandTop, W - 2 * b, header);
    if (isColor) {
      const shade = ctx.createLinearGradient(0, bandTop, 0, bandBottom);
      shade.addColorStop(0, "rgba(255,255,255,0.18)");
      shade.addColorStop(1, "rgba(120,90,40,0.22)");
      ctx.fillStyle = shade;
      ctx.fillRect(b, bandTop, W - 2 * b, header);
      drawScroll(ctx, b + header * 0.12, W - b - header * 0.12, bandTop, bandBottom);
    }
    // gold rule under the band
    ctx.fillStyle = isColor ? C.gold : ORM.gold;
    ctx.fillRect(b, bandBottom, W - 2 * b, b * 0.45);
    // gold ornament in the middle of the honour banners: a diamond with four dots
    if (ornament) {
      const cy = bandBottom + (H - V - bandBottom) * 0.42;
      const s = W * 0.09;
      ctx.save();
      ctx.translate(W / 2, cy);
      ctx.fillStyle = isColor ? C.gold : ORM.gold;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.62, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = isColor ? C.crimsonDeep : ORM.velvet;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.33, 0); ctx.lineTo(0, s * 0.55); ctx.lineTo(-s * 0.33, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = isColor ? C.gold : ORM.gold;
      for (const [dx, dy] of [[0, -1.45], [0, 1.45], [-1.05, 0], [1.05, 0]]) {
        ctx.beginPath(); ctx.arc(dx * s, dy * s, s * 0.14, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // gold embroidered border, all the way round, following the V
    polyPath(ctx, inset(outline, b / 2));
    ctx.lineJoin = "miter";
    ctx.lineWidth = b;
    ctx.strokeStyle = isColor ? C.gold : ORM.gold;
    ctx.stroke();
    // satin stitches across the band and fine edge threads
    polyPath(ctx, inset(outline, b / 2));
    ctx.setLineDash([b * 0.16, b * 0.16]);
    ctx.lineWidth = b * 0.62;
    ctx.strokeStyle = isColor ? C.goldDeep : ORM.stitch;
    ctx.stroke();
    ctx.setLineDash([]);
    for (const d of [b * 0.09, b * 0.91]) {
      polyPath(ctx, inset(outline, d));
      ctx.lineWidth = b * 0.1;
      ctx.strokeStyle = isColor ? C.goldHi : ORM.gold;
      ctx.stroke();
    }
    if (isColor) {
      // a thin cream line inside the gold border
      polyPath(ctx, inset(outline, b * 1.18));
      ctx.lineWidth = b * 0.12;
      ctx.strokeStyle = "rgba(239,226,194,0.55)";
      ctx.stroke();
    }
  }
  addNoise(color.getContext("2d"), color.width, color.height, 22);
  return { color, orm };
}

// Gold strands for the fringe (alpha from the strands, tiles along the edge).
function drawFringe() {
  const c = canvas(256, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, 0, 256, 22); // the woven heading
  ctx.fillStyle = C.goldDeep;
  for (let x = 0; x < 256; x += 8) ctx.fillRect(x, 4, 3, 14);
  let seed = 99;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 1; x < 256; x += 3) {
    const len = 128 * (0.82 + rand() * 0.18);
    ctx.fillStyle = [C.gold, C.goldHi, C.goldDeep][Math.floor(rand() * 3)];
    ctx.fillRect(x, 20, 2, len - 20);
  }
  return c;
}

// Vertical stripes for the tassel skirts.
function drawTassel() {
  const c = canvas(128, 16);
  const ctx = c.getContext("2d");
  for (let x = 0; x < 128; x += 4) {
    ctx.fillStyle = x % 8 ? C.gold : C.goldDeep;
    ctx.fillRect(x, 0, 4, 16);
  }
  ctx.fillStyle = C.goldHi;
  for (let x = 1; x < 128; x += 8) ctx.fillRect(x, 0, 1, 16);
  return c;
}

// ---------- emblems (one per honour) ----------
function goldFill(ctx, s) {
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, C.goldHi);
  g.addColorStop(0.55, C.gold);
  g.addColorStop(1, C.goldDeep);
  return g;
}
function finishShape(ctx, s) {
  ctx.fillStyle = goldFill(ctx, s);
  ctx.fill();
  ctx.lineWidth = s * 0.045;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}
const EMBLEMS = {
  crown(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, s * 0.45);
    ctx.lineTo(-s * 0.9, -s * 0.35);
    ctx.lineTo(-s * 0.42, s * 0.02);
    ctx.lineTo(0, -s * 0.62);
    ctx.lineTo(s * 0.42, s * 0.02);
    ctx.lineTo(s * 0.9, -s * 0.35);
    ctx.lineTo(s * 0.8, s * 0.45);
    ctx.closePath();
    finishShape(ctx, s);
    ctx.beginPath();
    ctx.rect(-s * 0.82, s * 0.45, s * 1.64, s * 0.24);
    finishShape(ctx, s);
    for (const [x, y] of [[-0.9, -0.35], [0, -0.62], [0.9, -0.35]]) {
      ctx.beginPath(); ctx.arc(x * s, y * s - s * 0.1, s * 0.11, 0, Math.PI * 2); finishShape(ctx, s);
    }
  },
  conqueror(ctx, s) {
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.rotate(dir * Math.PI / 4);
      ctx.beginPath(); // blade
      ctx.moveTo(-s * 0.07, s * 0.42); ctx.lineTo(-s * 0.07, -s * 0.78); ctx.lineTo(0, -s * 0.95); ctx.lineTo(s * 0.07, -s * 0.78); ctx.lineTo(s * 0.07, s * 0.42); ctx.closePath();
      finishShape(ctx, s);
      ctx.beginPath(); ctx.rect(-s * 0.3, s * 0.4, s * 0.6, s * 0.1); finishShape(ctx, s); // guard
      ctx.beginPath(); ctx.rect(-s * 0.05, s * 0.5, s * 0.1, s * 0.3); finishShape(ctx, s); // grip
      ctx.beginPath(); ctx.arc(0, s * 0.86, s * 0.08, 0, Math.PI * 2); finishShape(ctx, s); // pommel
      ctx.restore();
    }
  },
  unbroken(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.85); ctx.lineTo(s * 0.62, -s * 0.2); ctx.lineTo(0, s * 0.85); ctx.lineTo(-s * 0.62, -s * 0.2); ctx.closePath();
    finishShape(ctx, s);
    ctx.lineWidth = s * 0.035;
    ctx.strokeStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s * 0.2); ctx.lineTo(s * 0.62, -s * 0.2);
    ctx.moveTo(-s * 0.25, -s * 0.2); ctx.lineTo(0, -s * 0.85); ctx.lineTo(s * 0.25, -s * 0.2); ctx.lineTo(0, s * 0.85); ctx.lineTo(-s * 0.25, -s * 0.2);
    ctx.stroke();
  },
  relentless(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 0.75, s * 0.75, -s * 0.7, -s * 0.05, -s * 0.2, -s * 0.45);
    ctx.bezierCurveTo(-s * 0.2, -s * 0.1, -s * 0.05, s * 0.0, s * 0.05, -s * 0.1);
    ctx.bezierCurveTo(-s * 0.05, -s * 0.45, s * 0.1, -s * 0.75, s * 0.05, -s * 0.95);
    ctx.bezierCurveTo(s * 0.55, -s * 0.6, s * 0.85, s * 0.1, s * 0.55, s * 0.55);
    ctx.bezierCurveTo(s * 0.45, s * 0.75, s * 0.25, s * 0.85, 0, s * 0.85);
    ctx.closePath();
    finishShape(ctx, s);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.72);
    ctx.bezierCurveTo(-s * 0.32, s * 0.65, -s * 0.3, s * 0.25, -s * 0.02, s * 0.05);
    ctx.bezierCurveTo(s * 0.05, s * 0.3, s * 0.32, s * 0.4, s * 0.22, s * 0.62);
    ctx.closePath();
    ctx.fillStyle = C.crimsonHi;
    ctx.fill();
  },
  stalwart(ctx, s) {
    ctx.beginPath(); // tower with battlements
    ctx.moveTo(-s * 0.55, s * 0.8);
    ctx.lineTo(-s * 0.45, -s * 0.45);
    ctx.lineTo(-s * 0.62, -s * 0.45);
    ctx.lineTo(-s * 0.62, -s * 0.85);
    for (let i = 0; i < 4; i++) {
      const x0 = -s * 0.62 + i * s * 0.31;
      ctx.lineTo(x0 + s * 0.155, -s * 0.85);
      ctx.lineTo(x0 + s * 0.155, -s * 0.7);
      ctx.lineTo(x0 + s * 0.31, -s * 0.7);
      ctx.lineTo(x0 + s * 0.31, -s * 0.85);
    }
    ctx.lineTo(s * 0.62, -s * 0.45);
    ctx.lineTo(s * 0.45, -s * 0.45);
    ctx.lineTo(s * 0.55, s * 0.8);
    ctx.closePath();
    finishShape(ctx, s);
    ctx.beginPath(); // door
    ctx.moveTo(-s * 0.16, s * 0.8); ctx.lineTo(-s * 0.16, s * 0.42); ctx.arc(0, s * 0.42, s * 0.16, Math.PI, 0); ctx.lineTo(s * 0.16, s * 0.8); ctx.closePath();
    ctx.fillStyle = C.blueDeep;
    ctx.fill();
    ctx.fillRect(-s * 0.06, -s * 0.25, s * 0.12, s * 0.28); // window
  },
  rising(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? s * 0.32 : s * 0.78;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - s * 0.08);
    }
    ctx.closePath();
    finishShape(ctx, s);
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = C.gold;
    ctx.lineCap = "round";
    for (const r of [0.86, 1.02]) {
      ctx.beginPath();
      ctx.arc(0, s * 1.15, s * r, Math.PI * 1.22, Math.PI * 1.78);
      ctx.stroke();
    }
  },
};

// Crest atlas: blue shield field, gold rim line, gold emblem. Cell 6 holds the S-rank badge.
function drawCrests(rankImage) {
  const { cols, rows, w, h } = CREST_CELLS;
  const c = canvas(cols * w, rows * h);
  const ctx = c.getContext("2d");
  const keys = [...HONOURS.map((honour) => honour.key), "ranking"];
  keys.forEach((key, i) => {
    const x0 = (i % cols) * w;
    const y0 = Math.floor(i / cols) * h;
    ctx.save();
    ctx.translate(x0 + w / 2, y0 + h / 2);
    const field = ctx.createRadialGradient(0, -h * 0.12, w * 0.05, 0, 0, w * 0.75);
    field.addColorStop(0, key === "ranking" ? "#6b1424" : "#2c56b8");
    field.addColorStop(1, key === "ranking" ? C.crimsonDeep : C.blueDeep);
    ctx.fillStyle = field;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // gold rim line just inside the shield edge (canvas y is down, so flip the shape)
    ctx.save();
    ctx.scale(1, -1);
    ctx.beginPath();
    shieldPath(ctx, w * 0.9, h * 0.9);
    ctx.restore();
    ctx.lineWidth = w * 0.035;
    ctx.strokeStyle = C.gold;
    ctx.stroke();
    if (key === "ranking") {
      if (rankImage) ctx.drawImage(rankImage, -w * 0.4, -h * 0.36, w * 0.8, w * 0.8);
    } else {
      EMBLEMS[key](ctx, w * 0.3);
    }
    ctx.restore();
  });
  return c;
}

// Honour titles, one row each, in the app's display font.
function drawTitles(c, family) {
  const ctx = c.getContext("2d");
  const rowH = c.height / HONOURS.length;
  ctx.clearRect(0, 0, c.width, c.height);
  HONOURS.forEach((honour, i) => {
    const y = (i + 0.5) * rowH;
    let size = rowH * 0.62;
    ctx.font = `700 ${size}px ${family}`;
    const width = ctx.measureText(honour.title).width;
    if (width > c.width * 0.92) {
      size *= (c.width * 0.92) / width;
      ctx.font = `700 ${size}px ${family}`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = "rgba(30,8,4,0.9)";
    ctx.strokeText(honour.title, c.width / 2, y);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, C.goldHi);
    g.addColorStop(0.6, C.gold);
    g.addColorStop(1, C.goldDeep);
    ctx.fillStyle = g;
    ctx.fillText(honour.title, c.width / 2, y);
  });
}

function texture(source, { repeat = false, srgb = true } = {}) {
  const t = new CanvasTexture(source);
  if (srgb) t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Slow ripple in the vertex shader: deeper toward the bottom, a different phase per banner.
export function addRipple(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace("#include <begin_vertex>", `#include <begin_vertex>
      {
        vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float phase = origin.x * 0.7 + origin.z * 1.3;
        float hang = clamp(-position.y / 5.0, 0.0, 1.2);
        transformed.z += hang * hang * (0.016 * sin(uTime * 0.9 + position.x * 2.3 + phase) + 0.008 * sin(uTime * 1.6 - position.x * 4.1 + phase * 1.7));
      }`);
  };
  material.customProgramCacheKey = () => "banner-ripple";
}

export function displayFontFamily() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--cb-display").trim();
  return value || '"Cormorant SC", Georgia, serif';
}

export function createBannerKit(gl) {
  const pmrem = new PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  pmrem.dispose();

  const uniforms = { uTime: { value: 0 } };
  const disposables = [envMap];
  const keep = (x) => (disposables.push(x), x);

  const gold = keep(new MeshStandardMaterial({ color: C.gold, metalness: 1, roughness: 0.35, envMap, envMapIntensity: 0.9 }));
  const cord = keep(new MeshStandardMaterial({ color: C.gold, metalness: 0.9, roughness: 0.55, envMap, envMapIntensity: 0.8 }));
  const tasselMap = keep(texture(drawTassel(), { repeat: true }));
  tasselMap.repeat.set(6, 1);
  const tassel = keep(new MeshStandardMaterial({ map: tasselMap, metalness: 0.85, roughness: 0.45, envMap, envMapIntensity: 0.9 }));
  const fringeMap = keep(texture(drawFringe(), { repeat: true }));

  const cloth = {};
  const fringe = {};
  for (const [name, spec] of Object.entries(BANNERS)) {
    const { color, orm } = drawCloth(spec);
    const map = keep(texture(color));
    const ormMap = keep(texture(orm, { srgb: false }));
    cloth[name] = keep(new MeshPhysicalMaterial({
      map, roughnessMap: ormMap, metalnessMap: ormMap, roughness: 1, metalness: 1,
      sheen: 1, sheenRoughness: 0.5, sheenColor: "#9c2a3a", envMap, envMapIntensity: 0.35, side: DoubleSide,
    }));
    fringe[name] = keep(new MeshStandardMaterial({ map: fringeMap, alphaTest: 0.45, metalness: 0.85, roughness: 0.45, envMap, envMapIntensity: 0.9, side: DoubleSide }));
    if (name === "honour") {
      addRipple(cloth[name], uniforms);
      addRipple(fringe[name], uniforms);
    }
  }

  const crestCanvas = drawCrests(null);
  const crestMap = keep(texture(crestCanvas));
  const crestFace = keep(new MeshStandardMaterial({ map: crestMap, metalness: 0.35, roughness: 0.5, envMap, envMapIntensity: 0.7 }));
  const titleCanvas = canvas(1024, 192 * HONOURS.length);
  const titleMap = keep(texture(titleCanvas));
  const title = keep(new MeshStandardMaterial({ map: titleMap, transparent: true, depthWrite: false, metalness: 0.6, roughness: 0.4, envMap, envMapIntensity: 0.8 }));

  const geometry = {
    cloth: { honour: keep(clothGeometry(BANNERS.honour, 22, 40)), ranking: keep(clothGeometry(BANNERS.ranking, 46, 48)) },
    fringe: { honour: keep(fringeGeometry(BANNERS.honour)), ranking: keep(fringeGeometry(BANNERS.ranking)) },
    rod: keep(new CylinderGeometry(1, 1, 1, 16)),
    cord: keep(new CylinderGeometry(0.008, 0.008, 1, 6)),
    finial: keep(finialGeometry()),
    tassel: keep(tasselGeometry()),
    crest: {},
  };
  // Crest sizes: 0.62 × 0.75 m on honour banners, 0.7 × 0.84 m on the ranking banner.
  for (const [name, w] of [["honour", 0.62], ["ranking", 0.7]]) {
    const h = w * 1.2;
    const body = keep(new ExtrudeGeometry(shieldShape(w, h), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.022, bevelSegments: 2, curveSegments: 20 }));
    const faces = [];
    for (let cell = 0; cell <= CREST_RANKING; cell++) faces.push(keep(crestFaceGeometry(w * 0.9, h * 0.9, cell)));
    geometry.crest[name] = { body, faces, w, h, depth: 0.03 + 0.015 };
  }
  // Title strip: one row of the title atlas.
  geometry.titleRows = HONOURS.map((_, i) => {
    const g = keep(new PlaneGeometry(1, 1));
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / HONOURS.length);
    return g;
  });

  // Async parts: the display font for the titles, the S-rank badge for the ranking crest.
  const family = displayFontFamily();
  const ready = Promise.all([
    document.fonts?.load(`700 120px ${family}`, HONOURS.map((h) => h.title).join(" ")).catch(() => null),
    loadImage("/assets/rank-badges/rank-s.png"),
  ]).then(([, rankImage]) => {
    drawTitles(titleCanvas, family);
    titleMap.needsUpdate = true;
    const ctx = crestCanvas.getContext("2d");
    ctx.drawImage(drawCrests(rankImage), 0, 0);
    crestMap.needsUpdate = true;
  });

  return {
    envMap,
    uniforms,
    materials: { gold, cord, tassel, cloth, fringe, crestFace, title },
    geometry,
    ready,
    dispose() {
      for (const item of disposables) item.dispose?.();
    },
  };
}
