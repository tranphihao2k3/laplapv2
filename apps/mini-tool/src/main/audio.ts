import { promises as fs } from "node:fs";
import path from "node:path";

export interface AudioFileInfo {
  id: string;        // stable id (filename without ext)
  title: string;     // display name (filename without ext, prettified)
  fileName: string;  // e.g. "tone-440.wav"
  path: string;      // absolute path on disk
  url: string;       // lap-audio://<encoded-name>
  mime: string;
  sizeBytes: number;
  durationSec: number | null;
  source: "builtin" | "user";
}

/**
 * Generate a 16-bit PCM mono WAV file buffer for a sine tone.
 */
function buildToneWav(
  frequencyHz: number,
  durationSec: number,
  sampleRate = 44100,
  amplitude = 0.8,
): Buffer {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t * 10);
    const release = Math.min(1, (durationSec - t) * 10);
    const envelope = attack * release;
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * amplitude;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

/**
 * Generate a logarithmic chirp from 20Hz → 20kHz.
 */
function buildChirpWav(
  durationSec: number,
  sampleRate = 44100,
  amplitude = 0.6,
): Buffer {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  const f0 = 20;
  const f1 = 20000;
  const k = Math.log(f1 / f0);
  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const ratio = t / durationSec;
    const freq = f0 * Math.exp(k * ratio);
    phase += (2 * Math.PI * freq) / sampleRate;
    const attack = Math.min(1, t * 5);
    const release = Math.min(1, (durationSec - t) * 5);
    const envelope = attack * release;
    const sample = Math.sin(phase) * envelope * amplitude;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

export const BUILTIN_AUDIO: Array<{
  fileName: string;
  title: string;
  durationSec: number;
  build: () => Buffer;
}> = [
  {
    fileName: "tone-440hz.wav",
    title: "Test Tone 440 Hz",
    durationSec: 3,
    build: () => buildToneWav(440, 3),
  },
  {
    fileName: "tone-880hz.wav",
    title: "Test Tone 880 Hz",
    durationSec: 3,
    build: () => buildToneWav(880, 3),
  },
  {
    fileName: "chirp-20hz-20khz.wav",
    title: "Chirp 20 Hz → 20 kHz",
    durationSec: 5,
    build: () => buildChirpWav(5),
  },
  {
    fileName: "tone-1khz.wav",
    title: "Test Tone 1 kHz",
    durationSec: 3,
    build: () => buildToneWav(1000, 3),
  },
];

const SUPPORTED_EXT = new Set([".wav", ".mp3", ".ogg", ".m4a", ".flac"]);

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".wav") return "audio/wav";
  if (e === ".mp3") return "audio/mpeg";
  if (e === ".ogg") return "audio/ogg";
  if (e === ".m4a") return "audio/mp4";
  if (e === ".flac") return "audio/flac";
  return "application/octet-stream";
}

function prettifyTitle(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Make sure the audio directory exists and all built-in test files are present.
 * Idempotent — safe to call on every app start.
 */
export async function ensureTestAudioDir(userDataDir: string): Promise<string> {
  const dir = path.join(userDataDir, "audio");
  await fs.mkdir(dir, { recursive: true });
  for (const item of BUILTIN_AUDIO) {
    const full = path.join(dir, item.fileName);
    try {
      await fs.access(full);
    } catch {
      await fs.writeFile(full, item.build());
    }
  }
  return dir;
}

export interface ListAudioOptions {
  builtinFileNames: ReadonlySet<string>;
}

export async function listAudioFiles(
  dir: string,
  options: ListAudioOptions,
): Promise<AudioFileInfo[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: AudioFileInfo[] = [];
  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!SUPPORTED_EXT.has(ext)) continue;
    const full = path.join(dir, name);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const id = name.replace(/\.[^.]+$/, "");
    out.push({
      id,
      title: prettifyTitle(name),
      fileName: name,
      path: full,
      url: `lap-audio:///${encodeURIComponent(name)}`,
      mime: mimeFromExt(ext),
      sizeBytes: stat.size,
      durationSec: null,
      source: options.builtinFileNames.has(name) ? "builtin" : "user",
    });
  }
  out.sort((a, b) => {
    if (a.source !== b.source) return a.source === "builtin" ? -1 : 1;
    return a.fileName.localeCompare(b.fileName, "en", { numeric: true });
  });
  return out;
}

/**
 * Resolve a custom-protocol request back to a real path inside the audio dir.
 * Returns null if the path escapes the dir (security).
 */
export async function resolveAudioPath(
  audioDir: string,
  urlPath: string,
): Promise<string | null> {
  // urlPath looks like "/tone-440hz.wav" (URL-decoded already)
  const decoded = decodeURIComponent(urlPath.replace(/^\/+/, ""));
  if (!decoded) return null;
  const full = path.join(audioDir, decoded);
  const normalized = path.normalize(full);
  const dirNorm = path.normalize(audioDir + path.sep);
  if (!normalized.startsWith(dirNorm) && normalized !== audioDir) {
    return null;
  }
  const ext = path.extname(normalized).toLowerCase();
  if (!SUPPORTED_EXT.has(ext)) return null;
  try {
    const stat = await fs.stat(normalized);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }
  return normalized;
}
