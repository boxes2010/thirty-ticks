// Every sound is synthesised on the spot; there are no audio files.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function tone(freq, length, { type = 'square', volume = 0.05, slide = 0, delay = 0 } = {}) {
    if (!ctx || muted) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  const run = (notes, length, options) => notes.forEach((freq, i) => tone(freq, length, { ...options, delay: i * length * 0.8 }));

  const sounds = {
    tick: (e) => tone(e.left <= 10 ? 1320 : 880, 0.035, { volume: e.left <= 10 ? 0.07 : 0.03 }),
    cursor: () => tone(660, 0.03, { volume: 0.025 }),
    clash: (e) => {
      tone(190, 0.07, { type: 'sawtooth', volume: 0.06, slide: -110 });
      if (e.felled) tone(520, 0.09, { type: 'triangle', volume: 0.05, slide: 300, delay: 0.03 });
    },
    coin: () => run([988, 1319], 0.07, { volume: 0.04 }),
    level: () => run([523, 659, 784, 1047], 0.08, { type: 'triangle', volume: 0.06 }),
    down: () => tone(300, 0.4, { type: 'sawtooth', volume: 0.07, slide: -240 }),
    flee: () => tone(500, 0.15, { volume: 0.03, slide: -250 }),
    fight: (e) => tone(e.boss ? 110 : 220, 0.18, { type: 'sawtooth', volume: 0.06, slide: e.boss ? 60 : 200 }),
    enter: () => run([392, 523], 0.09, { type: 'triangle', volume: 0.05 }),
    leave: () => tone(392, 0.07, { type: 'triangle', volume: 0.04 }),
    talk: () => run([700, 620, 740], 0.04, { volume: 0.025 }),
    buy: () => run([784, 1047], 0.07, { volume: 0.04 }),
    eatery: () => run([523, 698], 0.1, { type: 'triangle', volume: 0.05 }),
    rewind: () => tone(220, 0.5, { type: 'triangle', volume: 0.07, slide: 1500 }),
    deny: () => tone(140, 0.12, { volume: 0.04 }),
    start: () => run([523, 784], 0.1, { volume: 0.04 }),
    cleared: () => run([523, 659, 784, 1047, 1319], 0.13, { type: 'triangle', volume: 0.07 }),
    unwound: () => tone(440, 1.1, { type: 'sawtooth', volume: 0.08, slide: -400 }),
  };

  return {
    // Browsers only allow sound after a key press, so this is called from one.
    unlock() {
      ctx ??= new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
    },
    play(events) {
      for (const e of events) sounds[e.type]?.(e);
    },
  };
}
