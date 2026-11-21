// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between title, brief, play, paused, level-done, game-over and
// victory screens.
//
// ?seed=N fixes the guard patrol phases. ?shot=start|play|hide|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_ARTIFACT, EVENT_CAUGHT, EVENT_COMPLETE, EVENT_HEARD, EVENT_SPOTTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_LEVEL_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
/** Seconds a banner ("SPOTTED!", "CAUGHT!") stays on screen. */
const BANNER_SECONDS = 1.6;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = {
    best: 0,
    lastBonus: world.levelBonus(),
    hasNext: true,
    totalTime: formatTime(world.state.elapsed),
    muted: false,
    banner: null,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let bannerUntil = 0;
  let lastBonus = 0;
  let stepCount = 0;
  let lurePoint = null;

  const input = createInput(canvas, (clientX, clientY) => {
    if (screen !== SCREEN_PLAY) {
      // A click anywhere else is a confirm, like Space.
      return;
    }
    const field = renderer.toField(clientX, clientY);
    lurePoint = { x: field.x, y: field.y };
    audio.unlock();
  });
  canvas.addEventListener('pointerdown', () => {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY || screen === SCREEN_LEVEL_DONE || screen === SCREEN_BRIEF) {
      confirm();
    }
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function showBanner(text, color) {
    banner = { text, color };
    bannerUntil = world.state.elapsed + BANNER_SECONDS;
  }

  function startRun() {
    world.reset();
    screen = SCREEN_BRIEF;
    announce(`Nightshift. ${world.state.levelName}. ${world.state.levelBrief}`);
  }

  function startLevel() {
    screen = SCREEN_PLAY;
    announce(`Playing. Level ${world.state.levelIndex + 1}, ${world.state.levelName}.`);
  }

  function endRun(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(victory ? `The vault is yours. Final score ${world.state.score}.` : `Caught. Score ${world.state.score}.`);
  }

  function confirm() {
    audio.unlock();
    audio.click();
    if (screen === SCREEN_TITLE) startRun();
    else if (screen === SCREEN_BRIEF) startLevel();
    else if (screen === SCREEN_LEVEL_DONE) {
      if (world.nextLevel()) screen = SCREEN_BRIEF;
      else endRun(true);
    } else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) startRun();
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.toggleMute();
    }
    if (actions & ACTION_CONFIRM) confirm();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function react(events) {
    if (events & EVENT_ARTIFACT) {
      audio.pickup();
      announce(`Star Chart ${world.state.artifactsGot} of ${world.state.artifactsTotal}.`);
    }
    if (events & EVENT_SPOTTED) {
      audio.suspicious();
      showBanner('SUSPICIOUS…', '#ffd66e');
    }
    if (events & EVENT_ALARM) {
      audio.alarm();
      showBanner('SPOTTED!', '#ff5f5f');
      announce('Spotted! Break line of sight!');
    }
    if (events & EVENT_HEARD) {
      showBanner('THEY HEARD THAT…', '#ffd66e');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      world.state.lives -= 1;
      if (world.state.lives <= 0) {
        endRun(false);
      } else {
        showBanner('CAUGHT!', '#ff5f5f');
        announce(`Caught. ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
        world.loadLevel(world.state.levelIndex);
        screen = SCREEN_BRIEF;
      }
    }
    if (events & EVENT_COMPLETE) {
      audio.door();
      lastBonus = world.applyLevelBonus();
      screen = SCREEN_LEVEL_DONE;
      announce(`Gallery cleared. Bonus ${lastBonus}. Score ${world.state.score}.`);
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const lure = lurePoint;
    lurePoint = null;
    if (lure !== null) audio.lure();
    const events = world.step(STEP, move, input.sneak(), input.run(), lure, false);
    stepCount += 1;
    // Footsteps every few steps while moving.
    if (world.state.player.moving && stepCount % (input.sneak() ? 26 : 15) === 0) {
      audio.footstep(input.sneak());
    }
    react(events);
    if (banner !== null && world.state.elapsed > bannerUntil) banner = null;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_BRIEF) {
      // The title and brief screens idle over a live, harmless gallery.
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_BRIEF)) {
        world.step(STEP, { x: 0, y: 0 }, false, false, null, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, {
      best,
      lastBonus,
      hasNext: world.state.levelIndex + 1 < 3,
      totalTime: formatTime(world.state.elapsed),
      muted: audio.isMuted(),
      banner,
    });
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nightshift. Press Space or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
