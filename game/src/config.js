// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area (32 by 18 tiles of 40 px); the renderer scales it to the window, so no rule below
// depends on the screen size.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const FIELD = { width: COLS * TILE, height: ROWS * TILE };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  sneakSpeed: 86,
  runSpeed: 208,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 56,
  suspiciousSpeed: 88,
  chaseSpeed: 138,
  /** Half-angle of the vision cone, in radians. */
  viewHalfAngle: 0.66,
  viewDist: 235,
  waypointPause: 1.4,
  /** Detection 0..1. Filled while the player is seen, drained while hidden. */
  detectClose: 1.15,
  detectMid: 0.62,
  detectFar: 0.34,
  detectDecay: 0.55,
  sneakFactor: 0.45,
  shadowFactor: 0.35,
  runFactor: 1.6,
  /** Detection above this makes a guard suspicious and come to look. */
  suspiciousAt: 0.45,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  loseSightTime: 4,
  /** How close a chasing guard must get to catch the player. */
  catchDist: 26,
  /** Running footsteps are heard this far away. */
  hearRunDist: 135,
  /** A thrown lure is heard this far away. */
  hearLureDist: 280,
};

export const LURES_PER_LEVEL = 3;
export const LIVES = 3;
export const ARTIFACT_POINTS = 200;
export const GHOST_BONUS = 500;

export const PALETTE = {
  backdrop: '#0b0e16',
  floorA: '#272d42',
  floorB: '#242a3d',
  floorLine: '#2b3044',
  wall: '#3a4157',
  wallTop: '#565f7d',
  wallSide: '#2a2f42',
  coverWood: '#6b4a2f',
  coverWoodTop: '#8a623c',
  coverGlass: '#7fb3c8',
  shadow: '#141a2e',
  shadowEdge: '#1d2440',
  player: '#e8e4d8',
  playerCloak: '#3f5a4a',
  guard: '#c8ccd8',
  guardUniform: '#33415e',
  guardCap: '#1e2a44',
  coneCalm: '255, 214, 110',
  coneSuspicious: '255, 150, 60',
  coneAlert: '255, 70, 70',
  artifact: '#ffd76a',
  exit: '#58d68d',
  exitDark: '#1e5c38',
  text: '#eef1f5',
  muted: '#9aa3b8',
  danger: '#ff5f5f',
  panel: 'rgba(10, 13, 22, 0.82)',
  lamp: '255, 196, 110',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nightshift.best';
