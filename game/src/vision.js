// vision.js — what a guard can see.
//
// A guard sees Wren only when three things are true at once: Wren is inside
// the guard's vision cone (range and angle), there is a clear line of sight
// (no wall or crate between them), and the guard is not blinded by a lure
// investigation facing away. The cone is drawn the same way it is tested, so
// what the player sees on screen is exactly what the guard sees.
//
// Line of sight walks the segment in small steps and asks the level grid
// whether each step is solid. Steps of 6 px are far smaller than a tile, so
// no wall thinner than a tile can ever be skipped.

import { TILE, isSolidAt, isShadowAt } from './levels.js';

export const CONE_RANGE = 190; // px: how far a guard can spot Wren
export const CONE_HALF_ANGLE = 0.61; // radians, about 35 degrees each side
export const LOS_STEP = 6; // px between samples along a sight line

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// True when nothing solid stands between (x0,y0) and (x1,y1).
export function hasLineOfSight(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / LOS_STEP));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidAt(world, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

// True when the point (px,py) falls inside the cone of a guard standing at
// (gx,gy) and facing `facing`. Range and angle only; callers add the sight
// line check separately so the cone can be drawn even where sight is blocked.
export function inVisionCone(gx, gy, facing, px, py) {
  const dx = px - gx;
  const dy = py - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > CONE_RANGE) return false;
  if (dist < 14) return true; // nose to nose: no guard misses that
  const ang = Math.atan2(dy, dx);
  return Math.abs(angleDiff(ang, facing)) <= CONE_HALF_ANGLE;
}

// Full visibility test: cone + clear sight line.
export function canSee(world, guard, px, py) {
  if (!inVisionCone(guard.x, guard.y, guard.facing, px, py)) return false;
  return hasLineOfSight(world, guard.x, guard.y, px, py);
}

// How fast this sighting fills a guard's detection meter, 0..1 per second.
// Close is fast, far is slow, running Wren is easier to spot, and standing in
// shadow nearly halves it — shadows are the game's safe ground.
export function detectionRate(world, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  const closeness = 1 - dist / CONE_RANGE; // 0 at the edge, 1 on top of them
  let rate = 0.3 + 1.6 * closeness * closeness;
  if (player.moving === 'run') rate *= 1.6;
  if (player.moving === 'sneak') rate *= 0.7;
  if (isShadowAt(world, player.x, player.y)) rate *= 0.45;
  return rate;
}

// Trace the cone's edge until it hits a wall, for drawing: returns the point
// where the ray from the guard at angle `a` first meets something solid.
export function coneRayHit(world, gx, gy, a, maxDist) {
  for (let d = 8; d <= maxDist; d += 6) {
    const x = gx + Math.cos(a) * d;
    const y = gy + Math.sin(a) * d;
    if (isSolidAt(world, x, y)) return { x, y, dist: d };
  }
  return { x: gx + Math.cos(a) * maxDist, y: gy + Math.sin(a) * maxDist, dist: maxDist };
}

// Sampled polygon of the visible part of a cone: the guard's eye, the arc of
// rays, each cut short by the first wall it meets. The renderer fills this.
export function conePolygon(world, guard) {
  const pts = [{ x: guard.x, y: guard.y }];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const a = guard.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / steps;
    pts.push(coneRayHit(world, guard.x, guard.y, a, CONE_RANGE));
  }
  return pts;
}

// Unused helper kept for the dossier outline: tile size in px, one place.
export { TILE };
