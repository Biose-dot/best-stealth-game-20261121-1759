// Procedural sound: every effect is synthesised with WebAudio, so the game ships no
// audio files. The context is created lazily on the first user gesture (browsers block
// audio before that) and every call is safe when it is not ready yet.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || ctx.state === 'suspended') return;
    try {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      amp.gain.setValueAtTime(gain, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(amp).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Soft alternating footsteps; quieter and slower while sneaking. */
    footstep(sneaking) {
      tone(sneaking ? 140 : 95, 0.05, 'triangle', sneaking ? 0.02 : 0.045);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.09, 1320);
      setTimeout(() => tone(1320, 0.18, 'sine', 0.07, 1760), 70);
    },
    /** Two-tone sting when a guard spots the player. */
    alarm() {
      tone(220, 0.16, 'square', 0.05, 330);
      setTimeout(() => tone(330, 0.22, 'square', 0.05, 220), 120);
    },
    suspicious() {
      tone(520, 0.1, 'sine', 0.05, 660);
    },
    caught() {
      tone(160, 0.5, 'sawtooth', 0.08, 60);
    },
    door() {
      tone(440, 0.25, 'sine', 0.07, 660);
      setTimeout(() => tone(660, 0.3, 'sine', 0.06, 880), 140);
    },
    lure() {
      tone(1900, 0.05, 'square', 0.03);
      setTimeout(() => tone(1500, 0.05, 'square', 0.03), 90);
    },
    click() {
      tone(700, 0.05, 'sine', 0.05);
    },
  };
}
