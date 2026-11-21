// All drawing: the night gallery, raycast vision cones, guards, the thief, the HUD and
// every screen. Nothing here changes the world; it only paints the state it is given.
// The playfield is a fixed 1280x720 logical area scaled to the window.

import { COLS, FIELD, FONT, GUARD, PALETTE, ROWS, TILE } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_BRIEF = 1;
export const SCREEN_PLAY = 2;
export const SCREEN_PAUSED = 3;
export const SCREEN_LEVEL_DONE = 4;
export const SCREEN_OVER = 5;
export const SCREEN_VICTORY = 6;

/** Lamp tiles (their warm pools of light); every one is open floor on every level. */
const LAMPS = [[4, 4], [15, 4], [25, 4], [4, 12], [15, 12], [25, 12]];

const CONE_RAYS = 26;
const CONE_STEP = 8;

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function coneColor(guardState, alpha) {
  const rgb = guardState === 2 ? PALETTE.coneAlert : guardState === 1 || guardState === 3 ? PALETTE.coneSuspicious : PALETTE.coneCalm;
  return `rgba(${rgb}, ${alpha})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view = { scale, ox: (canvas.width - FIELD.width * scale) / 2, oy: (canvas.height - FIELD.height * scale) / 2, dpr };
  }

  window.addEventListener('resize', resize);
  resize();

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x: (x - view.ox) / view.scale, y: (y - view.oy) / view.scale };
  }

  function rayEnd(world, gx, gy, angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let dist = 0;
    while (dist < GUARD.viewDist) {
      dist += CONE_STEP;
      if (world.isBlockedPx(gx + dx * dist, gy + dy * dist)) break;
    }
    return [gx + dx * Math.min(dist, GUARD.viewDist), gy + dy * Math.min(dist, GUARD.viewDist)];
  }

  function drawCone(world, guard) {
    const half = GUARD.viewHalfAngle;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= CONE_RAYS; i++) {
      const a = guard.angle - half + (2 * half * i) / CONE_RAYS;
      const [x, y] = rayEnd(world, guard.x, guard.y, a);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, GUARD.viewDist);
    grad.addColorStop(0, coneColor(guard.state, guard.state === 2 ? 0.5 : 0.4));
    grad.addColorStop(1, coneColor(guard.state, 0));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = coneColor(guard.state, 0.25);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawFloor(world, time) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = world.tileAt(c, r);
        const x = c * TILE;
        const y = r * TILE;
        if (t === '#') continue;
        const even = (c + r) % 2 === 0;
        ctx.fillStyle = even ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        if (hash2(c, r) > 0.86) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x, y, TILE, TILE);
        }
        ctx.strokeStyle = PALETTE.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (t === 'd') {
          ctx.fillStyle = 'rgba(8, 12, 28, 0.5)';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(90, 120, 200, 0.16)';
          ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
        }
      }
    }
    // Warm lamp pools.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [lc, lr] of LAMPS) {
      if (world.tileAt(lc, lr) === '#') continue;
      const x = (lc + 0.5) * TILE;
      const y = (lr + 0.5) * TILE;
      const grad = ctx.createRadialGradient(x, y, 8, x, y, 150);
      grad.addColorStop(0, `rgba(${PALETTE.lamp}, 0.14)`);
      grad.addColorStop(1, `rgba(${PALETTE.lamp}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 150, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWallsAndCover(world) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = world.tileAt(c, r);
        const x = c * TILE;
        const y = r * TILE;
        if (t === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallSide;
          ctx.fillRect(x, y + TILE - 5, TILE, 5);
          if (world.tileAt(c, r + 1) !== '#') {
            ctx.fillStyle = PALETTE.wallTop;
            ctx.fillRect(x, y + TILE - 3, TILE, 3);
          }
          if (world.tileAt(c, r - 1) !== '#') {
            ctx.fillStyle = PALETTE.wallTop;
            ctx.fillRect(x, y, TILE, 3);
          }
        } else if (t === 'c') {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x + 3, y + 4, TILE - 4, TILE - 4);
          ctx.fillStyle = PALETTE.coverWood;
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.strokeStyle = PALETTE.coverWoodTop;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4.5, y + 4.5, TILE - 9, TILE - 9);
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 4);
          ctx.lineTo(x + TILE - 4, y + TILE - 4);
          ctx.moveTo(x + TILE - 4, y + 4);
          ctx.lineTo(x + 4, y + TILE - 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  function drawExit(world, time) {
    const { state } = world;
    const ex = state.exit;
    const x = ex.x - TILE / 2;
    const y = ex.y - TILE / 2;
    if (ex.active) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);
      ctx.save();
      ctx.shadowColor = PALETTE.exit;
      ctx.shadowBlur = 18 + pulse * 10;
      ctx.fillStyle = PALETTE.exit;
      ctx.fillRect(x + 6, y + 4, TILE - 12, TILE - 8);
      ctx.restore();
      ctx.fillStyle = PALETTE.exitDark;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', ex.x, y - 6);
    } else {
      ctx.fillStyle = '#3a4157';
      ctx.fillRect(x + 6, y + 4, TILE - 12, TILE - 8);
      ctx.strokeStyle = '#565f7d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 6.5, y + 4.5, TILE - 13, TILE - 9);
      ctx.fillStyle = '#8b93a3';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED', ex.x, y - 6);
    }
  }

  function drawArtifacts(world, time) {
    for (const art of world.state.artifacts) {
      if (art.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(time * 2.4 + art.phase);
      ctx.save();
      ctx.translate(art.x, art.y);
      ctx.shadowColor = PALETTE.artifact;
      ctx.shadowBlur = 16 * pulse;
      ctx.rotate(Math.PI / 4 + Math.sin(time * 1.2 + art.phase) * 0.2);
      ctx.fillStyle = PALETTE.artifact;
      const s = 9 + pulse * 2;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.strokeStyle = `rgba(255, 215, 106, ${0.25 + pulse * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(art.x, art.y, 20 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawLures(world) {
    for (const lure of world.state.luresThrown) {
      const t = lure.age / 1.2;
      ctx.strokeStyle = `rgba(255, 220, 120, ${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lure.x, lure.y, 6 + t * 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(lure.x, lure.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGuards(world) {
    for (const guard of world.state.guards) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(guard.x, guard.y + 10, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body.
      ctx.fillStyle = PALETTE.guardUniform;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Cap brim toward the facing.
      ctx.fillStyle = PALETTE.guardCap;
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.angle) * 5, guard.y + Math.sin(guard.angle) * 5, 7, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick.
      ctx.strokeStyle = PALETTE.guard;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(guard.x + Math.cos(guard.angle) * 10, guard.y + Math.sin(guard.angle) * 10);
      ctx.lineTo(guard.x + Math.cos(guard.angle) * 19, guard.y + Math.sin(guard.angle) * 19);
      ctx.stroke();
      // Detection arc above the head.
      if (guard.detection > 0.02) {
        ctx.strokeStyle = guard.detection >= 1 ? PALETTE.danger : '#ffd66e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, 21, -Math.PI / 2, -Math.PI / 2 + guard.detection * Math.PI * 2);
        ctx.stroke();
      }
      // Alert marks.
      if (guard.state === 2) {
        ctx.fillStyle = PALETTE.danger;
        ctx.font = `bold 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - 26);
      } else if (guard.state === 1 || guard.state === 3) {
        ctx.fillStyle = '#ffd66e';
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - 26);
      }
    }
  }

  function drawPlayer(world) {
    const p = world.state.player;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const r = p.sneaking ? PLAYER_RADIUS_SNEAK : 13;
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Hood toward the facing.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // Sneak ring.
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(140, 220, 180, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSparkles(world) {
    for (const s of world.state.sparkles) {
      ctx.fillStyle = `rgba(255, 215, 106, ${Math.max(0, s.life)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDarkness(world, time) {
    const p = world.state.player;
    const grad = ctx.createRadialGradient(p.x, p.y, 150, p.x, p.y, 720);
    grad.addColorStop(0, 'rgba(4, 6, 14, 0)');
    grad.addColorStop(0.55, 'rgba(4, 6, 14, 0.2)');
    grad.addColorStop(1, 'rgba(4, 6, 14, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Drifting dust motes.
    ctx.fillStyle = 'rgba(220, 230, 255, 0.10)';
    for (let i = 0; i < 40; i++) {
      const x = hash2(i, 7) * FIELD.width + Math.sin(time * 0.12 + i) * 8;
      const y = hash2(i, 21) * FIELD.height + Math.cos(time * 0.09 + i * 2) * 6;
      ctx.fillRect(x, y, 2, 2);
    }
    // Vignette.
    const vg = ctx.createRadialGradient(640, 360, 300, 640, 360, 760);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(world, ui) {
    const s = world.state;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${s.levelIndex + 1} · ${s.levelName}`, 14, 29);
    // Artifacts.
    for (let i = 0; i < s.artifactsTotal; i++) {
      const x = 430 + i * 26;
      const y = 23;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      if (i < s.artifactsGot) {
        ctx.fillStyle = PALETTE.artifact;
        ctx.fillRect(-6, -6, 12, 12);
      } else {
        ctx.strokeStyle = PALETTE.muted;
        ctx.lineWidth = 2;
        ctx.strokeRect(-6, -6, 12, 12);
      }
      ctx.restore();
    }
    // Detection eye: the highest detection among the guards.
    const det = Math.max(0, ...s.guards.map((g) => g.detection));
    const ex = 560;
    ctx.strokeStyle = det > 0.45 ? PALETTE.danger : PALETTE.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ex, 23, 13, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = det > 0.45 ? PALETTE.danger : PALETTE.artifact;
    ctx.beginPath();
    ctx.arc(ex, 23, 3 + det * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(det > 0.45 ? 'SEEN' : det > 0.02 ? 'SUSPECT' : 'HIDDEN', ex + 18, 27);
    // Lures.
    ctx.fillStyle = PALETTE.artifact;
    for (let i = 0; i < s.lures; i++) {
      ctx.beginPath();
      ctx.arc(700 + i * 18, 23, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('LURES', 660, 27);
    // Lives.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < s.lives ? '#ff7d7d' : '#3a4157';
      ctx.beginPath();
      ctx.arc(800 + i * 22, 23, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('LIVES', 762, 27);
    // Timer and score, right aligned.
    const mins = Math.floor(s.elapsed / 60);
    const secs = Math.floor(s.elapsed % 60);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, 1090, 29);
    ctx.fillText(`SCORE ${s.score}`, 1266, 29);
    // Controls hint.
    ctx.fillStyle = 'rgba(238, 241, 245, 0.55)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WASD / arrows move · SHIFT sneak · CTRL run · CLICK throw a lure · P pause · M mute', 640, 706);
    if (ui.muted) {
      ctx.fillStyle = PALETTE.muted;
      ctx.textAlign = 'right';
      ctx.fillText('MUTED', 1266, 690);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(5, 7, 14, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = accent || PALETTE.text;
    ctx.font = `bold 54px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, 640, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `18px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, 640, 350 + i * 30));
  }

  function draw(world, screen, ui) {
    const time = world.state.levelElapsed;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawFloor(world, time);
    drawExit(world, time);
    drawArtifacts(world, time);
    for (const guard of world.state.guards) drawCone(world, guard);
    drawWallsAndCover(world);
    drawLures(world);
    drawGuards(world);
    drawPlayer(world);
    drawSparkles(world);
    drawDarkness(world, time);
    drawHud(world, ui);

    if (ui.banner) {
      ctx.fillStyle = ui.banner.color;
      ctx.font = `bold 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(ui.banner.text, 640, 130);
    }

    if (screen === SCREEN_TITLE) {
      overlay('NIGHTSHIFT', [
        'A stealth heist in three galleries.',
        'Lift the three Star Charts in each gallery, then slip out unseen.',
        'Guards patrol with lanterns of sight — stay out of their cones,',
        'hide in the shadows, and toss a lure to pull them away.',
        '',
        'PRESS SPACE OR CLICK TO BEGIN',
        ui.best > 0 ? `Best score: ${ui.best}` : 'No score yet — make the galleries yours.',
      ], PALETTE.artifact);
    } else if (screen === SCREEN_BRIEF) {
      overlay(world.state.levelName, [
        world.state.levelBrief,
        '',
        `Guards: ${world.state.guards.length} · Star Charts: ${world.state.artifactsTotal}`,
        '',
        'PRESS SPACE TO SLIP IN',
      ], PALETTE.text);
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or Space to keep sneaking.'], PALETTE.text);
    } else if (screen === SCREEN_LEVEL_DONE) {
      overlay('GALLERY CLEARED', [
        `Time bonus + ghost bonus: ${ui.lastBonus} points`,
        `Score: ${world.state.score}`,
        '',
        ui.hasNext ? 'PRESS SPACE FOR THE NEXT GALLERY' : 'PRESS SPACE FOR THE FINAL SCORE',
      ], PALETTE.exit);
    } else if (screen === SCREEN_OVER) {
      overlay('CAUGHT', [
        'The gallery keeps its secrets — this time.',
        `Score: ${world.state.score}   Best: ${ui.best}`,
        '',
        'PRESS SPACE TO TRY AGAIN',
      ], PALETTE.danger);
    } else if (screen === SCREEN_VICTORY) {
      overlay('THE VAULT IS YOURS', [
        'Three galleries, three Star Charts each — and never a sound.',
        `Final score: ${world.state.score}   Time: ${ui.totalTime}`,
        `Best: ${ui.best}`,
        '',
        'PRESS SPACE TO PLAY AGAIN',
      ], PALETTE.artifact);
    }
  }

  return { draw, resize, toField };
}

const PLAYER_RADIUS_SNEAK = 11;
