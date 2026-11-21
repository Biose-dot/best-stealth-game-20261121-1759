// audio.js — every sound in Nightshift is made, not played.
//
// No audio files ship with the game: a tiny WebAudio synth builds each sound
// from oscillators and filtered noise at run time. The browser needs one user
// gesture before audio starts, so the synth wakes up on the first key press
// or click and stays silent until then — the game never blocks on sound.
//
//   step    a soft filtered-noise tap, lower when sneaking, louder running
//   coin    a bright two-tone clink when a lure lands
//   pickup  a rising chime when a Star Chart is lifted
//   spotted a short tense sting when a guard's meter crosses halfway
//   alarm   a two-note siren swell when a guard goes alert
//   caught  a low thud when a guard grabs Wren
//   win     a little major arpeggio at the end of a level
//   unlock  the east door sliding open once the third chart is lifted

let ctx = null;
let master = null;
let muted = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

export function wakeAudio() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  const c = ensureCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, filterFreq, vol, when = 0) {
  const c = ensureCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
}

// A footstep: quieter and lower while sneaking, a thud while running.
export function playStep(mode) {
  if (mode === 'sneak') return;
  noiseBurst(0.07, mode === 'run' ? 900 : 500, mode === 'run' ? 0.22 : 0.1);
}

// The lure's clink: two bright pings a fifth apart.
export function playCoin() {
  tone(2093, 0.16, 'sine', 0.22);
  tone(3136, 0.2, 'sine', 0.14, 0.05);
}

// A chart lifted: a quick rising chime.
export function playPickup() {
  tone(523, 0.12, 'triangle', 0.22);
  tone(659, 0.12, 'triangle', 0.22, 0.07);
  tone(784, 0.22, 'triangle', 0.26, 0.14);
}

// Half-spotted: one tense low string note.
export function playSpotted() {
  tone(220, 0.35, 'sawtooth', 0.12, 0, 196);
}

// Full alarm: a two-note siren swell, twice.
export function playAlarm() {
  tone(440, 0.3, 'square', 0.1, 0, 587);
  tone(587, 0.3, 'square', 0.1, 0.32, 440);
  tone(440, 0.3, 'square', 0.08, 0.64, 587);
}

// Caught: a low thud and a falling note.
export function playCaught() {
  noiseBurst(0.18, 300, 0.4);
  tone(160, 0.5, 'sine', 0.3, 0.02, 55);
}

// Level cleared: a small major arpeggio.
export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, i * 0.11));
}

// The east door slides open: a soft mechanical sweep.
export function playUnlock() {
  noiseBurst(0.4, 1200, 0.12);
  tone(330, 0.4, 'sine', 0.1, 0.05, 660);
}

// A faint heartbeat while any guard is alert, called once a second.
export function playHeartbeat() {
  tone(70, 0.12, 'sine', 0.35);
  tone(65, 0.14, 'sine', 0.3, 0.16);
}
