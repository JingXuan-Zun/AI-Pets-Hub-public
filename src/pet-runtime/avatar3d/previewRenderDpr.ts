// Render resolution for a preview (互动对话, the settings preview): native resolution at least,
// but the 互动对话 canvas runs far past its window (the whole body is framed, only the upper
// body shows), so the total pixel count is capped to keep MSAA affordable.
const PREVIEW_MAX_PIXELS = 12_000_000;

export function resolvePreviewRenderDpr(deviceDpr: number, cssWidth = 0, cssHeight = 0) {
  const wanted = Math.min(2, Math.max(deviceDpr || 1, 1.25));
  const area = cssWidth * cssHeight;
  const capped = area > 0 ? Math.min(wanted, Math.sqrt(PREVIEW_MAX_PIXELS / area)) : wanted;
  return Number(Math.max(0.75, capped).toFixed(2));
}
