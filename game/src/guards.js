// guards.js — guard brains: patrol, suspicion, alarm, chase and search.
//
// Every guard runs the same state machine:
//   patrol     walk the waypoints, pausing a beat at each corner
//   suspicious heard a noise or glimpsed Wren: walk to the spot and look around
//   alert      the meter filled: chase Wren, shouting, and raise the alarm
//   search     lost sight of Wren: sweep the last place she was seen, then give up
//   return     walk back to the nearest waypoint and resume the patrol
//
// The detection meter is the heart of the game. It fills while a guard can
// see Wren (faster up close, slower in shadow) and drains while she is hidden.
// At 1.0 the guard goes alert; below 0.35 a merely suspicious guard calms
// down. An alert guard that touches Wren ends the run for a life.

import { canSee, detectionRate, angleDiff } from './vision.js';
import { TILE, isSolidAt } from './levels.js';

export const GUARD_RADIUS = 13;
export const CATCH_RADIUS = 20;
export const CHASE_SPEED = 118; // px/s — a touch faster than Wren's run
export const SEARCH_TIME = 4.5; // seconds sweeping the last-seen spot
export const PAUSE_AT_WAYPOINT = 0.9; // seconds looking around at corners

// A guard is a circle of GUARD_RADIUS: it may not enter a solid tile.
function guardBlocked(world, x, y) {
  const r = GUARD_RADIUS;
  return (
    isSolidAt(world, x + r, y - r + 1) ||
    isSolidAt(world, x + r, y + r - 1) ||
    isSolidAt(world, x - r, y - r + 1) ||
    isSolidAt(world, x - r, y + r - 1) ||
    isSolidAt(world, x - r + 1, y + r) ||
    isSolidAt(world, x + r - 1, y + r) ||
    isSolidAt(world, x - r + 1, y - r) ||
    isSolidAt(world, x + r - 1, y - r)
  );
}

export function makeGuard(def, index) {
  const spawn = def.spawn;
  const waypoints = def.waypoints.map(([tx, ty]) => ({
    x: (tx + 0.5) * TILE,
    y: (ty + 0.5) * TILE,
  }));
  return {
    id: index,
    x: (spawn[0] + 0.5) * TILE,
    y: (spawn[1] + 0.5) * TILE,
    facing: def.facing,
    speed: def.speed * TILE,
    waypoints,
    waypointIndex: 1 % waypoints.length,
    state: 'patrol',
    meter: 0, // 0..1 detection
    pauseTimer: 0,
    searchTimer: 0,
    investigate: null, // {x, y} the guard is walking to check
    lastSeen: null, // {x, y} where Wren was last spotted
    heardAt: null, // {x, y, t} of the last noise the guard is chasing
    chaseLost: 0, // seconds since the guard last saw Wren while alert
    lookDir: 0, // scanning direction while searching
  };
}

// Steer a guard toward a point at a speed; returns true when it arrives.
// Each axis is tested on its own, so a guard slides along a wall instead of
// walking through it — a chasing guard must go around cover like Wren does.
function moveToward(world, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  if (!guardBlocked(world, nx, guard.y)) guard.x = nx;
  if (!guardBlocked(world, guard.x, ny)) guard.y = ny;
  guard.facing = Math.atan2(dy, dx);
  return Math.hypot(tx - guard.x, ty - guard.y) < 4;
}

// A guard that hears a noise (a running footstep nearby, or a lure landing)
// turns toward it and walks over to look. Louder noises travel further.
export function hearNoise(guard, x, y, loudness) {
  if (guard.state === 'alert') return; // an alert guard ignores distractions
  const d = Math.hypot(x - guard.x, y - guard.y);
  if (d > loudness) return;
  guard.heardAt = { x, y };
  if (guard.state === 'patrol' || guard.state === 'return') {
    guard.state = 'suspicious';
    guard.investigate = { x, y };
  } else if (guard.state === 'search') {
    guard.investigate = { x, y };
  }
}

// One tick of one guard. `events` collects plain objects the game loop turns
// into sounds and HUD flashes: {type:'spotted'} when the meter first passes
// 0.5, {type:'alarm'} when it fills, {type:'lost'} when an alert guard gives up.
export function updateGuard(world, guard, player, dt, events) {
  const sees = canSee(world, guard, player.x, player.y);

  if (sees) {
    guard.lastSeen = { x: player.x, y: player.y };
    const before = guard.meter;
    guard.meter = Math.min(1, guard.meter + detectionRate(world, guard, player) * dt);
    if (before < 0.5 && guard.meter >= 0.5) events.push({ type: 'spotted', guard });
    if (guard.meter >= 1 && guard.state !== 'alert') {
      guard.state = 'alert';
      guard.chaseLost = 0;
      events.push({ type: 'alarm', guard });
    }
  } else {
    guard.meter = Math.max(0, guard.meter - 0.45 * dt);
  }

  switch (guard.state) {
    case 'patrol': {
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.facing += Math.sin(performance.now() / 900 + guard.id) * 0.002;
        break;
      }
      const target = guard.waypoints[guard.waypointIndex];
      if (moveToward(world, guard, target.x, target.y, guard.speed, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = PAUSE_AT_WAYPOINT;
      }
      break;
    }
    case 'suspicious': {
      const target = guard.investigate || guard.lastSeen;
      if (!target) {
        guard.state = 'return';
        break;
      }
      if (moveToward(world, guard, target.x, target.y, guard.speed * 1.15, dt)) {
        guard.state = 'search';
        guard.searchTimer = SEARCH_TIME;
        guard.lookDir = guard.facing;
      }
      break;
    }
    case 'alert': {
      if (sees) {
        guard.chaseLost = 0;
        moveToward(world, guard, player.x, player.y, CHASE_SPEED, dt);
      } else {
        guard.chaseLost += dt;
        const spot = guard.lastSeen;
        if (spot) moveToward(world, guard, spot.x, spot.y, CHASE_SPEED * 0.92, dt);
        if (guard.chaseLost > 2.2) {
          guard.state = 'search';
          guard.searchTimer = SEARCH_TIME;
          guard.lookDir = guard.facing;
          events.push({ type: 'lost', guard });
        }
      }
      break;
    }
    case 'search': {
      guard.searchTimer -= dt;
      guard.facing = guard.lookDir + Math.sin((SEARCH_TIME - guard.searchTimer) * 1.6) * 1.1;
      if (guard.meter <= 0.05 && guard.searchTimer <= 0) guard.state = 'return';
      if (guard.searchTimer <= 0 && guard.meter <= 0.35) guard.state = 'return';
      break;
    }
    case 'return': {
      // Walk back to the closest waypoint, then fall back into the patrol.
      let best = 0;
      let bestD = Infinity;
      guard.waypoints.forEach((w, i) => {
        const d = Math.hypot(w.x - guard.x, w.y - guard.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      const target = guard.waypoints[best];
      if (moveToward(world, guard, target.x, target.y, guard.speed, dt)) {
        guard.waypointIndex = (best + 1) % guard.waypoints.length;
        guard.state = 'patrol';
      }
      break;
    }
  }

  // A suspicious guard whose meter has drained calms down and goes home.
  if (guard.state === 'suspicious' && guard.meter <= 0.02 && !guard.heardAt) {
    guard.state = 'return';
  }
  return guard;
}

// True when any guard is close enough to grab Wren.
export function guardCatchesPlayer(guard, player) {
  return Math.hypot(guard.x - player.x, guard.y - player.y) <= CATCH_RADIUS;
}

export function anyAlert(guards) {
  return guards.some((g) => g.state === 'alert');
}

export function highestMeter(guards) {
  return guards.reduce((m, g) => Math.max(m, g.meter), 0);
}
