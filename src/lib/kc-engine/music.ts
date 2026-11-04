// NOVACUT Studio - Sintesis 20 trek backsound bebas hak cipta (Web Audio API)
// Semua trek digenerate prosedural -> 100% orisinal & bebas hak cipta.

import { MUSIC_LIBRARY, type MusicDef } from "./constants";

const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function degreeToMidi(root: number, scale: number[], deg: number): number {
  const oct = Math.floor(deg / scale.length);
  const idx = ((deg % scale.length) + scale.length) % scale.length;
  return root + scale[idx] + oct * 12;
}

// ---------- Instrumen ----------
function noiseBuffer(ctx: BaseAudioContext, dur = 1): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function kick(ctx: BaseAudioContext, t: number, out: AudioNode, gain = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.32);
}

function boom(ctx: BaseAudioContext, t: number, out: AudioNode, gain = 0.9) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(80, t);
  o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.5);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.5);
  const ng = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  ng.gain.setValueAtTime(gain * 0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  n.connect(f).connect(ng).connect(out);
  n.start(t);
}

function snare(ctx: BaseAudioContext, t: number, out: AudioNode, gain = 0.5) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.25);
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1700;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(190, t);
  og.gain.setValueAtTime(gain * 0.6, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.12);
}

function clap(ctx: BaseAudioContext, t: number, out: AudioNode, gain = 0.4) {
  for (let i = 0; i < 3; i++) {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, 0.15);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1400;
    const g = ctx.createGain();
    const tt = t + i * 0.012;
    g.gain.setValueAtTime(gain * (1 - i * 0.25), tt);
    g.gain.exponentialRampToValueAtTime(0.001, tt + 0.12);
    n.connect(f).connect(g).connect(out);
    n.start(tt);
  }
}

function hat(ctx: BaseAudioContext, t: number, out: AudioNode, gain = 0.18, open = false) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, open ? 0.3 : 0.06);
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 8200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.25 : 0.045));
  n.connect(f).connect(g).connect(out);
  n.start(t);
}

function tom(ctx: BaseAudioContext, t: number, out: AudioNode, freq: number, gain = 0.5) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.25);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.32);
}

function crash(ctx: BaseAudioContext, t: number, out: AudioNode, gain = 0.3) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 1.2);
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 5200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  n.connect(f).connect(g).connect(out);
  n.start(t);
}

function riser(ctx: BaseAudioContext, t: number, dur: number, out: AudioNode, gain = 0.25) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, dur);
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(6000, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + dur);
}

function bassNote(ctx: BaseAudioContext, t: number, dur: number, freq: number, out: AudioNode, style: string, gain = 0.5) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  if (style === "sub") {
    o.type = "sine";
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.001, t + dur);
  } else if (style === "saw") {
    o.type = "sawtooth";
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + dur * 0.9);
    g.gain.setValueAtTime(gain * 0.55, t);
    g.gain.setValueAtTime(gain * 0.5, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.001, t + dur);
  } else {
    // pluck
    o.type = "triangle";
    f.type = "lowpass";
    f.frequency.value = 1200;
    g.gain.setValueAtTime(gain * 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, 0.35));
  }
  o.frequency.value = freq;
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function pluck(ctx: BaseAudioContext, t: number, freq: number, out: AudioNode, gain = 0.22, pan = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  let node: AudioNode = g;
  if (pan !== 0 && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    node = p;
  }
  o.connect(g);
  node.connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

function padChord(ctx: BaseAudioContext, t: number, dur: number, midis: number[], out: AudioNode, gain = 0.09) {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.setValueAtTime(gain, t + dur * 0.75);
  g.gain.linearRampToValueAtTime(0.001, t + dur);
  f.connect(g).connect(out);
  for (const m of midis) {
    for (const det of [-6, 5]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = midiToFreq(m);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
}

function stab(ctx: BaseAudioContext, t: number, midis: number[], out: AudioNode, gain = 0.16) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 2400;
  f.connect(g).connect(out);
  for (const m of midis) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = midiToFreq(m);
    o.connect(f);
    o.start(t);
    o.stop(t + 0.25);
  }
}

// ---------- Pola drum ----------
function drumPattern(ctx: BaseAudioContext, def: MusicDef, bar: number, barT: number, beat: number, out: AudioNode, intensity: number) {
  const S = 4; // subdivide per beat (16th)
  const st = (i: number) => barT + (i * beat) / S;
  const d = def.drums;
  const v = intensity;
  if (d === "four") {
    for (let i = 0; i < 16; i += 4) kick(ctx, st(i), out, 0.85 * v);
    for (let i = 2; i < 16; i += 4) hat(ctx, st(i), out, 0.16 * v);
    clap(ctx, st(4), out, 0.32 * v);
    clap(ctx, st(12), out, 0.32 * v);
    if (bar % 4 === 3) hat(ctx, st(14), out, 0.16 * v, true);
  } else if (d === "epic") {
    kick(ctx, st(0), out, v);
    kick(ctx, st(8), out, 0.9 * v);
    if (bar % 2 === 1) tom(ctx, st(11), out, 110, 0.5 * v);
    if (bar % 4 === 0) crash(ctx, st(0), out, 0.28 * v);
    if (bar % 4 === 3) {
      for (let i = 8; i < 16; i++) snare(ctx, st(i), out, 0.12 * v + (i - 8) * 0.03 * v);
      boom(ctx, barT + beat * 4 - 0.05, out, 0.8 * v);
    }
    if (bar === 0) boom(ctx, st(0), out, v);
  } else if (d === "march") {
    if (bar % 2 === 0) {
      tom(ctx, st(0), out, 96, 0.5 * v);
      tom(ctx, st(4), out, 96, 0.42 * v);
      tom(ctx, st(10), out, 80, 0.42 * v);
    } else {
      tom(ctx, st(0), out, 84, 0.5 * v);
      snare(ctx, st(8), out, 0.3 * v);
      tom(ctx, st(12), out, 72, 0.4 * v);
    }
    if (bar % 8 === 7) for (let i = 12; i < 16; i++) snare(ctx, st(i), out, 0.1 * v + (i - 12) * 0.05);
  } else if (d === "drive") {
    for (let i = 0; i < 16; i += 2) kick(ctx, st(i), out, i % 4 === 0 ? 0.8 * v : 0.45 * v);
    snare(ctx, st(4), out, 0.4 * v);
    snare(ctx, st(12), out, 0.4 * v);
    for (let i = 2; i < 16; i += 4) hat(ctx, st(i), out, 0.14 * v);
  } else if (d === "trap") {
    kick(ctx, st(0), out, 0.9 * v);
    kick(ctx, st(7), out, 0.7 * v);
    kick(ctx, st(10), out, 0.75 * v);
    snare(ctx, st(8), out, 0.4 * v);
    for (let i = 0; i < 16; i++) {
      if (i === 12 || i === 13) {
        hat(ctx, st(i), out, 0.1 * v);
        hat(ctx, st(i) + beat / 32, out, 0.08 * v);
      } else if (i % 2 === 0) hat(ctx, st(i), out, 0.12 * v);
    }
  } else if (d === "boombap") {
    kick(ctx, st(0), out, 0.85 * v);
    kick(ctx, st(10), out, 0.6 * v);
    snare(ctx, st(4), out, 0.45 * v);
    snare(ctx, st(12), out, 0.45 * v);
    for (let i = 2; i < 16; i += 4) hat(ctx, st(i), out, 0.15 * v);
  } else if (d === "rock") {
    kick(ctx, st(0), out, 0.9 * v);
    kick(ctx, st(6), out, 0.6 * v);
    kick(ctx, st(8), out, 0.85 * v);
    snare(ctx, st(4), out, 0.5 * v);
    snare(ctx, st(12), out, 0.5 * v);
    for (let i = 0; i < 16; i += 2) hat(ctx, st(i), out, 0.17 * v);
    if (bar % 4 === 3) crash(ctx, st(14), out, 0.25 * v);
  } else if (d === "breaks") {
    kick(ctx, st(0), out, 0.85 * v);
    kick(ctx, st(9), out, 0.55 * v);
    snare(ctx, st(4), out, 0.42 * v);
    snare(ctx, st(11), out, 0.3 * v);
    snare(ctx, st(14), out, 0.35 * v);
    for (let i = 2; i < 16; i += 2) hat(ctx, st(i), out, 0.13 * v);
  } else if (d === "lofi") {
    kick(ctx, st(0), out, 0.7 * v);
    kick(ctx, st(9), out, 0.5 * v);
    snare(ctx, st(4), out, 0.3 * v);
    snare(ctx, st(12), out, 0.3 * v);
    for (let i = 2; i < 16; i += 4) hat(ctx, st(i), out, 0.1 * v);
  } else if (d === "tick") {
    hat(ctx, st(0), out, 0.14 * v);
    hat(ctx, st(8), out, 0.1 * v);
    if (bar % 4 === 3) boom(ctx, st(12), out, 0.4 * v);
  }
}

// ---------- Render utama ----------
export async function renderMusicTrack(def: MusicDef): Promise<AudioBuffer> {
  const beat = 60 / def.bpm;
  const barDur = beat * 4;
  const total = def.bars * barDur + 1.2;
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * total), sr);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  const drumBus = ctx.createGain();
  drumBus.gain.value = 0.9;
  drumBus.connect(master);
  const musicBus = ctx.createGain();
  musicBus.gain.value = 1;
  musicBus.connect(master);

  const scale = SCALES[def.scale];
  // vinyl noise untuk lofi
  if (def.drums === "lofi") {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, total);
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.value = 0.014;
    n.connect(f).connect(g).connect(master);
    n.start(0);
  }

  for (let bar = 0; bar < def.bars; bar++) {
    const barT = bar * barDur;
    const chordDeg = def.chords[bar % def.chords.length];
    const intensity = Math.min(1, 0.55 + (bar / def.bars) * 0.6);
    const triad = [degreeToMidi(def.root, scale, chordDeg), degreeToMidi(def.root, scale, chordDeg + 2), degreeToMidi(def.root, scale, chordDeg + 4)];
    if (def.seventh) triad.push(degreeToMidi(def.root, scale, chordDeg + 6));

    if (def.drums !== "none") drumPattern(ctx, def, bar, barT, beat, drumBus, bar < 1 ? 0.7 : intensity);

    // Bass
    if (def.bass !== "none") {
      const rootMidi = degreeToMidi(def.root, scale, chordDeg) - 24;
      if (def.drums === "trap") {
        bassNote(ctx, barT, barDur, midiToFreq(rootMidi), musicBus, "sub", 0.55);
        bassNote(ctx, barT + beat * 2.5, beat * 1.2, midiToFreq(rootMidi + 3), musicBus, "sub", 0.45);
      } else if (def.bass === "saw") {
        for (let i = 0; i < 16; i += 2) bassNote(ctx, barT + (i * beat) / 4, beat / 2.2, midiToFreq(rootMidi), musicBus, "saw", 0.4 * intensity);
      } else if (def.bass === "pluck") {
        bassNote(ctx, barT, beat * 1.4, midiToFreq(rootMidi), musicBus, "pluck", 0.5);
        bassNote(ctx, barT + beat * 2.5, beat * 1.2, midiToFreq(rootMidi), musicBus, "pluck", 0.42);
      } else {
        bassNote(ctx, barT, barDur, midiToFreq(rootMidi), musicBus, "sub", 0.5);
      }
    }

    // Pad
    if (def.pad) padChord(ctx, barT, barDur * 1.02, triad.map((m) => m + 12), musicBus, 0.07);

    // Arp
    if (def.arp !== "none") {
      const steps = def.bpm >= 120 ? 8 : 4;
      for (let i = 0; i < steps; i++) {
        let deg = chordDeg + (i % 3) * 2;
        if (def.arp === "down") deg = chordDeg + ((steps - 1 - i) % 3) * 2;
        if (def.arp === "updown") deg = chordDeg + (i < steps / 2 ? (i % 3) * 2 : ((steps - i) % 3) * 2);
        const midi = degreeToMidi(def.root, scale, deg) + 24;
        pluck(ctx, barT + (i * barDur) / steps, midiToFreq(midi), musicBus, 0.13 * intensity, i % 2 === 0 ? -0.25 : 0.25);
      }
    }

    // Instrumen khusus
    if (def.id === "piano-drama") {
      const seq = [0, 2, 1, 2];
      for (let i = 0; i < 4; i++) {
        const m = degreeToMidi(def.root, scale, chordDeg + seq[i]) + 12;
        pluck(ctx, barT + i * beat, midiToFreq(m), musicBus, 0.24);
        pluck(ctx, barT + i * beat, midiToFreq(m + 7), musicBus, 0.14);
      }
    }
    if (def.id === "orchestral" && bar % 2 === 1) stab(ctx, barT + beat * 2, triad.map((m) => m + 12), musicBus, 0.14);
    if (def.id === "blockbuster-action" && bar % 2 === 0) stab(ctx, barT, triad.map((m) => m + 12), musicBus, 0.16);
    if (def.id === "sport" && bar % 2 === 1) stab(ctx, barT + beat * 3, triad.map((m) => m + 12), musicBus, 0.15);
    if (def.id === "edm" && bar === def.bars - 8) riser(ctx, barT, barDur * 8, musicBus, 0.2);
    if (def.id === "cinematic-rise" && bar >= def.bars - 4) riser(ctx, barT, barDur * (def.bars - bar), musicBus, 0.16);
    if (def.id === "funk" && bar % 2 === 0) stab(ctx, barT + beat * 1.5, triad.map((m) => m + 12), musicBus, 0.12);
    if (def.id === "tropical" && bar % 4 === 2) pluck(ctx, barT + beat * 3.5, midiToFreq(def.root + 36), musicBus, 0.14);
    if (def.id === "hiphop" && bar % 4 === 3) pluck(ctx, barT + beat * 2, midiToFreq(degreeToMidi(def.root, scale, chordDeg + 2) + 12), musicBus, 0.16);
  }

  return ctx.startRendering();
}

const bufferCache = new Map<string, AudioBuffer>();

export async function getMusicBuffer(def: MusicDef): Promise<AudioBuffer> {
  const cached = bufferCache.get(def.id);
  if (cached) return cached;
  const buf = await renderMusicTrack(def);
  bufferCache.set(def.id, buf);
  return buf;
}

export function musicDefById(id: string): MusicDef | undefined {
  return MUSIC_LIBRARY.find((m) => m.id === id);
}
