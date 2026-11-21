// shots.js — staged scenes for the entry's screenshots.
//
// The game accepts ?shot=<name>&seed=1 in its URL. In shot mode the game
// builds a fixed, hand-placed scene — exact guard spots, exact facings, exact
// detection meters — and renders one frame at a fixed clock (t = 1.6 s).
// Nothing random runs in shot mode, so the same URL always paints the same
// pixels: the screenshots are real renders of the game's own code, and they
// are byte-identical from run to run.
//
//   1-cover  Level 1: Wren crouched in shadow beside a glowing chart while a
//            guard's cone sweeps past her and a second guard grows suspicious.
//   2-chase  Level 2: the alarm is up — a guard chases Wren toward the east
//            door, red cone, full meter, charts already lifted.
//   3-vault  Level 3: Wren behind a brass crate, three cones crossing the
//            vault floor, the last chart glowing in the open.
//   4-win    The night is won: the win overlay over the cleared Vault.

import { TILE } from './levels.js';

export const SHOT_TIME = 1.6; // fixed clock for every screenshot
export const SHOT_NAMES = ['1-cover', '2-chase', '3-vault', '4-win'];

function at(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

function placeGuard(guard, tx, ty, facing, state, meter) {
  const p = at(tx, ty);
  guard.x = p.x;
  guard.y = p.y;
  guard.facing = facing;
  guard.state = state;
  guard.meter = meter;
  guard.pauseTimer = 0;
  guard.searchTimer = 0;
  guard.investigate = null;
  guard.lastSeen = null;
}

// Rearrange the live game into the named staged scene. The game object is
// the one main.js owns: {world, guards, player, state, levelIndex, loadLevel}.
export function stageShot(game, name) {
  const { world, guards, player, state } = game;
  state.screen = 'play';
  state.flash = 0;
  state.timeLeft = 87;
  state.score = 1240;
  state.hint = 'Shadow — hard to spot';
  state.statusLine = 'Ghost so far — no alarm raised';

  if (name === '1-cover') {
    // Wren in the shadow pool at (3,7); a chart glows just ahead at (12,3).
    const p = at(3, 7);
    player.x = p.x;
    player.y = p.y;
    player.facing = Math.PI / 2;
    player.moving = 'sneak';
    placeGuard(guards[0], 7, 6, Math.PI / 2, 'patrol', 0.12);
    placeGuard(guards[1], 16, 9, Math.PI, 'suspicious', 0.62);
    guards[1].investigate = at(11, 9);
    placeGuard(guards[2], 26, 12, -Math.PI / 2, 'patrol', 0);
    placeGuard(guards[3], 12, 12, 0, 'patrol', 0.28);
    state.chartsTaken = 1;
    world.charts[0].taken = true; // the chart at (12,3) is already lifted
    state.statusLine = 'Ghost so far — no alarm raised';
  } else if (name === '2-chase') {
    game.loadLevel(1);
    const g = game.guards;
    const pl = game.player;
    const st = game.state;
    st.screen = 'play';
    st.flash = 0.25;
    st.timeLeft = 54;
    st.score = 2310;
    st.hint = 'ALARM — run for the east door!';
    st.statusLine = 'Spotted! Break line of sight to lose them';
    const p = at(24, 8);
    pl.x = p.x;
    pl.y = p.y;
    pl.facing = 0;
    pl.moving = 'run';
    placeGuard(g[0], 21, 8, 0, 'alert', 1);
    g[0].lastSeen = { x: p.x, y: p.y };
    placeGuard(g[1], 14, 8, Math.PI / 2, 'suspicious', 0.7);
    g[1].investigate = at(20, 8);
    placeGuard(g[2], 21, 4, Math.PI, 'patrol', 0.2);
    placeGuard(g[3], 27, 12, -Math.PI / 2, 'patrol', 0);
    placeGuard(g[4], 10, 10, Math.PI / 2, 'search', 0.4);
    st.chartsTaken = 3;
    for (const c of game.world.charts) c.taken = true;
  } else if (name === '3-vault') {
    game.loadLevel(2);
    const g = game.guards;
    const pl = game.player;
    const st = game.state;
    st.screen = 'play';
    st.flash = 0;
    st.timeLeft = 112;
    st.score = 3180;
    st.hint = 'Shadow — hard to spot';
    st.statusLine = 'One chart left — the open floor is watched';
    const p = at(6, 7);
    pl.x = p.x;
    pl.y = p.y;
    pl.facing = 0;
    pl.moving = 'sneak';
    pl.lureFlight = { x0: p.x, y0: p.y, x1: p.x + 120, y1: p.y - 30, t: 0.14, dur: 0.28 };
    placeGuard(g[0], 7, 10, Math.PI / 2, 'patrol', 0.05);
    placeGuard(g[1], 16, 8, 0, 'patrol', 0.15);
    placeGuard(g[2], 21, 9, Math.PI, 'suspicious', 0.55);
    g[2].investigate = at(19, 9);
    placeGuard(g[3], 12, 12, -Math.PI / 2, 'patrol', 0);
    placeGuard(g[4], 27, 12, Math.PI / 2, 'patrol', 0.1);
    st.chartsTaken = 2;
    game.world.charts[0].taken = true;
    game.world.charts[1].taken = true;
  } else if (name === '4-win') {
    game.loadLevel(2);
    const g = game.guards;
    const pl = game.player;
    const st = game.state;
    st.screen = 'win';
    st.flash = 0;
    st.timeLeft = 0;
    st.score = 4860;
    st.hint = 'The Star Charts are yours';
    st.statusLine = 'All three galleries cleared unseen';
    const p = at(29, 8);
    pl.x = p.x;
    pl.y = p.y;
    pl.facing = 0;
    pl.moving = 'walk';
    placeGuard(g[0], 7, 6, Math.PI / 2, 'patrol', 0);
    placeGuard(g[1], 16, 8, 0, 'patrol', 0);
    placeGuard(g[2], 18, 12, Math.PI, 'patrol', 0);
    placeGuard(g[3], 12, 12, -Math.PI / 2, 'patrol', 0);
    placeGuard(g[4], 27, 14, Math.PI / 2, 'patrol', 0);
    st.chartsTaken = 3;
    for (const c of game.world.charts) c.taken = true;
  } else {
    return false;
  }
  return true;
}
