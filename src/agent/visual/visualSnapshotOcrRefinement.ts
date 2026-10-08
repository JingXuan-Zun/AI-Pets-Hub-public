import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { collectOcrSnapTargets, matchOcrSnapTarget, type OcrTextLine } from './visualSnapshotOcrSnap';

// OCR only a region around the model's point: faster on big frames and fewer look-alikes.
const REGION_WIDTH_RATIO = 0.5;
const REGION_HEIGHT_RATIO = 0.4;
const MIN_REGION_SIDE = 320;
const OCR_TIMEOUT_MS = 2500;
// Fields the click strategy prefers over elementCenterRatio; dropped once OCR has the exact point.
const SUPERSEDED_POINT_FIELDS = ['elementBounds', 'bounds', 'rect', 'regionBox', 'elementCenter', 'center', 'point', 'coordinates'];

function parseSummaryObject(summary: string) {
  const start = summary.indexOf('{'); const end = summary.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(summary.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
}

function ratioPoint(value: unknown) {
  // Models write ratios as {x, y}, [x, y] or "x,y".
  const pair = Array.isArray(value) ? value
    : typeof value === 'string' ? value.split(/[,\s]+/u)
      : value && typeof value === 'object' ? [(value as { x?: unknown }).x, (value as { y?: unknown }).y] : null;
  if (!pair || pair.length < 2) return null;
  const nx = Number(pair[0]); const ny = Number(pair[1]);
  return Number.isFinite(nx) && Number.isFinite(ny) && nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 ? { x: nx, y: ny } : null;
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('OCR image load failed'));
    image.src = dataUrl;
  });
}

async function recognizeRegion(image: HTMLImageElement, region: { height: number; width: number; x: number; y: number }) {
  const canvas = document.createElement('canvas');
  canvas.width = region.width; canvas.height = region.height;
  canvas.getContext('2d')?.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
  const result = await Promise.race([
    desktopPetShellRuntime.recognizeScreenText({ imageDataUrl: canvas.toDataURL('image/png') }),
    new Promise<null>((resolve) => { globalThis.setTimeout(() => resolve(null), OCR_TIMEOUT_MS); }),
  ]);
  return result?.ok ? result.lines.map((line: OcrTextLine) => ({ ...line, x: line.x + region.x, y: line.y + region.y })) : [];
}

/**
 * Moves the vision model's elementCenterRatio onto the target text found by local OCR.
 * Returns the summary unchanged when there is no ratio, no target text or no match.
 */
export async function refineVisualSnapshotSummaryWithOcr(options: {
  imageDataUrl: string;
  summary: string;
  targetHints: unknown[];
}) {
  const parsed = parseSummaryObject(options.summary);
  const ratio = parsed ? ratioPoint(parsed.elementCenterRatio ?? parsed.centerRatio) : null;
  const targets = parsed ? collectOcrSnapTargets([...options.targetHints, parsed.primaryAction]) : [];
  if (!parsed || !ratio || !targets.length || typeof document === 'undefined') return options.summary;
  try {
    const started = Date.now();
    const image = await loadImage(options.imageDataUrl);
    const approx = { x: ratio.x * image.width, y: ratio.y * image.height };
    const width = Math.min(image.width, Math.max(MIN_REGION_SIDE, Math.round(image.width * REGION_WIDTH_RATIO)));
    const height = Math.min(image.height, Math.max(MIN_REGION_SIDE, Math.round(image.height * REGION_HEIGHT_RATIO)));
    const region = {
      height, width,
      x: Math.round(Math.min(Math.max(0, approx.x - width / 2), image.width - width)),
      y: Math.round(Math.min(Math.max(0, approx.y - height / 2), image.height - height)),
    };
    const match = matchOcrSnapTarget({ approx, imageSize: image, lines: await recognizeRegion(image, region), targets });
    if (!match) return options.summary;
    const refined: Record<string, unknown> = { ...parsed };
    SUPERSEDED_POINT_FIELDS.forEach((field) => { delete refined[field]; });
    const toRatio = { x: Number((match.centerX / image.width).toFixed(4)), y: Number((match.centerY / image.height).toFixed(4)) };
    refined.elementCenterRatio = { ...toRatio, coordinateSpace: 'source-ratio' };
    refined.elementRegion = `OCR 校正后的文字「${match.line.text.replace(/\s+/gu, '')}」中心`;
    refined.coordinateRefinement = { fromRatio: ratio, method: 'local-ocr-text-snap', ms: Date.now() - started, text: match.line.text, toRatio };
    return JSON.stringify(refined);
  } catch {
    return options.summary;
  }
}
