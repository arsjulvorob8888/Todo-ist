let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

function ac() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  if (!enabled) return;
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playTap() {
  tone(640, 0.05, "sine", 0.04);
}

export function playStart() {
  tone(392, 0.09, "triangle", 0.05);
  tone(587, 0.12, "triangle", 0.045, 0.07);
}

export function playStop() {
  tone(349, 0.08, "sine", 0.04);
  tone(262, 0.12, "sine", 0.035, 0.06);
}

export function playWin() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, "sine", 0.06, i * 0.08));
}

export function playXp() {
  tone(880, 0.07, "triangle", 0.04);
  tone(1174, 0.12, "triangle", 0.04, 0.06);
}

export function playBell() {
  tone(784, 0.45, "sine", 0.07);
  tone(1174, 0.55, "triangle", 0.035, 0.02);
}

export function playLevel() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, "sine", 0.06, i * 0.09));
}
