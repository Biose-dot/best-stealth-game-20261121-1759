// levels.js — the three galleries of Nightshift.
//
// A level is a grid of tiles, 32 columns by 18 rows, one tile = 40 px, so the
// whole map is exactly 1280 x 720, the size of the game canvas.
//   '#'  wall (blocks movement and sight)
//   '.'  open gallery floor
//   'D'  shadow floor: dark, detection fills much slower while Wren stands here
//   'C'  crate / pedestal: solid cover, blocks sight, Wren can hide behind it
//   'P'  where Wren starts the level
//   'S'  a Star Chart pedestal (3 per level)
//   'E'  the east exit door (locked until all 3 charts are lifted)
//
// Layout skeleton, shared by all three galleries so the player can learn it:
// two vertical walls (columns 8 and 23) with door gaps on rows 4 and 13, two
// horizontal walls (rows 5 and 11) with door gaps at columns 12 and 19, and a
// shadow corridor down column 16. Every room connects through those gaps, so
// the whole floor is reachable on foot — no chart or exit is ever sealed off.
// Guards patrol inside one region or along a gap corridor, never through a
// wall: their waypoints are all floor tiles with a clear straight path
// between consecutive stops.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

function buildLevel(name, subtitle, rows, guards, parTime) {
  return { name, subtitle, rows, guards, parTime };
}

// The shared wall rows, so a typo in one level cannot seal a gallery.
const TOP = '################################';
const WALL_ROW = '#.......####.###D##.####.......#'; // row 5 / 11: gaps at 12 and 19
const GAP_ROW = '#...............D..............#'; // row 4 / 13: vertical walls open
const OPEN_ROW = '#.......#.......D.......#......#';

export const LEVELS = [
  buildLevel(
    'The Meridian Gallery',
    'Level 1 — lift 3 Star Charts, slip out the east door unseen',
    [
      TOP,
      '#P......#.......D......#......E#',
      OPEN_ROW,
      '#..C....#...S...D...C..#...S...#',
      GAP_ROW,
      WALL_ROW,
      OPEN_ROW,
      '#..D....#..C....D....C..#....D.#',
      OPEN_ROW,
      OPEN_ROW,
      '#...S...#.......D.......#...C..#',
      WALL_ROW,
      '#..C....#...D...D...C...#....D.#',
      GAP_ROW,
      OPEN_ROW,
      OPEN_ROW,
      OPEN_ROW,
      TOP,
    ],
    [
      { spawn: [4, 2], waypoints: [[4, 2], [4, 8], [6, 8], [6, 2]], facing: Math.PI / 2, speed: 1.6 },
      { spawn: [12, 2], waypoints: [[12, 2], [12, 8], [14, 8], [14, 6], [12, 6]], facing: Math.PI / 2, speed: 1.8 },
      { spawn: [19, 2], waypoints: [[19, 2], [19, 8], [20, 8], [20, 6], [19, 6]], facing: Math.PI / 2, speed: 1.6 },
      { spawn: [27, 2], waypoints: [[27, 2], [27, 15], [29, 15], [29, 2]], facing: Math.PI / 2, speed: 1.5 },
    ],
    150,
  ),
  buildLevel(
    'The Vault Corridor',
    'Level 2 — longer patrols, tighter cover, the same three charts',
    [
      TOP,
      '#P......#.......D......#......E#',
      OPEN_ROW,
      '#..C....#.....S.D.......#...C..#',
      GAP_ROW,
      WALL_ROW,
      '#.......#..D....D.......#......#',
      '#.......#....C..D.C.....#..S...#',
      OPEN_ROW,
      OPEN_ROW,
      '#.......#.......D...C...#......#',
      WALL_ROW,
      '#.......#.......D.......#...C..#',
      GAP_ROW,
      '#...S...#.......D.......#......#',
      OPEN_ROW,
      '#.......#.......D.......#...D..#',
      TOP,
    ],
    [
      { spawn: [4, 2], waypoints: [[4, 2], [4, 8], [6, 8], [6, 2]], facing: Math.PI / 2, speed: 1.9 },
      { spawn: [12, 2], waypoints: [[12, 2], [12, 8], [14, 8], [14, 6], [12, 6]], facing: Math.PI / 2, speed: 2.0 },
      { spawn: [19, 2], waypoints: [[19, 2], [19, 8], [20, 8], [20, 6], [19, 6]], facing: Math.PI / 2, speed: 1.9 },
      { spawn: [27, 2], waypoints: [[27, 2], [27, 15], [29, 15], [29, 2]], facing: Math.PI / 2, speed: 1.7 },
      { spawn: [10, 8], waypoints: [[10, 8], [20, 8], [20, 9], [10, 9]], facing: 0, speed: 1.8 },
    ],
    180,
  ),
  buildLevel(
    'The Vault',
    'Level 3 — the charts hang in the open; only patience gets them out',
    [
      TOP,
      '#P......#.......D......#......E#',
      OPEN_ROW,
      '#..C....#...S...D...C..#...S...#',
      GAP_ROW,
      WALL_ROW,
      OPEN_ROW,
      '#..D....#..C....D....C..#....D.#',
      OPEN_ROW,
      OPEN_ROW,
      '#...S...#.......D.......#...C..#',
      WALL_ROW,
      '#..C....#...D...D...C...#....D.#',
      GAP_ROW,
      OPEN_ROW,
      OPEN_ROW,
      OPEN_ROW,
      TOP,
    ],
    [
      { spawn: [4, 2], waypoints: [[4, 2], [4, 8], [6, 8], [6, 2]], facing: Math.PI / 2, speed: 2.1 },
      { spawn: [12, 2], waypoints: [[12, 2], [12, 8], [14, 8], [14, 6], [12, 6]], facing: Math.PI / 2, speed: 2.2 },
      { spawn: [19, 2], waypoints: [[19, 2], [19, 8], [20, 8], [20, 6], [19, 6]], facing: Math.PI / 2, speed: 2.1 },
      { spawn: [27, 2], waypoints: [[27, 2], [27, 15], [29, 15], [29, 2]], facing: Math.PI / 2, speed: 2.0 },
      { spawn: [10, 14], waypoints: [[10, 14], [20, 14], [20, 16], [10, 16]], facing: 0, speed: 1.9 },
    ],
    210,
  ),
];

// Parse a level's rows into a runtime world: solid grid, shadow grid, and the
// positions of the player start, the charts and the exit.
export function parseLevel(def) {
  const solid = [];
  const shadow = [];
  let playerStart = null;
  const charts = [];
  let exit = null;
  for (let y = 0; y < ROWS; y++) {
    solid.push(new Array(COLS).fill(false));
    shadow.push(new Array(COLS).fill(false));
    for (let x = 0; x < COLS; x++) {
      const ch = def.rows[y][x];
      if (ch === '#' || ch === 'C') solid[y][x] = true;
      if (ch === 'D') shadow[y][x] = true;
      if (ch === 'P') playerStart = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
      if (ch === 'S') charts.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, taken: false });
      if (ch === 'E') exit = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
    }
  }
  return { def, solid, shadow, playerStart, charts, exit };
}

// Tile lookup helpers shared by movement, vision and rendering.
export function tileAt(world, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return world.def.rows[ty][tx];
}

export function isSolidAt(world, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return world.solid[ty][tx];
}

export function isShadowAt(world, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  return world.shadow[ty][tx];
}
