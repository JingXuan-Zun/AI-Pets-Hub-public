import { grabCaptureSourceFrame } from '../../services/captureSourceFrameGrab';

// Locating elements needs more detail than a chat remark; still capped to keep requests bounded.
const AGENT_FRAME_MAX_SIDE = 2560;
// Real desktop capture ids ("window:<hwnd>:0", "screen:<n>:0"); synthetic recovery ids cannot be streamed.
const STREAMABLE_SOURCE_ID = /^(window|screen):\d+:\d+$/u;

/**
 * The image a visual snapshot analyzes. Source-list thumbnails are only ~240x135, far too
 * small to read text or place a click, so grab a full-resolution frame of the same source
 * and keep the thumbnail only as a fallback. Coordinates stay valid: crops and element
 * positions are computed from the image size against the source bounds.
 */
export async function resolveVisualSnapshotSourceImage(source: Pick<DesktopPetCaptureSourceLike, 'bounds' | 'id' | 'thumbnail'>) {
  if (source.id && STREAMABLE_SOURCE_ID.test(source.id)) {
    try {
      return (await grabCaptureSourceFrame(source.id, { maxSide: AGENT_FRAME_MAX_SIDE, nativeSize: source.bounds })).imageDataUrl;
    } catch {
      // Fall back to the thumbnail below; capture quality checks still run on it.
    }
  }
  return source.thumbnail ?? '';
}
