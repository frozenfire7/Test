// Tiny WebAudio synth: no asset files needed.
let ctx, master, musicTimer;
const ac = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function tone(f0, f1, dur, type = 'sine', vol = 0.2, delay = 0) {
  const c = ac(), t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.2, freq = 1500, delay = 0) {
  const c = ac(), t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
}

export const sfx = {
  unlock: () => ac(),
  swing: (heavy) => noise(heavy ? 0.35 : 0.18, 0.18, heavy ? 700 : 1800),
  hit: (heavy) => { tone(heavy ? 120 : 220, 60, 0.18, 'square', 0.18); noise(0.1, 0.2, 3000); },
  hurt: () => { tone(300, 80, 0.3, 'sawtooth', 0.2); },
  dodge: () => noise(0.15, 0.12, 4000),
  flame: () => { noise(0.5, 0.2, 900); tone(200, 500, 0.4, 'triangle', 0.12); },
  frost: () => { tone(1400, 400, 0.5, 'sine', 0.15); tone(1800, 600, 0.5, 'sine', 0.1, 0.05); noise(0.3, 0.1, 6000); },
  arc: () => tone(900, 200, 0.25, 'sawtooth', 0.12),
  potion: () => { tone(500, 900, 0.15, 'sine', 0.15); tone(700, 1200, 0.2, 'sine', 0.12, 0.1); },
  kill: () => { tone(400, 100, 0.3, 'triangle', 0.15); },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.15, i * 0.09)),
  portal: () => { tone(200, 800, 0.8, 'sine', 0.15); tone(300, 1200, 0.8, 'triangle', 0.08); },
  rumble: () => { noise(1.2, 0.3, 120); tone(60, 40, 1.2, 'sawtooth', 0.2); },
  card: () => [392, 523, 659].forEach((f, i) => tone(f, f, 0.5, 'sine', 0.12, i * 0.12)),
};

// gentle pentatonic arp; mood sets root + tempo
export function music(mood) {
  clearInterval(musicTimer);
  if (!mood) return;
  const roots = { hub: 261.6, dungeon: 196, boss: 146.8 };
  const scale = mood === 'hub' ? [0, 2, 4, 7, 9, 12, 9, 7] : [0, 3, 5, 7, 10, 7, 5, 3];
  let i = 0;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    const f = roots[mood] * Math.pow(2, scale[i % scale.length] / 12);
    tone(f, f, 0.7, mood === 'hub' ? 'sine' : 'triangle', 0.045);
    if (i % 8 === 0) tone(roots[mood] / 2, roots[mood] / 2, 2.2, 'sine', 0.06);
    i++;
  }, mood === 'boss' ? 240 : mood === 'hub' ? 330 : 400);
}
