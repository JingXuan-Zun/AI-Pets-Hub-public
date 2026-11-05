import { extractReadySpeechSegments } from '../components/chat/streamingSpeechBoundaryUtils';
import type { VoiceSettings } from '../voice/types';
import { synthesizeGptSovitsWav } from '../voice/ttsGptSovitsPlayback';

// Her voice for a QQ / WeChat message. The voice model reads whole text without splitting it
// (short fragments drop words), and a long reply in one piece loses parts in the middle. So
// the reply is cut where the chat window cuts it when speaking, each piece is synthesized on
// its own, and the pieces are joined into one WAV.

const GAP_MS = 150;

/** The reply in the pieces the chat window speaks one by one. */
export function splitBridgeVoiceText(text: string) {
  const { remaining, segments } = extractReadySpeechSegments(text, { flushAll: true });
  const tail = remaining.trim();
  return tail ? [...segments, tail] : segments;
}

type WavParts = { data: Uint8Array; format: Uint8Array };

function readWav(buffer: ArrayBuffer): WavParts | null {
  const view = new DataView(buffer);
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
  if (buffer.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let format: Uint8Array | null = null;
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    // Some writers leave the data size at 0 or too large when streaming: take what is there.
    const end = Math.min(buffer.byteLength, start + (size || buffer.byteLength));
    if (tag(offset) === 'fmt ') format = new Uint8Array(buffer, start, end - start);
    if (tag(offset) === 'data') return format ? { data: new Uint8Array(buffer, start, end - start), format } : null;
    offset = start + size + (size % 2);
  }
  return null;
}

/** One WAV from several with the same format, a short pause between them. */
export function joinWavs(buffers: ArrayBuffer[]): Uint8Array | null {
  const parts = buffers.map(readWav);
  if (!parts.length || parts.some((part) => !part)) return null;
  const { format } = parts[0]!;
  const formatView = new DataView(format.buffer, format.byteOffset, format.byteLength);
  const bytesPerSecond = formatView.getUint32(8, true);
  const blockAlign = formatView.getUint16(12, true) || 1;
  const gap = Math.floor((bytesPerSecond * GAP_MS) / 1000 / blockAlign) * blockAlign;
  const dataSize = parts.reduce((sum, part, index) => sum + part!.data.length + (index ? gap : 0), 0);
  const out = new Uint8Array(12 + 8 + format.length + 8 + dataSize);
  const view = new DataView(out.buffer);
  const writeTag = (offset: number, value: string) => [...value].forEach((char, index) => { out[offset + index] = char.charCodeAt(0); });
  writeTag(0, 'RIFF');
  view.setUint32(4, out.length - 8, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, format.length, true);
  out.set(format, 20);
  const dataStart = 20 + format.length;
  writeTag(dataStart, 'data');
  view.setUint32(dataStart + 4, dataSize, true);
  let offset = dataStart + 8;
  parts.forEach((part, index) => {
    if (index) offset += gap; // silence: the array is already zeros
    out.set(part!.data, offset);
    offset += part!.data.length;
  });
  return out;
}

/** The whole reply in her voice, as one WAV. */
export async function synthesizeBridgeVoice(text: string, settings: VoiceSettings): Promise<Blob> {
  const pieces = splitBridgeVoiceText(text);
  if (pieces.length <= 1) return synthesizeGptSovitsWav(text, settings);
  const buffers: ArrayBuffer[] = [];
  // One at a time: the voice service runs one generation at once anyway.
  for (const piece of pieces) buffers.push(await (await synthesizeGptSovitsWav(piece, settings)).arrayBuffer());
  const joined = joinWavs(buffers);
  // Pieces that cannot be joined (an unexpected format): the whole reply in one go, as before.
  return joined ? new Blob([joined], { type: 'audio/wav' }) : synthesizeGptSovitsWav(text, settings);
}
