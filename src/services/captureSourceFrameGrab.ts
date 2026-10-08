import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { createDesktopSourceStream, releaseManagedMediaStream } from './desktopCapture';

// Default long side of the image sent for recognition: small text stays readable, the request stays modest.
const DEFAULT_MAX_FRAME_SIDE = 2000;
const JPEG_QUALITY = 0.85;
const GRAB_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => { globalThis.setTimeout(() => reject(new Error('截取画面超时')), ms); }),
  ]);
}

// Once getUserMedia fails to start a desktop source (always the case while running as
// administrator), later grabs go straight to the main-process still instead of retrying.
let streamCaptureUnavailable = false;

export interface CaptureSourceSize {
  height: number;
  width: number;
}

/** The still's size: the source's own pixels, shrunk to the cap but never enlarged. */
export function resolveCaptureStillSize(maxSide: number, nativeSize?: CaptureSourceSize | null) {
  const width = Number(nativeSize?.width); const height = Number(nativeSize?.height);
  if (!(width > 0) || !(height > 0)) return { height: maxSide, width: maxSide };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { height: Math.max(1, Math.round(height * scale)), width: Math.max(1, Math.round(width * scale)) };
}

async function grabCaptureSourceStill(sourceId: string, maxSide: number, nativeSize?: CaptureSourceSize | null) {
  const size = resolveCaptureStillSize(maxSide, nativeSize);
  const still = await desktopPetShellRuntime.captureSourceImage({ height: size.height, maxSide, sourceId, width: size.width });
  if (!still.ok || !still.imageDataUrl) throw new Error(`截取画面失败：${still.reason ?? 'unknown'}`);
  return { height: still.height ?? 0, imageDataUrl: still.imageDataUrl, width: still.width ?? 0 };
}

/**
 * One full-resolution frame of a capture source (window or screen). The source list's
 * thumbnails are only ~200px wide, far too small to read anything on screen.
 * `nativeSize` (the source's real pixel size) keeps the main-process still from being enlarged.
 */
export async function grabCaptureSourceFrame(
  sourceId: string,
  options: { maxSide?: number; nativeSize?: CaptureSourceSize | null } = {},
) {
  const maxSide = options.maxSide ?? DEFAULT_MAX_FRAME_SIDE;
  if (streamCaptureUnavailable) return grabCaptureSourceStill(sourceId, maxSide, options.nativeSize);
  try {
    return await grabCaptureSourceStreamFrame(sourceId, maxSide);
  } catch (streamError) {
    if (/could not start video source/iu.test(streamError instanceof Error ? streamError.message : String(streamError))) {
      streamCaptureUnavailable = true;
    }
    try {
      return await grabCaptureSourceStill(sourceId, maxSide, options.nativeSize);
    } catch {
      throw streamError;
    }
  }
}

async function grabCaptureSourceStreamFrame(sourceId: string, maxSide: number) {
  const stream = await withTimeout(createDesktopSourceStream(sourceId), GRAB_TIMEOUT_MS);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    await withTimeout(new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('无法读取画面'));
      void video.play().catch(reject);
    }), GRAB_TIMEOUT_MS);
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.srcObject = null;
    return { height: canvas.height, imageDataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width: canvas.width };
  } finally {
    releaseManagedMediaStream(stream);
  }
}

/** A readable full-resolution frame, falling back to the list thumbnail if the grab fails. */
export async function grabCaptureSourceImageOrThumbnail(source: { bounds?: CaptureSourceSize | null; id?: string; thumbnail?: string }) {
  if (source.id) {
    try {
      return (await grabCaptureSourceFrame(source.id, { nativeSize: source.bounds })).imageDataUrl;
    } catch {
      // The thumbnail still lets recognition run, just with less detail.
    }
  }
  return source.thumbnail ?? '';
}
