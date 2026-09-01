/**
 * WAV synthesis utilities shared between Next.js API routes and any other
 * server-side context. Generates 16-bit PCM mono WAV files for test tones.
 *
 * Browser counterparts should NOT import this file — browsers can synthesize
 * tones via Web Audio API instead. This file is intentionally Node-only.
 */

export type TestAudioKind = "440" | "880" | "1000" | "chirp";

export const TEST_AUDIO_KINDS: readonly TestAudioKind[] = ["440", "880", "1000", "chirp"];

const SAMPLE_RATE = 44100;

function buildTone(frequencyHz: number, durationSec: number, amplitude = 0.8): Buffer {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t * 10);
    const release = Math.min(1, (durationSec - t) * 10);
    const envelope = attack * release;
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * amplitude;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

function buildChirp(durationSec: number, amplitude = 0.6): Buffer {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  const f0 = 20;
  const f1 = 20000;
  const k = Math.log(f1 / f0);
  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const ratio = t / durationSec;
    const freq = f0 * Math.exp(k * ratio);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const attack = Math.min(1, t * 5);
    const release = Math.min(1, (durationSec - t) * 5);
    const envelope = attack * release;
    const sample = Math.sin(phase) * envelope * amplitude;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

export function buildTestAudioBuffer(kind: TestAudioKind): Buffer {
  switch (kind) {
    case "440":
      return buildTone(440, 3);
    case "880":
      return buildTone(880, 3);
    case "1000":
      return buildTone(1000, 3);
    case "chirp":
      return buildChirp(5);
  }
}