// Numbered element list ("set of marks") for the agent loop. The model picks an element id;
// the click point comes from the element's box, so coordinates are never guessed from pixels.

export interface LoopBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface LoopElement {
  box: LoopBox;
  center: { x: number; y: number };
  enabled: boolean;
  id: number;
  label: string;
  role: string;
  source: 'ocr' | 'uia';
}

export interface LoopUiControl {
  bounds?: { height?: number | null; width?: number | null; x?: number | null; y?: number | null } | null;
  controlType?: string | null;
  enabled?: boolean | null;
  name?: string | null;
  offscreen?: boolean | null;
}

export interface LoopOcrLine {
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
}

const MAX_ELEMENTS = 120;
const MAX_LABEL_LENGTH = 60;
const ROW_TOLERANCE_PX = 8;
const CONTROL_ROLES: Record<string, string> = {
  button: '按钮',
  checkbox: '勾选框',
  combobox: '下拉框',
  edit: '输入框',
  hyperlink: '链接',
  listitem: '列表项',
  menuitem: '菜单项',
  radiobutton: '单选项',
  tabitem: '标签页',
  treeitem: '树节点',
};

function toBox(value: LoopUiControl['bounds'] | LoopOcrLine | null | undefined): LoopBox | null {
  const x = Number(value?.x); const y = Number(value?.y);
  const width = Number(value?.width); const height = Number(value?.height);
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
    ? { height: Math.round(height), width: Math.round(width), x: Math.round(x), y: Math.round(y) }
    : null;
}

function boxCenter(box: LoopBox) {
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

function contains(outer: LoopBox, point: { x: number; y: number }) {
  return point.x >= outer.x && point.x <= outer.x + outer.width && point.y >= outer.y && point.y <= outer.y + outer.height;
}

function overlaps(a: LoopBox, b: LoopBox) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function normalizeText(value: string) {
  return value.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
}

// Windows OCR returns Chinese text with a space between every character ("快 捷 安 全").
const CJK_GAP = /(?<=[\p{Script=Han}　-〿＀-￯])\s+(?=[\p{Script=Han}　-〿＀-￯])/gu;

function clipLabel(value: string) {
  const text = value.replace(/\s+/gu, ' ').replace(CJK_GAP, '').trim();
  return text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…` : text;
}

/** OCR runs on the window image; map its pixel boxes into native-screen coordinates. */
export function mapOcrLinesToScreen(
  lines: LoopOcrLine[],
  options: { imageHeight: number; imageWidth: number; windowBox: LoopBox },
): LoopOcrLine[] {
  const scaleX = options.imageWidth > 0 ? options.windowBox.width / options.imageWidth : 1;
  const scaleY = options.imageHeight > 0 ? options.windowBox.height / options.imageHeight : 1;
  return lines.map((line) => ({
    height: line.height * scaleY,
    text: line.text,
    width: line.width * scaleX,
    x: options.windowBox.x + line.x * scaleX,
    y: options.windowBox.y + line.y * scaleY,
  }));
}

/**
 * Merges UI Automation controls and OCR text (both in native-screen coordinates) into one
 * numbered list in reading order. OCR text that only repeats a named control is dropped;
 * OCR text inside an unnamed control gives that control its label.
 */
export function buildElementMarks(options: {
  controls?: LoopUiControl[];
  ocrLines?: LoopOcrLine[];
  windowBox?: LoopBox | null;
}): LoopElement[] {
  const inWindow = (box: LoopBox) => !options.windowBox || overlaps(box, options.windowBox);
  const drafts: Array<Omit<LoopElement, 'id'>> = [];
  for (const control of options.controls ?? []) {
    const box = toBox(control.bounds);
    const role = CONTROL_ROLES[control.controlType?.trim().toLowerCase() ?? ''];
    if (!box || !role || control.offscreen === true || !inWindow(box)) continue;
    drafts.push({ box, center: boxCenter(box), enabled: control.enabled !== false, label: clipLabel(control.name ?? ''), role, source: 'uia' });
  }
  for (const line of options.ocrLines ?? []) {
    const box = toBox(line);
    const text = clipLabel(line.text ?? '');
    if (!box || !text || !inWindow(box)) continue;
    const center = boxCenter(box);
    const owner = drafts.find((draft) => draft.source === 'uia' && contains(draft.box, center));
    if (owner && !owner.label) {
      owner.label = text;
      continue;
    }
    if (owner && normalizeText(owner.label).includes(normalizeText(text))) continue;
    drafts.push({ box, center, enabled: true, label: text, role: '文字', source: 'ocr' });
  }
  return drafts
    .filter((draft) => draft.label)
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) <= ROW_TOLERANCE_PX ? a.box.x - b.box.x : a.box.y - b.box.y))
    .slice(0, MAX_ELEMENTS)
    .map((draft, index) => ({ ...draft, id: index + 1 }));
}

/** One line per element, compact enough to send every step. */
export function formatElementMarks(elements: LoopElement[]) {
  return elements.map((element) => [
    `[${element.id}]`,
    element.role,
    JSON.stringify(element.label),
    `@${element.center.x},${element.center.y}`,
    element.enabled ? '' : '(不可用)',
  ].filter(Boolean).join(' ')).join('\n');
}
