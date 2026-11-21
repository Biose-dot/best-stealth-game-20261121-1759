// main.js — Nightshift: the game itself.
//
// Wren, a thief of star charts, works three galleries in one night. Each
// gallery hides 3 Star Charts; lift them all and the east door unlocks, then
// slip out unseen. Guards patrol with vision cones cut short by walls; their
// detection meters fill when they see Wren and drain when she hides. Getting
// caught costs a life — three lives for the whole night.
//
// Screens: title → play → (caught → play) → leveldone → play … → win, or
// gameover when the lives run out. The HUD shows the level, charts, lives,
// lures, the clock and the score. A ghost bonus (never raising the alarm in
// a level) and a time bonus (finishing under par) reward clean, quick play.
//
// Scoring: 150 per chart, 400 ghost bonus, up to 300 time bonus per level
// (2 points per second under par). A caught run loses the level's ghost bonus
// and restarts that gallery with the charts back on their pedestals.

import { LEVELS, parseLevel, isShadowAt } from './levels.js';
import { makeGuard, updateGuard, guardCatchesPlayer, anyAlert, hearNoise } from './guards.js';
import { makePlayer, updatePlayer, throwLure, updateLure, LURE_NOISE } from './player.js';
import { drawGame } from './render.js';
import { stageShot, SHOT_TIME } from './shots.js';
import {
  wakeAudio, playStep, playCoin, playPickup, playSpotted,
  playAlarm, playCaught, playWin, playUnlock, playHeartbeat, toggleMute,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const SHOT_MODE = Boolean(shotName);

const input = { up: false, down: false, left: false, right: false, sneak: false, run: false };

const game = {
  levelIndex: 0,
  world: null,
  guards: [],
  player: null,
  state: {
    screen: 'title',
    levelName: '',
    chartsTaken: 0,
    lives: 3,
    lures: 6,
    timeLeft: 0,
    score: 0,
    hint: 'Stay out of the cones',
    statusLine: 'Lift 3 Star Charts, then leave by the east door',
    ghostBonus: 0,
    timeBonus: 0,
    levelScore: 0,
    flash: 0,
    inShadow: false,
    alarmed: false, // true once any guard raised the alarm this level
  },
  levelTime: 0, // seconds spent in the current level
  heartbeatTimer: 0,
};

export function loadLevel(index) {
  const def = LEVELS[index];
  game.levelIndex = index;
  game.world = parseLevel(def);
  game.guards = def.guards.map((g, i) => makeGuard(g, i));
  game.player = makePlayer(game.world.playerStart);
  game.state.levelName = def.name;
  game.state.chartsTaken = 0;
  game.state.lures = 6;
  game.state.timeLeft = def.parTime;
  game.state.alarmed = false;
  game.state.flash = 0;
  game.state.hint = 'Stay out of the cones';
  game.state.statusLine = 'Lift 3 Star Charts, then leave by the east door';
  game.levelTime = 0;
  game.heartbeatTimer = 0;
}

// The screenshot stager (shots.js) loads other levels into the live game.
game.loadLevel = loadLevel;

function startNight() {
  game.state.score = 0;
  game.state.lives = 3;
  loadLevel(0);
  game.state.screen = 'play';
}

function nextLevel() {
  if (game.levelIndex + 1 >= LEVELS.length) {
    game.state.screen = 'win';
    playWin();
    return;
  }
  loadLevel(game.levelIndex + 1);
  game.state.screen = 'play';
}

function levelCleared() {
  const def = LEVELS[game.levelIndex];
  const ghost = game.state.alarmed ? 0 : 400;
  const timeBonus = Math.max(0, Math.round((def.parTime - game.levelTime) * 2));
  const levelScore = 3 * 150 + ghost + timeBonus;
  game.state.ghostBonus = ghost;
  game.state.timeBonus = timeBonus;
  game.state.levelScore = levelScore;
  game.state.score += levelScore;
  game.state.screen = 'leveldone';
  playWin();
}

function caught() {
  game.state.lives -= 1;
  game.state.flash = 1;
  playCaught();
  if (game.state.lives <= 0) {
    game.state.screen = 'gameover';
  } else {
    game.state.screen = 'caught';
  }
}

function respawn() {
  // The gallery resets: charts back on pedestals, guards back on patrol.
  loadLevel(game.levelIndex);
  game.state.screen = 'play';
}

// --- input ---------------------------------------------------------------

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyC: 'sneak', ControlLeft: 'sneak', ControlRight: 'sneak',
  ShiftLeft: 'run', ShiftRight: 'run',
};

window.addEventListener('keydown', (e) => {
  wakeAudio();
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (e.code === 'Enter') {
    if (game.state.screen === 'title') startNight();
    else if (game.state.screen === 'caught') respawn();
    else if (game.state.screen === 'leveldone') nextLevel();
    else if (game.state.screen === 'gameover' || game.state.screen === 'win') startNight();
    return;
  }
  const k = KEYMAP[e.code];
  if (k) {
    input[k] = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
});

canvas.addEventListener('mousedown', (e) => {
  wakeAudio();
  if (game.state.screen === 'title') {
    startNight();
    return;
  }
  if (game.state.screen !== 'play') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const tx = (e.clientX - rect.left) * scaleX;
  const ty = (e.clientY - rect.top) * scaleY;
  const landing = throwLure(game.world, game.player, tx, ty);
  if (landing) playCoin();
});

// --- update --------------------------------------------------------------

function update(dt) {
  const st = game.state;
  if (st.screen !== 'play') return;
  st.flash = Math.max(0, st.flash - dt * 1.5);
  game.levelTime += dt;
  st.timeLeft = Math.max(0, LEVELS[game.levelIndex].parTime - Math.floor(game.levelTime));

  // Wren moves; her steps may be heard.
  const stepEvents = updatePlayer(game.world, game.player, input, dt);
  for (const ev of stepEvents) {
    playStep(game.player.moving);
    for (const g of game.guards) hearNoise(g, ev.x, ev.y, ev.radius);
  }

  // A thrown coin landing clinks and pulls nearby guards over.
  const landed = updateLure(game.player, dt);
  if (landed) {
    playCoin();
    for (const g of game.guards) hearNoise(g, landed.x, landed.y, LURE_NOISE);
  }

  // Guards think; their events become sounds and HUD flashes.
  const events = [];
  for (const g of game.guards) updateGuard(game.world, g, game.player, dt, events);
  for (const ev of events) {
    if (ev.type === 'spotted') {
      playSpotted();
      st.hint = 'A guard thinks they saw something…';
    } else if (ev.type === 'alarm') {
      playAlarm();
      st.alarmed = true;
      st.hint = 'ALARM — break line of sight!';
      st.flash = 0.6;
    } else if (ev.type === 'lost') {
      st.hint = 'They lost you — stay hidden';
    }
  }

  // A heartbeat while any guard is hunting Wren.
  if (anyAlert(game.guards)) {
    game.heartbeatTimer -= dt;
    if (game.heartbeatTimer <= 0) {
      playHeartbeat();
      game.heartbeatTimer = 0.9;
    }
  }

  // Caught?
  for (const g of game.guards) {
    if (guardCatchesPlayer(g, game.player)) {
      caught();
      return;
    }
  }

  // Charts: touching a pedestal lifts the chart.
  for (const chart of game.world.charts) {
    if (!chart.taken && Math.hypot(chart.x - game.player.x, chart.y - game.player.y) < 26) {
      chart.taken = true;
      st.chartsTaken += 1;
      st.score += 150;
      playPickup();
      if (st.chartsTaken >= 3) {
        st.hint = 'East door open — go!';
        st.statusLine = 'All 3 charts lifted — reach the east door';
        playUnlock();
      }
    }
  }

  // Exit: the east door, once all charts are lifted.
  const e = game.world.exit;
  if (st.chartsTaken >= 3 && Math.hypot(e.x - game.player.x, e.y - game.player.y) < 26) {
    levelCleared();
    return;
  }

  st.inShadow = isShadowAt(game.world, game.player.x, game.player.y);
  if (st.inShadow && !st.alarmed) {
    st.hint = 'Shadow — hard to spot';
    st.statusLine = 'In shadow: detection fills half as fast';
  }
}

// --- main loop -----------------------------------------------------------

let last = performance.now();
let elapsed = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;
  update(dt);
  drawGame(ctx, game.world, game.guards, game.player, game.state, elapsed);
  if (!SHOT_MODE) requestAnimationFrame(frame);
}

// Boot: build level 1 under the title screen, then either stage a screenshot
// scene and paint exactly one frame, or start the live loop.
loadLevel(0);
game.state.screen = 'title';
if (SHOT_MODE) {
  const note = document.getElementById('note');
  if (note) note.style.display = 'none'; // the shot is the canvas alone
  if (stageShot(game, shotName)) {
    drawGame(ctx, game.world, game.guards, game.player, game.state, SHOT_TIME);
    document.title = `Nightshift — shot ${shotName}`;
  }
} else {
  requestAnimationFrame(frame);
}

// Exposed for the autopilot test harness (window.__nightshift in the browser).
window.__nightshift = game;
