/**
 * Local OCR refinement for visual click targets. Vision models find the right element
 * but their coordinates drift (≈7% of the window in tests). Windows OCR runs locally in
 * well under a second, so it re-finds the target text near the model's point and moves
 * the point onto that text's center. Without a clear text match nothing changes.
 */
export interface OcrTextLine {
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
}

export interface OcrSnapMatch {
  centerX: number;
  centerY: number;
  line: OcrTextLine;
  target: string;
}

const MIN_TARGET_LENGTH = 2;
// Only snap to text reasonably close to where the model pointed, so a same-named label
// elsewhere on screen is not picked instead.
const MAX_SNAP_DISTANCE_RATIO = 0.25;

function longestCommonSubstringLength(left: string, right: string) {
  let best = 0;
  const lengths = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = right.length; j >= 1; j -= 1) {
      lengths[j] = left[i - 1] === right[j - 1] ? lengths[j - 1] + 1 : 0;
      if (lengths[j] > best) best = lengths[j];
    }
  }
  return best;
}

/**
 * How well OCR text matches a target label. Models often paraphrase a character
 * ("快速安全登录" for "快捷安全登录"), so a long shared run counts as a weaker match.
 */
export function scoreOcrTextMatch(text: string, target: string) {
  if (text === target) return 2;
  if (text.includes(target)) return 1.5;
  if (target.includes(text) && text.length >= 3) return 1;
  const shared = longestCommonSubstringLength(text, target);
  return shared >= 3 && shared >= Math.min(text.length, target.length) * 0.6 ? 0.8 : 0;
}

export function normalizeOcrText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** Target strings: the requested text plus quoted labels from the model's primary action. */
export function collectOcrSnapTargets(values: Array<unknown>) {
  const targets = new Set<string>();
  values.forEach((value) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const quoted = [...value.matchAll(/[「“"'‘《【]([^」”"'’》】]{2,24})[」”"'’》】]/gu)].map((match) => match[1]);
    [...quoted, value].forEach((item) => {
      const normalized = normalizeOcrText(item);
      if (normalized.length >= MIN_TARGET_LENGTH && normalized.length <= 24) targets.add(normalized);
    });
  });
  return [...targets];
}

/** The OCR line that best matches a target and lies near the approximate point (image pixels). */
export function matchOcrSnapTarget(options: {
  approx: { x: number; y: number };
  imageSize: { height: number; width: number };
  lines: OcrTextLine[];
  targets: string[];
}): OcrSnapMatch | null {
  const maxDistance = Math.hypot(options.imageSize.width, options.imageSize.height) * MAX_SNAP_DISTANCE_RATIO;
  let best: (OcrSnapMatch & { score: number }) | null = null;
  for (const line of options.lines) {
    const text = normalizeOcrText(line.text);
    if (text.length < MIN_TARGET_LENGTH) continue;
    for (const target of options.targets) {
      const quality = scoreOcrTextMatch(text, target);
      if (!quality) continue;
      const centerX = line.x + line.width / 2;
      const centerY = line.y + line.height / 2;
      const distance = Math.hypot(centerX - options.approx.x, centerY - options.approx.y);
      if (distance > maxDistance) continue;
      const score = quality - distance / maxDistance;
      if (!best || score > best.score) best = { centerX, centerY, line, score, target };
    }
  }
  if (!best) return null;
  const { score: _score, ...match } = best;
  return match;
}
