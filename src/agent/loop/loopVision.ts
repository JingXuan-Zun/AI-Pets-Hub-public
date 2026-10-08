import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { grabCaptureSourceFrame } from '../../services/captureSourceFrameGrab';
import { type PetConfig } from '../../types';
import { formatElementMarks, type LoopElement } from './elementMarks';
import { type LoopWindowObservation } from './observationTiers';

// L3: the vision model, only on an explicit `look`. It sees the screenshot plus the numbered
// list so it can answer with an id; a located control that has no text (an icon) is added to
// the list as a new id, so clicking still goes through element ids.

const MAX_ANSWER_LENGTH = 700;

async function captureWindowImage(observation: LoopWindowObservation) {
  const box = observation.window.box;
  if (!box) return null;
  const fast = await desktopPetShellRuntime.captureRegionText({ ...box, includeImage: true }).catch(() => null);
  if (fast?.ok && fast.imageDataUrl) return { height: box.height, imageDataUrl: fast.imageDataUrl, width: box.width };
  try {
    return await grabCaptureSourceFrame(`window:${observation.window.hwnd}:0`, { nativeSize: box });
  } catch {
    return null;
  }
}

function parseRatio(value: unknown) {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const pair = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/u) : null;
  const x = Number(record?.x ?? pair?.[0]); const y = Number(record?.y ?? pair?.[1]);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

function parseVisionJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function lookAtLoopWindow(options: {
  observation: LoopWindowObservation;
  question: string;
  settings: PetConfig['settings'];
}): Promise<{ answer: string; elements: LoopElement[] }> {
  const image = await captureWindowImage(options.observation);
  if (!image) return { answer: '无法截取当前窗口（可能最小化），先 focus_window。', elements: options.observation.elements };
  const { summarizeAgentVisualSnapshot } = await import('../../services/agentVisualSnapshotService');
  const listText = formatElementMarks(options.observation.elements.slice(0, 80));
  const request = {
    imageDataUrl: image.imageDataUrl,
    question: [
      options.question,
      listText ? `可点击元素清单（目标在清单里时，在 targetMatched 里写它的编号，如 [3]）：\n${listText}` : '',
      '目标不在清单里（例如纯图标）时，给出 targetMatched 和它在截图中的 elementCenterRatio {x,y}。',
    ].filter(Boolean).join('\n'),
    settings: options.settings,
    sourceLabel: options.observation.window.title,
  };
  // Vision models occasionally return an empty reply; one quiet retry.
  const raw = await summarizeAgentVisualSnapshot(request).catch(() => summarizeAgentVisualSnapshot(request));
  const parsed = parseVisionJson(raw);
  const summary = String(parsed?.summary ?? /"summary"\s*:\s*"([^"]+)/u.exec(raw)?.[1] ?? raw).slice(0, MAX_ANSWER_LENGTH);
  const targetMatched = typeof parsed?.targetMatched === 'string' ? parsed.targetMatched.trim() : '';
  const ratio = parseRatio(parsed?.elementCenterRatio);
  const box = options.observation.window.box;
  if (!targetMatched || /\[\d+\]/u.test(targetMatched) || !ratio || !box) {
    return { answer: targetMatched ? `${summary}\n目标：${targetMatched}` : summary, elements: options.observation.elements };
  }
  const id = Math.max(0, ...options.observation.elements.map((element) => element.id)) + 1;
  const center = { x: Math.round(box.x + ratio.x * box.width), y: Math.round(box.y + ratio.y * box.height) };
  const located: LoopElement = {
    box: { height: 1, width: 1, x: center.x, y: center.y },
    center,
    enabled: true,
    id,
    label: `视觉定位：${targetMatched.slice(0, 40)}`,
    role: '视觉',
    source: 'ocr',
  };
  return { answer: `${summary}\n目标「${targetMatched}」已加入清单：[${id}]`, elements: [...options.observation.elements, located] };
}
