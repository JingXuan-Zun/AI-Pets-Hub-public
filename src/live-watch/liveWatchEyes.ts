import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { isDesktopPetForeground } from '../life-companion/screen-watch/lifeCompanionActivity';
import { pickScreenWatchSource } from '../life-companion/screen-watch/screenWatchCapture';
import { desktopShellRuntimeCaptureSources } from '../life-companion/screen-watch/screenWatchCaptureSources';
import { readableScreenWatchSummary } from '../life-companion/screen-watch/screenWatchLook';
import { summarizeAgentVisualSnapshot } from '../services/agentVisualSnapshotService';
import { createDesktopSourceStream, releaseManagedMediaStream } from '../services/desktopCapture';
import { requestModelFetch } from '../services/modelTransport';
import type { PetConfig } from '../types';
import { resolveOpenAICompatibleVisionModelSettings, resolveVisionModelRequestParams, resolveVisionModelSettings } from '../visionModelSettings';
import {
  buildLookPrompt, changedCells, changeInArea, LIVE_WATCH_LIMITS, motionBox, shouldLook, THUMB_SIZE, watchArea,
  type CellBox, type LiveSeen,
} from './liveWatchRules';

const CHECK_EVERY_MS = 500;
const FIND_VIDEO_CHECKS = 4;
const RECHECK_SOURCE_MS = 5000;
// Readable captions, small enough to answer in about a second.
const LOOK_MAX_SIDE = 1024;
const LOOK_MAX_TOKENS = 4000;
const LOOK_TIMEOUT_MS = 20_000;

// Thinking off made one look 1.5 s instead of 3.9 s (2026-11-20). Not every provider accepts the
// field: after one refusal it is not sent again.
let thinkingFieldRefused = false;

async function lookWithOpenAICompatible(config: PetConfig, imageDataUrl: string, prompt: string) {
  const vision = resolveOpenAICompatibleVisionModelSettings(config.settings);
  const base = (vision.apiUrl ?? '').replace(/\/+$/u, '');
  const url = /chat\/completions$/u.test(base) ? base : `${base}/chat/completions`;
  const send = (withThinkingOff: boolean) => requestModelFetch(url, {
    body: JSON.stringify({
      ...resolveVisionModelRequestParams(config.settings),
      ...(withThinkingOff ? { thinking: { type: 'disabled' } } : {}),
      max_tokens: LOOK_MAX_TOKENS,
      messages: [{ content: [{ text: prompt, type: 'text' }, { image_url: { url: imageDataUrl }, type: 'image_url' }], role: 'user' }],
      model: (vision.modelName ?? '').trim(),
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    signal: AbortSignal.timeout(LOOK_TIMEOUT_MS),
  }, vision.apiKey ?? '', vision.inherited ? 'customApiKey' : 'visionCustomApiKey');
  let response = await send(!thinkingFieldRefused);
  if (!response.ok && !thinkingFieldRefused && response.status >= 400 && response.status < 500) {
    thinkingFieldRefused = true;
    response = await send(false);
  }
  if (!response.ok) throw new Error(`看画面失败（${response.status}）`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const text = body.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text.trim() : '';
}

async function look(config: PetConfig, imageDataUrl: string, previous: string, sourceLabel: string) {
  const prompt = buildLookPrompt(previous);
  const vision = resolveVisionModelSettings(config.settings);
  if (!vision.disabled && vision.provider === 'openai') return lookWithOpenAICompatible(config, imageDataUrl, prompt);
  return readableScreenWatchSummary(await summarizeAgentVisualSnapshot({ imageDataUrl, promptMode: 'desktop', question: prompt, settings: config.settings, sourceLabel }));
}

/**
 * The window the user is watching in. While the pet itself is in front (the user is talking to
 * her) the window being watched is kept; only at the start does that mean the whole screen.
 */
async function pickSource(keepCurrent: boolean) {
  const result = await desktopPetShellRuntime.listRunningApps({ includeWindows: true }) as {
    activeWindow?: { displayId?: string | null; hwnd?: number | null; processName?: string; title?: string } | null;
  };
  const active = result.activeWindow ?? null;
  const petInFront = !active || isDesktopPetForeground(active.processName ?? '', active.title ?? '');
  if (petInFront && keepCurrent) return null;
  const sources = await desktopShellRuntimeCaptureSources();
  return pickScreenWatchSource(sources, petInFront ? { displayId: active?.displayId } : { displayId: active?.displayId, hwnd: active?.hwnd, title: active?.title });
}

export interface LiveWatchEyes { stop: () => void }

/**
 * Eyes: one stream of the window being watched (picked again when the user switches windows),
 * a 48×48 grey thumbnail compared twice a second. The cells that keep changing show where the
 * video is (a window on a big screen, not the whole desktop); change is measured there and the
 * look sees only that part. One look at a time, always of the newest picture.
 */
export async function startLiveWatchEyes(options: {
  clock: () => number;
  config: () => PetConfig;
  onError: (message: string) => void;
  onSeen: (seen: LiveSeen) => void;
}): Promise<LiveWatchEyes | null> {
  let stopped = false;
  let sourceId = '';
  let sourceLabel = '';
  let stream: MediaStream | null = null;
  const video = document.createElement('video');
  video.muted = true;
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = THUMB_SIZE; thumbCanvas.height = THUMB_SIZE;
  const frameCanvas = document.createElement('canvas');

  let recent: Uint8Array[] = [];
  let previousThumb: Uint8Array | null = null;
  let lookedThumb: Uint8Array | null = null;
  const openSource = async () => {
    const source = await pickSource(Boolean(sourceId)).catch(() => null);
    if (!source) return Boolean(sourceId);
    if (source.id === sourceId) return true;
    const next = await createDesktopSourceStream(source.id).catch(() => null);
    if (!next) return false;
    releaseManagedMediaStream(stream);
    stream = next; sourceId = source.id; sourceLabel = source.name || '屏幕';
    recent = []; previousThumb = null; lookedThumb = null; // a new picture: find the video again
    video.srcObject = next;
    await video.play().catch(() => undefined);
    return true;
  };
  if (!(await openSource())) return null;

  const readThumb = () => {
    const context = thumbCanvas.getContext('2d', { willReadFrequently: true });
    if (!context || !video.videoWidth) return null;
    context.drawImage(video, 0, 0, THUMB_SIZE, THUMB_SIZE);
    const pixels = context.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE).data;
    const grey = new Uint8Array(THUMB_SIZE * THUMB_SIZE);
    for (let index = 0; index < grey.length; index += 1) grey[index] = (pixels[index * 4] * 0.299) + (pixels[index * 4 + 1] * 0.587) + (pixels[index * 4 + 2] * 0.114);
    return grey;
  };
  // The look sees only the moving area (the video), cropped from the full-resolution stream.
  const readFrame = (area: CellBox) => {
    const cellWidth = video.videoWidth / THUMB_SIZE; const cellHeight = video.videoHeight / THUMB_SIZE;
    const x = area.left * cellWidth; const y = area.top * cellHeight;
    const width = (area.right - area.left + 1) * cellWidth; const height = (area.bottom - area.top + 1) * cellHeight;
    const scale = Math.min(1, LOOK_MAX_SIDE / Math.max(width, height, 1));
    frameCanvas.width = Math.max(1, Math.round(width * scale));
    frameCanvas.height = Math.max(1, Math.round(height * scale));
    frameCanvas.getContext('2d')?.drawImage(video, x, y, width, height, 0, 0, frameCanvas.width, frameCanvas.height);
    return frameCanvas.toDataURL('image/jpeg', 0.8);
  };

  let lastText = '';
  let lastLookAt = -Infinity;
  let looking = false;
  let failures = 0;
  const check = async () => {
    if (stopped) return;
    const thumb = readThumb();
    if (!thumb) return;
    // Where things move is tracked all the time, also while a look is running.
    if (previousThumb) { recent.push(changedCells(thumb, previousThumb)); if (recent.length > LIVE_WATCH_LIMITS.motionChecks) recent.shift(); }
    previousThumb = thumb;
    if (looking) return;
    // First look only after ~2 s of watching where things move, or it sees the whole desktop.
    if (!lookedThumb && recent.length < FIND_VIDEO_CHECKS) return;
    const now = options.clock();
    const area = watchArea(motionBox(recent));
    const change = lookedThumb ? changeInArea(changedCells(thumb, lookedThumb), area) : Infinity;
    if (!shouldLook(change, now - lastLookAt, LIVE_WATCH_LIMITS)) return;
    looking = true; lastLookAt = now;
    const at = now;
    try {
      const text = await look(options.config(), readFrame(area), lastText, sourceLabel);
      lookedThumb = thumb; failures = 0;
      if (!stopped && text) { lastText = text; options.onSeen({ at, text }); }
    } catch (error) {
      failures += 1;
      if (failures === 3) options.onError(error instanceof Error ? error.message : String(error));
    } finally {
      looking = false;
    }
  };
  const checkTimer = window.setInterval(() => { void check(); }, CHECK_EVERY_MS);
  const sourceTimer = window.setInterval(() => { if (!stopped) void openSource(); }, RECHECK_SOURCE_MS);
  return {
    stop() {
      stopped = true;
      window.clearInterval(checkTimer); window.clearInterval(sourceTimer);
      releaseManagedMediaStream(stream);
      video.srcObject = null;
    },
  };
}
