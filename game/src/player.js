// player.js — Wren, the thief.
//
// Wren moves with WASD or the arrow keys. Three speeds, three noise levels:
//   sneak  (hold C or Ctrl)  62 px/s,  silent,  hardest to spot
//   walk   (default)        105 px/s,  soft steps, heard only up close
//   run    (hold Shift)     152 px/s,  loud steps, heard across the room
// Clicking the mouse throws a lure — a brass coin — toward the cursor. It
// clinks on the floor and any guard in earshot walks over to look at it,
// which is how a patient thief empties a patrol route.
//
// Movement slides along walls: each axis is tested on its own, so Wren can
// hug a wall while running past it. The body is a circle of radius 12 px.

import { isSolidAt, isShadowAt } from './levels.js';

export const PLAYER_RADIUS = 12;
export const SPEEDS = { sneak: 62, walk: 105, run: 152 };
export const NOISE_RADIUS = { sneak: 0, walk: 55, run: 150 };
export const LURE_RANGE = 260; // px: how far a thrown coin can fly
export const LURE_NOISE = 190; // px: how far its clink carries

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    facing: -Math.PI / 2,
    moving: 'walk', // 'sneak' | 'walk' | 'run' — what the guards react to
    stepTimer: 0, // counts down to the next footstep sound
    lures: 6, // coins in the pouch, refilled each level
    lureFlight: null, // {x0,y0,x1,y1,t} while a coin is in the air
    caughtFlash: 0,
  };
}

// Try to move the circle by (dx, dy); each axis separately so walls slide.
function tryMove(world, player, dx, dy) {
  const r = PLAYER_RADIUS;
  const nx = player.x + dx;
  if (
    !isSolidAt(world, nx + r, player.y - r + 1) &&
    !isSolidAt(world, nx + r, player.y + r - 1) &&
    !isSolidAt(world, nx - r, player.y - r + 1) &&
    !isSolidAt(world, nx - r, player.y + r - 1)
  ) {
    player.x = nx;
  }
  const ny = player.y + dy;
  if (
    !isSolidAt(world, player.x - r + 1, ny + r) &&
    !isSolidAt(world, player.x + r - 1, ny + r) &&
    !isSolidAt(world, player.x - r + 1, ny - r) &&
    !isSolidAt(world, player.x + r - 1, ny - r)
  ) {
    player.y = ny;
  }
}

// input: {up,down,left,right,sneak,run} booleans from the keyboard.
// Returns a list of noise events the game loop hands to the guards:
//   {type:'step', x, y, radius}  a footstep, on a timer that depends on speed
export function updatePlayer(world, player, input, dt) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const events = [];
  if (mx === 0 && my === 0) {
    player.moving = 'walk';
    player.stepTimer = 0;
    return events;
  }
  const len = Math.hypot(mx, my);
  mx /= len;
  my /= len;
  const mode = input.sneak ? 'sneak' : input.run ? 'run' : 'walk';
  player.moving = mode;
  const speed = SPEEDS[mode];
  player.facing = Math.atan2(my, mx);
  tryMove(world, player, mx * speed * dt, my * speed * dt);

  // Footsteps: the faster Wren moves, the sooner the next one, and the
  // further it carries. Sneaking makes none at all.
  player.stepTimer -= dt;
  if (player.stepTimer <= 0 && NOISE_RADIUS[mode] > 0) {
    events.push({ type: 'step', x: player.x, y: player.y, radius: NOISE_RADIUS[mode] });
    player.stepTimer = mode === 'run' ? 0.34 : 0.52;
  }
  return events;
}

// Throw a lure toward (tx,ty). Returns the landing point, or null when the
// pouch is empty or a coin is already flying.
export function throwLure(world, player, tx, ty) {
  if (player.lures <= 0 || player.lureFlight) return null;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return null;
  const fly = Math.min(dist, LURE_RANGE);
  const lx = player.x + (dx / dist) * fly;
  const ly = player.y + (dy / dist) * fly;
  player.lures -= 1;
  player.lureFlight = { x0: player.x, y0: player.y, x1: lx, y1: ly, t: 0, dur: 0.28 };
  return { x: lx, y: ly };
}

// Advance a flying coin; when it lands, return its landing point once.
export function updateLure(player, dt) {
  if (!player.lureFlight) return null;
  const f = player.lureFlight;
  f.t += dt;
  if (f.t >= f.dur) {
    player.lureFlight = null;
    return { x: f.x1, y: f.y1 };
  }
  return null;
}

// Where the coin is right now, for the renderer to draw mid-flight.
export function lurePosition(player) {
  const f = player.lureFlight;
  if (!f) return null;
  const t = Math.min(1, f.t / f.dur);
  const arc = Math.sin(t * Math.PI) * 26; // the coin hops as it flies
  return { x: f.x0 + (f.x1 - f.x0) * t, y: f.y0 + (f.y1 - f.y0) * t - arc };
}

export function playerInShadow(world, player) {
  return isShadowAt(world, player.x, player.y);
}
