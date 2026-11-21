// The game's rules and state, with no drawing and no browser in it: the player, the
// guards and their vision cones, detection, noise, lures, artifacts and the exit.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react without the world knowing about screens or sound.

import { ARTIFACT_POINTS, COLS, GUARD, LIVES, LURES_PER_LEVEL, PLAYER, ROWS, TILE } from './config.js';
import { LEVELS as LEVEL_DEFS } from './levels.js';
import { findPath } from './pathfind.js';

export const EVENT_ARTIFACT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_COMPLETE = 4;
export const EVENT_SPOTTED = 8;
export const EVENT_ALARM = 16;
export const EVENT_HEARD = 32;

const GUARD_PATROL = 0;
const GUARD_SUSPICIOUS = 1;
const GUARD_ALERT = 2;
const GUARD_SEARCH = 3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    levelName: '',
    levelBrief: '',
    grid: [],
    player: { x: 0, y: 0, angle: 0, moving: false, sneaking: false, running: false },
    guards: [],
    artifacts: [],
    exit: { x: 0, y: 0, active: false },
    score: 0,
    lives: LIVES,
    lures: LURES_PER_LEVEL,
    elapsed: 0,
    levelElapsed: 0,
    artifactsGot: 0,
    artifactsTotal: 0,
    everAlerted: false,
    maxDetection: 0,
    luresThrown: [],
    sparkles: [],
  };

  function tileAt(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
    return state.grid[r][c];
  }

  function isBlockedTile(c, r) {
    const t = tileAt(c, r);
    return t === '#' || t === 'c';
  }

  function isBlockedPx(x, y) {
    return isBlockedTile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  function isShadowPx(x, y) {
    return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 'd';
  }

  /** True when nothing blocks the straight line between the two points. */
  function hasLineOfSight(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 8));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isBlockedPx(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }

  function circleHitsWall(x, y, radius) {
    const c0 = Math.floor((x - radius) / TILE);
    const c1 = Math.floor((x + radius) / TILE);
    const r0 = Math.floor((y - radius) / TILE);
    const r1 = Math.floor((y + radius) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!isBlockedTile(c, r)) continue;
        const nx = clamp(x, c * TILE, c * TILE + TILE);
        const ny = clamp(y, r * TILE, r * TILE + TILE);
        if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < radius * radius) return true;
      }
    }
    return false;
  }

  /** Move a circle with wall sliding: try x, then y, keeping the axis that fits. */
  function moveCircle(body, dx, dy, radius) {
    const nx = body.x + dx;
    if (!circleHitsWall(nx, body.y, radius)) body.x = nx;
    const ny = body.y + dy;
    if (!circleHitsWall(body.x, ny, radius)) body.y = ny;
  }

  function loadLevel(index) {
    const def = LEVEL_DEFS[index];
    state.levelIndex = index;
    state.levelName = def.name;
    state.levelBrief = def.brief;
    state.grid = def.map.map((row) => row.split(''));
    state.artifacts = [];
    state.guards = [];
    state.luresThrown = [];
    state.sparkles = [];
    state.lures = LURES_PER_LEVEL;
    state.levelElapsed = 0;
    state.artifactsGot = 0;
    state.everAlerted = false;
    state.maxDetection = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = state.grid[r][c];
        const px = (c + 0.5) * TILE;
        const py = (r + 0.5) * TILE;
        if (t === 'P') {
          state.player.x = px;
          state.player.y = py;
          state.player.angle = 0;
        } else if (t === 'a') {
          state.artifacts.push({ x: px, y: py, taken: false, phase: random() * Math.PI * 2 });
        } else if (t === 'E') {
          state.exit.x = px;
          state.exit.y = py;
          state.exit.active = false;
        }
      }
    }
    state.artifactsTotal = state.artifacts.length;
    for (const g of def.guards) {
      const [sc, sr] = g.spawn;
      state.guards.push({
        x: (sc + 0.5) * TILE,
        y: (sr + 0.5) * TILE,
        angle: 0,
        waypoints: g.waypoints.map(([c, r]) => [(c + 0.5) * TILE, (r + 0.5) * TILE]),
        wpIndex: 0,
        pause: 0,
        scanPhase: random() * Math.PI * 2,
        state: GUARD_PATROL,
        detection: 0,
        lastSeen: null,
        loseTimer: 0,
        path: null,
        pathIndex: 0,
        repath: 0,
        searchTimer: 0,
      });
    }
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.elapsed = 0;
    loadLevel(0);
  }

  function nextLevel() {
    if (state.levelIndex + 1 >= LEVEL_DEFS.length) return false;
    loadLevel(state.levelIndex + 1);
    return true;
  }

  function guardSeesPlayer(guard) {
    const dx = state.player.x - guard.x;
    const dy = state.player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.viewDist) return { seen: false, dist };
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD.viewHalfAngle) return { seen: false, dist };
    if (!hasLineOfSight(guard.x, guard.y, state.player.x, state.player.y)) return { seen: false, dist };
    return { seen: true, dist };
  }

  function hearNoise(x, y, radius) {
    let heard = false;
    for (const guard of state.guards) {
      if (guard.state === GUARD_ALERT) continue;
      if (Math.hypot(guard.x - x, guard.y - y) > radius) continue;
      guard.state = GUARD_SUSPICIOUS;
      guard.lastSeen = { x, y };
      guard.path = null;
      guard.searchTimer = 0;
      heard = true;
    }
    return heard;
  }

  function throwLure(x, y) {
    if (state.lures <= 0) return false;
    state.lures -= 1;
    state.luresThrown.push({ x, y, age: 0 });
    return true;
  }

  function updateGuard(guard, dt, events) {
    const player = state.player;
    const seen = guardSeesPlayer(guard);

    // Detection fills while seen, drains while hidden.
    if (seen.seen) {
      let rate = seen.dist < 80 ? GUARD.detectClose : seen.dist < 170 ? GUARD.detectMid : GUARD.detectFar;
      if (player.sneaking) rate *= GUARD.sneakFactor;
      if (isShadowPx(player.x, player.y)) rate *= GUARD.shadowFactor;
      if (player.running) rate *= GUARD.runFactor;
      const before = guard.detection;
      guard.detection = clamp(guard.detection + rate * dt, 0, 1);
      if (before < GUARD.suspiciousAt && guard.detection >= GUARD.suspiciousAt && guard.state === GUARD_PATROL) {
        events.value |= EVENT_SPOTTED;
      }
      if (guard.detection >= 1 && guard.state !== GUARD_ALERT) {
        guard.state = GUARD_ALERT;
        guard.loseTimer = 0;
        state.everAlerted = true;
        events.value |= EVENT_ALARM;
      }
      guard.lastSeen = { x: player.x, y: player.y };
      if (guard.state === GUARD_ALERT) guard.loseTimer = 0;
    } else {
      guard.detection = clamp(guard.detection - GUARD.detectDecay * dt, 0, 1);
      if (guard.state === GUARD_ALERT) {
        guard.loseTimer += dt;
        if (guard.loseTimer > GUARD.loseSightTime) {
          guard.state = GUARD_SEARCH;
          guard.searchTimer = 0;
          guard.path = null;
        }
      }
    }
    if (guard.detection > state.maxDetection) state.maxDetection = guard.detection;

    // Suspicion without a full alarm: go look at where the player was last seen.
    if (guard.state === GUARD_PATROL && guard.detection >= GUARD.suspiciousAt) {
      guard.state = GUARD_SUSPICIOUS;
      guard.path = null;
      guard.searchTimer = 0;
    }

    let target = null;
    let speed = GUARD.patrolSpeed;
    if (guard.state === GUARD_PATROL) {
      target = guard.waypoints[guard.wpIndex];
      if (guard.pause > 0) {
        guard.pause -= dt;
        guard.angle += Math.sin(state.levelElapsed * 0.8 + guard.scanPhase) * 0.35 * dt;
        return;
      }
      if (Math.hypot(target[0] - guard.x, target[1] - guard.y) < 6) {
        guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
        guard.pause = GUARD.waypointPause;
        return;
      }
    } else if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH) {
      speed = GUARD.suspiciousSpeed;
      const dest = guard.lastSeen;
      if (!dest) {
        guard.state = GUARD_PATROL;
        return;
      }
      if (Math.hypot(dest.x - guard.x, dest.y - guard.y) < 10) {
        guard.searchTimer += dt;
        guard.angle += Math.sin(state.levelElapsed * 1.6 + guard.scanPhase) * 0.9 * dt;
        if (guard.searchTimer > 2.2) {
          guard.state = GUARD_PATROL;
          guard.detection = 0;
          guard.path = null;
        }
        return;
      }
      target = followPath(guard, dest, dt);
      if (target === null) {
        guard.state = GUARD_PATROL;
        guard.detection = 0;
        return;
      }
    } else if (guard.state === GUARD_ALERT) {
      speed = GUARD.chaseSpeed;
      const dest = seen.seen ? { x: player.x, y: player.y } : guard.lastSeen;
      if (!dest) {
        guard.state = GUARD_SEARCH;
        return;
      }
      target = followPath(guard, dest, dt);
      if (target === null) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = 0;
        return;
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchDist) {
        events.value |= EVENT_CAUGHT;
        return;
      }
    }
    if (target === null) return;
    const dx = target[0] - guard.x;
    const dy = target[1] - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const want = Math.atan2(dy, dx);
    const turn = clamp(angleDiff(want, guard.angle), -3.2 * dt, 3.2 * dt);
    guard.angle += turn;
    moveCircle(guard, (dx / dist) * speed * dt, (dy / dist) * speed * dt, GUARD.radius);
  }

  /** Follow a BFS path toward a destination; returns the next pixel target, or null. */
  function followPath(guard, dest, dt) {
    guard.repath -= dt;
    const gc = Math.floor(guard.x / TILE);
    const gr = Math.floor(guard.y / TILE);
    const dc = Math.floor(dest.x / TILE);
    const dr = Math.floor(dest.y / TILE);
    if (guard.path === null || guard.repath <= 0) {
      guard.path = findPath(isBlockedTile, COLS, ROWS, gc, gr, dc, dr);
      guard.pathIndex = 0;
      guard.repath = 0.5;
      if (guard.path === null) return null;
    }
    if (guard.pathIndex >= guard.path.length) return [dest.x, dest.y];
    const [px, py] = guard.path[guard.pathIndex];
    if (Math.hypot(px - guard.x, py - guard.y) < 8) {
      guard.pathIndex += 1;
      return guard.pathIndex >= guard.path.length ? [dest.x, dest.y] : guard.path[guard.pathIndex];
    }
    return [px, py];
  }

  /**
   * One fixed step. `move` is a normalised {x, y} vector, `sneak`/`run` are held keys,
   * `lure` is a pixel point to throw a lure at (or null). `harmless` runs the world as a
   * title-screen backdrop: guards patrol, nothing is caught and nothing scores.
   */
  function step(dt, move, sneak, run, lure, harmless) {
    const events = { value: 0 };
    state.elapsed += dt;
    state.levelElapsed += dt;
    const player = state.player;

    const speed = sneak ? PLAYER.sneakSpeed : run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.sneaking = sneak;
    player.running = run && !sneak;
    player.moving = move.x !== 0 || move.y !== 0;
    if (player.moving) {
      const len = Math.hypot(move.x, move.y) || 1;
      player.angle = Math.atan2(move.y / len, move.x / len);
      moveCircle(player, (move.x / len) * speed * dt, (move.y / len) * speed * dt, PLAYER.radius);
      if (player.running && !harmless) {
        if (hearNoise(player.x, player.y, GUARD.hearRunDist)) events.value |= EVENT_HEARD;
      }
    }

    if (lure !== null && !harmless) {
      if (throwLure(lure.x, lure.y)) {
        if (hearNoise(lure.x, lure.y, GUARD.hearLureDist)) events.value |= EVENT_HEARD;
      }
    }

    for (const guard of state.guards) updateGuard(guard, dt, events);
    if (events.value & EVENT_CAUGHT && harmless) events.value &= ~EVENT_CAUGHT;

    // Lure pings fade.
    for (let i = state.luresThrown.length - 1; i >= 0; i--) {
      state.luresThrown[i].age += dt;
      if (state.luresThrown[i].age > 1.2) state.luresThrown.splice(i, 1);
    }
    // Pickup sparkles fade.
    for (let i = state.sparkles.length - 1; i >= 0; i--) {
      const s = state.sparkles[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) state.sparkles.splice(i, 1);
    }

    if (!harmless) {
      for (const art of state.artifacts) {
        if (!art.taken && Math.hypot(art.x - player.x, art.y - player.y) < 28) {
          art.taken = true;
          state.artifactsGot += 1;
          state.score += ARTIFACT_POINTS;
          events.value |= EVENT_ARTIFACT;
          for (let i = 0; i < 10; i++) {
            const a = random() * Math.PI * 2;
            const sp = 40 + random() * 90;
            state.sparkles.push({ x: art.x, y: art.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + random() * 0.4 });
          }
          if (state.artifactsGot >= state.artifactsTotal) state.exit.active = true;
        }
      }
      if (state.exit.active && Math.hypot(state.exit.x - player.x, state.exit.y - player.y) < 30) {
        events.value |= EVENT_COMPLETE;
      }
    }
    return events.value;
  }

  function levelBonus() {
    const timeBonus = Math.max(0, Math.round((300 - state.levelElapsed) * 5));
    const ghost = state.everAlerted ? 0 : 500;
    return timeBonus + ghost;
  }

  function applyLevelBonus() {
    const bonus = levelBonus();
    state.score += bonus;
    return bonus;
  }

  reset();
  return {
    state,
    reset,
    loadLevel,
    nextLevel,
    step,
    tileAt,
    isBlockedTile,
    isBlockedPx,
    isShadowPx,
    hasLineOfSight,
    levelBonus,
    applyLevelBonus,
    guardStates: { PATROL: GUARD_PATROL, SUSPICIOUS: GUARD_SUSPICIOUS, ALERT: GUARD_ALERT, SEARCH: GUARD_SEARCH },
  };
}
