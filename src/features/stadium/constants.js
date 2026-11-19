// Stadium layout. Every length is in metres. Y is up; the hall floor is at y = 0.
// The courts' long axis runs along Z. Courts sit side by side along X, so courts 3 and 4
// (a later phase) fit at x = ±COURT_X[1] without moving anything.

// ---------- court (BWF official) ----------
export const COURT = {
  length: 13.4, // baseline to baseline (outer edges)
  width: 6.1, // doubles sideline to doubles sideline (outer edges)
  singlesWidth: 5.18,
  line: 0.04,
  shortService: 1.98, // net centre to the near edge of the short service line
  doublesLongService: 0.76, // inside the back boundary line (outer edges)
};
export const COURT_HALF_L = COURT.length / 2; // 6.70
export const COURT_HALF_W = COURT.width / 2; // 3.05

export const NET = {
  postHeight: 1.55,
  centreHeight: 1.524,
  depth: 0.76, // the mesh hangs this far down from the top
  tape: 0.075, // white band along the top
  postRadius: 0.02,
};

// ---------- floor and court positions ----------
export const FLOOR = { width: 40, depth: 30 }; // along X, along Z
export const FLOOR_HALF_X = FLOOR.width / 2;
export const FLOOR_HALF_Z = FLOOR.depth / 2;
export const COURT_GAP = 4; // doubles sideline to doubles sideline
const COURT_PITCH = COURT.width + COURT_GAP; // 10.1
// Courts 1 and 2 now. Courts 3 and 4 would go at ±(COURT_PITCH * 1.5).
export const COURT_X = [-COURT_PITCH / 2, COURT_PITCH / 2];
export const FUTURE_COURT_X = [-COURT_PITCH * 1.5, COURT_PITCH * 1.5];

// ---------- low boards around each court (each court has its own ring) ----------
export const BOARDS = {
  height: 0.6,
  thickness: 0.08,
  sideOffset: 0.9, // from the doubles sideline
  endOffset: 2.0, // from the baseline
  cornerGap: 1.2, // walk-in opening at each corner
  netGap: 1.0, // half-width of the walk-in opening level with the net, on both long sides
};

// ---------- barrier and seating bowl ----------
export const BARRIER = { height: 1.0, thickness: 0.3 };
export const SEATS = {
  rows: 15,
  rowDepth: 0.85,
  firstTread: 0.6, // height of the first row's tread
  rise: 0.42, // per row
  pitch: 0.5, // seat to seat along a row
  aisle: 1.2, // stair width between seat blocks
  blocksLong: 5, // along the 40 m sides
  blocksShort: 4, // along the 30 m sides
};
export const BOWL_DEPTH = BARRIER.thickness + SEATS.rows * SEATS.rowDepth; // barrier inner face to back wall
export const WALL = { height: 13, thickness: 0.4 };
export const HALL_HALF_X = FLOOR_HALF_X + BOWL_DEPTH + WALL.thickness / 2;
export const HALL_HALF_Z = FLOOR_HALF_Z + BOWL_DEPTH + WALL.thickness / 2;

// The dome is half an ellipsoid whose base passes through the hall corners.
export const DOME = { radiusX: HALL_HALF_X * Math.SQRT2, radiusZ: HALL_HALF_Z * Math.SQRT2, rise: 16, baseY: WALL.height };

// ---------- Phase 2: ranking wall and honours hall ----------
// The ranking and the honours are drawn on the banner cloth itself. The follow camera looks down at
// the player, so the banners hang low, right over the barrier (in front of the first row of seats),
// with their V-tips just above the barrier top (1.0 m). Nothing touches the walkable floor, and the
// Phase 1 colliders are unchanged. The ranking banner replaces Phase 1's empty scoreboard frame.
// Banner-local coordinates: x across, y down from the top edge (0 to -height), cloth faces +z.

export const RANKING_WALL = {
  z: -(FLOOR_HALF_Z + 0.15), // cloth over the end barrier (z -15.0 to -15.3)
  banner: { width: 9.2, height: 6.0, vDepth: 1.0, header: 0.84, border: 0.16, top: 7.4 },
  // The info patch on the cloth: title in the header band, top 10 in two columns, "You" row below.
  info: { x0: -4.28, x1: 4.28, y0: -0.2, y1: -4.55, pxPerMetre: 230 },
  crestY: -5.25, // local: shield centre, in the V-bottom
  rows: 10, // top 10 on the wall (plan section 9, question 2)
};

// Six honour banners over the +X barrier, each with its holder drawn on the cloth.
export const HONOURS_HALL = {
  x: FLOOR_HALF_X + 0.15, // cloth over the side barrier (x 20.0 to 20.3)
  spacing: 4.4, // along Z
  banner: { width: 2.2, height: 5.0, vDepth: 0.6, header: 0.55, border: 0.08, top: 6.35 },
  // The info patch: label, avatar in a gold ring, name, rank name, stat. Below the title strip.
  info: { x0: -0.9, x1: 0.9, y0: -1.1, y1: -3.76, pxPerMetre: 360 },
  crestY: -4.25, // local: shield centre, near the V-bottom
};
// Banner centres along Z, first honour nearest the ranking wall (left to right for a viewer facing +X).
export const HONOUR_Z = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((i) => i * HONOURS_HALL.spacing);

// Walk within this distance of the ranking wall or a plaque and the "view profile" hint shows.
export const INTERACT_DISTANCE = 4;

// ---------- player ----------
export const PLAYER = {
  height: 1.75,
  radius: 0.3,
  walk: 3, // m/s
  run: 6, // m/s
  accel: 14, // how fast the speed follows the input (1/s)
  arrive: 0.12, // tap-to-walk stops this close to the point
};
export const PLAYER_HALF_HEIGHT = PLAYER.height / 2 - PLAYER.radius; // capsule cylinder half height
export const PLAYER_CENTER_Y = PLAYER.height / 2 + 0.02; // a little off the floor, so the floor is never touched

// The player's centre never leaves this box (the barrier is the real stop; this is the last guard).
export const WALK_BOUNDS = { x: FLOOR_HALF_X - PLAYER.radius - 0.01, z: FLOOR_HALF_Z - PLAYER.radius - 0.01 };

// Spawn: in the gap between the two courts, facing the scoreboard (-Z).
export const SPAWN = { x: 0, z: 3, facing: Math.PI };

// ---------- camera ----------
export const CAMERA = {
  fov: 55,
  distance: 8,
  minDistance: 3,
  maxDistance: 12,
  pitch: 0.42, // radians above the horizon
  minPitch: 0.1,
  maxPitch: 1.2,
  // Dragging further than minPitch tilts the view up (to read the banners) without moving the camera.
  maxLookUp: 0.6,
  targetHeight: 1.4, // looks at the player's shoulders
  // The camera stays inside the floor box, so it can never enter the seats or reach the dome.
  // The box is a little larger than WALK_BOUNDS, so the player is always inside it, and small
  // enough that the near plane (0.1 m) stays clear of the barrier's inner face.
  near: 0.1,
  boundX: FLOOR_HALF_X - 0.25,
  boundZ: FLOOR_HALF_Z - 0.25,
  minY: 0.8, // above the boards
  maxY: 9, // well under the dome base (WALL.height)
};
