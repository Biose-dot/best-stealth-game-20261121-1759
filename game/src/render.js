// render.js — everything the player sees, drawn on one canvas.
//
// The look: a night gallery. Warm wooden floor tiles, cold stone walls, dark
// blue shadow pools where Wren is hard to spot, brass crates for cover, gold
// Star Charts glowing on their pedestals, and the guards' amber vision cones
// sweeping the floor — the cone you see is the cone the guard sees with, so
// the screen teaches the rules as you play. No images anywhere: every shape
// is drawn from the level data, which is what makes the screenshots honest
// renders of the game's own code.

import { TILE, COLS, ROWS } from './levels.js';
import { conePolygon } from './vision.js';
import { lurePosition } from './player.js';

const W = COLS * TILE; // 1280
const H = ROWS * TILE; // 720

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx, world) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = world.def.rows[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') continue;
      // Warm gallery wood, alternating tiles like a parquet floor.
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#3a2f24' : '#342a20';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (ch === 'D') {
        // Shadow pool: deep blue dark, with a soft rim so it reads at a glance.
        ctx.fillStyle = 'rgba(16, 28, 64, 0.62)';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(90, 130, 220, 0.35)';
        ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
      }
    }
  }
}

function drawWallsAndCover(ctx, world) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = world.def.rows[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#241d33';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#3a2f52';
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = '#171226';
        ctx.fillRect(x, y + TILE - 5, TILE, 5);
      } else if (ch === 'C') {
        // Brass crate: solid cover, with a lid and rivets.
        ctx.fillStyle = '#6b5322';
        roundRect(ctx, x + 4, y + 4, TILE - 8, TILE - 8, 5);
        ctx.fill();
        ctx.fillStyle = '#8a6d2f';
        ctx.fillRect(x + 4, y + 4, TILE - 8, 8);
        ctx.fillStyle = '#d9b45a';
        ctx.beginPath();
        ctx.arc(x + 10, y + 10, 2, 0, Math.PI * 2);
        ctx.arc(x + TILE - 10, y + 10, 2, 0, Math.PI * 2);
        ctx.arc(x + 10, y + TILE - 10, 2, 0, Math.PI * 2);
        ctx.arc(x + TILE - 10, y + TILE - 10, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawChartsAndExit(ctx, world, state, t) {
  for (const chart of world.charts) {
    if (chart.taken) continue;
    const bob = Math.sin(t * 2 + chart.x) * 3;
    const glow = 0.55 + 0.25 * Math.sin(t * 3 + chart.y);
    const g = ctx.createRadialGradient(chart.x, chart.y + bob, 2, chart.x, chart.y + bob, 42);
    g.addColorStop(0, `rgba(255, 214, 90, ${glow})`);
    g.addColorStop(1, 'rgba(255, 214, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(chart.x, chart.y + bob, 42, 0, Math.PI * 2);
    ctx.fill();
    // Pedestal.
    ctx.fillStyle = '#4a3a28';
    ctx.fillRect(chart.x - 12, chart.y + 8, 24, 12);
    drawStar(ctx, chart.x, chart.y + bob - 4, 13, '#ffd65a');
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // The east exit: a tall door on the east wall, green once unlocked.
  const e = world.exit;
  const open = state.chartsTaken >= 3;
  ctx.fillStyle = open ? '#1f7a4d' : '#5a2e2e';
  roundRect(ctx, e.x - 16, e.y - 34, 32, 68, 6);
  ctx.fill();
  ctx.fillStyle = open ? '#37d67f' : '#c98a8a';
  ctx.fillRect(e.x - 2, e.y - 26, 4, 52);
  ctx.fillStyle = open ? '#baffce' : '#e8c9c9';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', e.x, e.y - 40);
}

function drawGuard(ctx, world, guard, t) {
  // The vision cone first, under the body: amber when calm, red when alert.
  const poly = conePolygon(world, guard);
  const alert = guard.state === 'alert';
  const suspicious = guard.state === 'suspicious' || guard.state === 'search';
  const base = alert
    ? 'rgba(255, 60, 60, 0.34)'
    : suspicious
      ? 'rgba(255, 170, 40, 0.30)'
      : 'rgba(255, 205, 70, 0.22)';
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.fillStyle = base;
  ctx.fill();

  // Body: a night-watchman in a dark uniform, torch in hand.
  ctx.fillStyle = '#1d2733';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alert ? '#ff5a5a' : '#8fa8c8';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick and torch dot.
  ctx.strokeStyle = '#ffd65a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18, 3, 0, Math.PI * 2);
  ctx.fill();

  // Detection meter: a ring that fills as the guard grows sure of Wren.
  if (guard.meter > 0.03) {
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + guard.meter * Math.PI * 2);
    ctx.strokeStyle = guard.meter > 0.6 ? '#ff4d4d' : '#ffb020';
    ctx.lineWidth = 4;
    ctx.stroke();
    if (guard.meter >= 1 || guard.state === 'alert') {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 26);
    } else if (guard.meter > 0.5) {
      ctx.fillStyle = '#ffb020';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 26);
    }
  }
  void t;
}

function drawPlayer(ctx, player, state, t) {
  const lp = lurePosition(player);
  if (lp) {
    ctx.fillStyle = '#ffd65a';
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wren: a hooded figure in teal, with a soft shadow ring while sneaking.
  const inShadow = state.inShadow;
  if (inShadow) {
    ctx.strokeStyle = 'rgba(120, 170, 255, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = player.moving === 'run' ? '#2ec4b6' : '#149a8c';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8fff9';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Hood point and facing tick.
  ctx.fillStyle = '#0b3d38';
  ctx.beginPath();
  ctx.arc(
    player.x + Math.cos(player.facing) * 6,
    player.y + Math.sin(player.facing) * 6,
    5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.strokeStyle = '#e8fff9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.facing) * 16, player.y + Math.sin(player.facing) * 16);
  ctx.stroke();
  void t;
}

function drawHud(ctx, state) {
  // Top bar: level name, charts, lives, lures, timer, score.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(state.levelName, 12, 22);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd65a';
  ctx.fillText(`★ ${state.chartsTaken}/3`, 330, 22);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillText('♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, 3 - state.lives)), 470, 22);
  ctx.fillStyle = '#c9d6ff';
  ctx.fillText(`◉ lure ×${state.lures}`, 620, 22);
  ctx.fillStyle = '#f2ead8';
  ctx.fillText(`⏱ ${state.timeLeft}s`, 800, 22);
  ctx.fillStyle = '#9fe8c9';
  ctx.fillText(`Score ${state.score}`, 960, 22);
  ctx.fillStyle = '#8fa8c8';
  ctx.textAlign = 'right';
  ctx.fillText(state.hint, W - 12, 22);
  ctx.textAlign = 'left';

  // Bottom hint bar.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  ctx.fillRect(0, H - 26, W, 26);
  ctx.fillStyle = '#b9c4d6';
  ctx.font = '13px sans-serif';
  ctx.fillText(
    'WASD / arrows — move    Shift — run (loud)    C — sneak (silent)    Click — throw a lure coin    M — mute',
    12,
    H - 8,
  );
  ctx.textAlign = 'right';
  ctx.fillText(state.statusLine, W - 12, H - 8);
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(5, 7, 14, 0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 60);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 6 + i * 30));
  ctx.textAlign = 'left';
}

// The main draw: world first, then actors, then HUD, then any overlay.
// `state.screen` is one of 'title' | 'play' | 'caught' | 'leveldone' |
// 'gameover' | 'win'. The world is always drawn underneath, so the title
// screen already shows the gallery.
export function drawGame(ctx, world, guards, player, state, t) {
  drawFloor(ctx, world);
  drawChartsAndExit(ctx, world, state, t);
  drawWallsAndCover(ctx, world);
  for (const g of guards) drawGuard(ctx, world, g, t);
  drawPlayer(ctx, player, state, t);
  drawHud(ctx, state);

  if (state.screen === 'title') {
    drawOverlay(ctx, 'NIGHTSHIFT', [
      'Wren steals the Star Charts of three galleries — unseen.',
      'Lift all 3 charts, then slip out the east door.',
      'Shadows slow the guards’ eyes. Coins distract them. Patience wins.',
      'Press ENTER or click to begin',
    ], '#ffd65a');
  } else if (state.screen === 'caught') {
    drawOverlay(ctx, 'CAUGHT!', [
      `A guard grabbed Wren — ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`,
      'Press ENTER to try the gallery again',
    ], '#ff5a5a');
  } else if (state.screen === 'leveldone') {
    drawOverlay(ctx, 'GALLERY CLEARED', [
      `Charts ${state.chartsTaken}/3  •  Ghost bonus ${state.ghostBonus}  •  Time bonus ${state.timeBonus}`,
      `Level score ${state.levelScore}  •  Total ${state.score}`,
      'Press ENTER for the next gallery',
    ], '#37d67f');
  } else if (state.screen === 'gameover') {
    drawOverlay(ctx, 'THE NIGHT ENDS', [
      `Wren was caught three times. Final score ${state.score}.`,
      'Press ENTER to start the night over',
    ], '#ff5a5a');
  } else if (state.screen === 'win') {
    drawOverlay(ctx, 'THE STAR CHARTS ARE YOURS', [
      `All three galleries, unseen. Final score ${state.score}.`,
      'Press ENTER to play the night again',
    ], '#ffd65a');
  }
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${state.flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }
}
