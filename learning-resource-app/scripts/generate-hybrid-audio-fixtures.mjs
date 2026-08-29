// Deterministic synthetic stress audio. No recording/network/user documents.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "embedding-runtime/package.json"));
const base = path.join(root, "test-fixtures/scholarflow/06_mindmap_audio/11_audio_quality");
const dir = path.join(base, "hybrid");
await mkdir(dir, { recursive: true });
const RATE = 16000;
let seed = 102938475;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; }
function noise(seconds, gain = 0.12) { return Float32Array.from({ length: seconds * RATE }, () => random() * gain); }
function decode(name) {
  const result = spawnSync(require("ffmpeg-static"), ["-v", "error", "-i", path.join(base, name), "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"], { windowsHide: true, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Unable to decode fixture ${name}`);
  return new Float32Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.length / 4).slice();
}
function concat(...pieces) { const output = new Float32Array(pieces.reduce((sum, piece) => sum + piece.length, 0)); let offset = 0; for (const piece of pieces) { output.set(piece, offset); offset += piece.length; } return output; }
async function save(name, samples, reference, type, description) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  await writeFile(path.join(dir, name), wav);
  return { name: `hybrid/${name}`, reference, type, description, seconds: samples.length / RATE };
}
const rows = [];
rows.push(await save("white.wav", noise(5), null, "non-speech", "Seeded white noise; no speech"));
let brown = 0;
rows.push(await save("brown.wav", Float32Array.from({ length: 5 * RATE }, () => { brown = (brown + random() * 0.02) * 0.995; return brown; }), null, "non-speech", "Low-frequency noise; no speech"));
rows.push(await save("tone.wav", Float32Array.from({ length: 5 * RATE }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 440 * i / RATE)), null, "non-speech", "440 Hz sine tone; no speech"));
rows.push(await save("chords.wav", Float32Array.from({ length: 8 * RATE }, (_, i) => {
  const t = i / RATE; const group = Math.floor(t / 2); const notes = [[261.63, 329.63, 392], [293.66, 349.23, 440], [220, 261.63, 329.63], [196, 246.94, 293.66]][group];
  const envelope = Math.min(1, (t % 2) * 15, (2 - t % 2) * 15);
  return envelope * notes.reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t) * 0.1, 0);
}), null, "non-speech", "Synthetic changing chords; not representative of all real music"));
rows.push(await save("clicks.wav", Float32Array.from({ length: 5 * RATE }, (_, i) => i % 8000 < 160 ? random() * 0.4 : 0), null, "non-speech", "Short noise bursts every half-second"));
const vi = decode("short-vi.mp3");
const reference = "Tìm tài liệu về cơ sở dữ liệu";
rows.push(await save("quiet-vi.wav", vi.map(sample => sample * 0.05), reference, "speech", "Vietnamese TTS attenuated 26 dB"));
const rms = Math.sqrt(vi.reduce((sum, x) => sum + x * x, 0) / vi.length);
rows.push(await save("noisy-vi.wav", vi.map(sample => sample + random() * rms * Math.sqrt(3) / Math.sqrt(10)), reference, "speech", "Vietnamese TTS plus white noise approximately 10 dB SNR"));
rows.push(await save("padded-vi.wav", concat(noise(4), vi, noise(32)), reference, "speech", "4 seconds noise + Vietnamese speech + 32 seconds noise; should not transcribe noise-only tail"));
rows.push(await save("switch-en-vi.wav", concat(decode("en-female-1.mp3"), new Float32Array(RATE), decode("female-2.mp3"), new Float32Array(RATE), decode("en-male-2.mp3")), "computer science Tìm tài liệu về cơ sở dữ liệu database", "mixed", "Short English/Vietnamese/English switches; stress case, not guaranteed supported"));
await writeFile(path.join(dir, "expected.json"), JSON.stringify({ seed: 102938475, generator: "scripts/generate-hybrid-audio-fixtures.mjs", note: "Synthetic signals and existing TTS only; no real microphone audio", cases: rows }, null, 2));
console.log(`Saved ${rows.length} stress fixtures in ${dir}`);
