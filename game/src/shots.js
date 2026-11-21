// The screenshot scenes behind ?shot=start|play|hide|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (follow a grid path to the nearest Star Chart, then to the exit; sneak when a guard is
// near), so the frame is what a short game really looks like and the same seed always
// gives the same frame.

import { STEP, TILE } from './config.js';
import { EVENT_CAUGHT, EVENT_COMPLETE } from './world.js';
import { findPath } from './pathfind.js';
import { SCREEN_BRIEF, SCREEN_LEVEL_DONE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const HIDE_SECONDS = 9;
const END_LIMIT_SECONDS = 240;
const SAMPLE = STEP;

/** Grid path from the player to a pixel target, as a list of pixel waypoints. */
function pathTo(world, tx, ty) {
  const p = world.state.player;
  return findPath(
    (c, r) => world.isBlockedTile(c, r),
    32,
    18,
    Math.floor(p.x / TILE),
    Math.floor(p.y / TILE),
    Math.floor(tx / TILE),
    Math.floor(ty / TILE),
  );
}

/** Steer toward the next path waypoint; sneak when a guard is close. */
function autopilot(world, path) {
  const p = world.state.player;
  if (path === null || path.length === 0) return { move: { x: 0, y: 0 }, sneak: true, run: false };
  const [tx, ty] = path[0];
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) path.shift();
  const nearGuard = world.state.guards.some((g) => Math.hypot(g.x - p.x, g.y - p.y) < 190);
  return {
    move: dist === 0 ? { x: 0, y: 0 } : { x: dx / dist, y: dy / dist },
    sneak: nearGuard,
    run: false,
  };
}

/** The current objective: the nearest remaining Star Chart, else the exit. */
function objectivePath(world) {
  const p = world.state.player;
  let target = null;
  let best = Infinity;
  for (const art of world.state.artifacts) {
    if (art.taken) continue;
    const d = Math.hypot(art.x - p.x, art.y - p.y);
    if (d < best) {
      best = d;
      target = art;
    }
  }
  if (target === null) target = world.state.exit;
  return pathTo(world, target.x, target.y);
}

/** Run the autopilot for `seconds`, re-planning the path when it runs out. */
function runAutopilot(world, seconds) {
  let path = objectivePath(world);
  let events = 0;
  for (let t = 0; t < seconds; t += SAMPLE) {
    if (path !== null && path.length === 0) path = objectivePath(world);
    const { move, sneak, run } = autopilot(world, path);
    events |= world.step(SAMPLE, move, sneak, run, null, false);
    if (events & EVENT_COMPLETE) break;
    if (events & EVENT_CAUGHT) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over a patrolling gallery. play: mid-heist. hide: a near miss,
 * the thief crouched a step from a passing guard. end: the first gallery cleared.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runAutopilot(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'hide') {
    // Crouch on the floor tile west of the display case at (13, 7), a step from guard
    // one's patrol line, and let the patrol walk past for a near miss.
    const p = world.state.player;
    p.x = (13 + 0.5) * TILE;
    p.y = (7 + 0.5) * TILE;
    p.sneaking = true;
    for (let t = 0; t < HIDE_SECONDS; t += SAMPLE) {
      world.step(SAMPLE, { x: 0, y: 0 }, true, false, null, true);
    }
    p.sneaking = true;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    const events = runAutopilot(world, END_LIMIT_SECONDS);
    if (events & EVENT_COMPLETE) {
      world.applyLevelBonus();
      return { screen: SCREEN_LEVEL_DONE };
    }
    // The autopilot could not finish in time: stage the cleared screen by hand, still
    // through the world's own state, so the frame is the real victory screen.
    for (const art of world.state.artifacts) art.taken = true;
    world.state.artifactsGot = world.state.artifactsTotal;
    world.state.exit.active = true;
    world.state.player.x = world.state.exit.x;
    world.state.player.y = world.state.exit.y;
    world.applyLevelBonus();
    return { screen: SCREEN_LEVEL_DONE };
  }
  for (let t = 0; t < START_SECONDS; t += SAMPLE) {
    world.step(SAMPLE, { x: 0, y: 0 }, false, false, null, true);
  }
  return { screen: SCREEN_TITLE };
}
