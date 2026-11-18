// The mind map as a dark-neon picture page (2026-11-09). Topic in the middle with her avatar,
// branches split left and right by size, child nodes on the outside joined by glowing curves.
// Text wraps instead of being cut; the page grows taller with the content (1536 wide, up to
// 2400 high). Node heights are estimated from the text, so the layout needs no script.

import { escapeHtml as esc, hashText, networkSvg, pawMark } from './reportGraphics';
import type { MindMapBranch, MindMapChild, MindMapData } from './mindMapTypes';
import { buildReportPage, headerHtml } from './reportPageKit';

const WIDTH = 1536;
const MIN_HEIGHT = 760;
const MAX_HEIGHT = 2400;
const CONTENT_TOP = 150;
const COLORS = ['#7fd8ff', '#a99bff', '#4fe3a8', '#ffc85c', '#ff9fd8', '#ff8a6b', '#8fb4ff', '#c8f07a'];

// Columns (right side; the left side mirrors them).
const CENTER_W = 280;
const BRANCH_W = 210;
const CHILD_W = 290;
// 768 + 140 + 50 = 958; children 1212–1502, leaving a 34px margin.
const BRANCH_X = WIDTH / 2 + CENTER_W / 2 + 50;
const CHILD_X = BRANCH_X + BRANCH_W + 44;

const BRANCH_FONT = 19;
const BRANCH_LINE = 27;
const CHILD_FONT = 16;
const CHILD_LINE = 23;
const NOTE_FONT = 13.5;
const NOTE_LINE = 20;
const CHILD_GAP = 10;
const BRANCH_GAP = 26;

/** Width of a text in em: CJK and full-width characters 1, the rest about 0.55. */
function emWidth(text: string) {
  let width = 0;
  for (const char of text) width += /[⺀-￯]/u.test(char) ? 1 : 0.56;
  return width;
}

function lineCount(text: string, fontSize: number, innerWidth: number) {
  return Math.max(1, Math.ceil((emWidth(text) * fontSize) / innerWidth));
}

function childHeight(child: MindMapChild) {
  const inner = CHILD_W - 28;
  const textLines = lineCount(child.text, CHILD_FONT, inner);
  const noteLines = (child.notes ?? []).reduce((sum, note) => sum + lineCount(`· ${note}`, NOTE_FONT, inner), 0);
  return 18 + textLines * CHILD_LINE + (noteLines ? 6 + noteLines * NOTE_LINE : 0);
}

function branchHeight(branch: MindMapBranch) {
  return 26 + lineCount(branch.text, BRANCH_FONT, BRANCH_W - 32) * BRANCH_LINE;
}

interface PlacedBranch {
  branch: MindMapBranch;
  children: Array<{ child: MindMapChild; height: number; top: number }>;
  color: string;
  height: number;
  side: 'left' | 'right';
  top: number;
  total: number;
}

function subtreeHeight(branch: MindMapBranch) {
  const children = branch.children ?? [];
  const childrenHeight = children.reduce((sum, child) => sum + childHeight(child), 0) + CHILD_GAP * Math.max(0, children.length - 1);
  return Math.max(branchHeight(branch), childrenHeight);
}

/** First branches go right (clockwise, like a hand-drawn map) until that side holds about half. */
function splitSides(branches: MindMapBranch[]) {
  const sizes = branches.map(subtreeHeight);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  let right = 0;
  let rightCount = 0;
  while (rightCount < branches.length && (rightCount === 0 || right + sizes[rightCount] / 2 <= total / 2)) {
    right += sizes[rightCount];
    rightCount += 1;
  }
  if (branches.length > 1 && rightCount === branches.length) rightCount -= 1;
  return { left: branches.slice(rightCount), right: branches.slice(0, rightCount) };
}

function sideHeight(branches: MindMapBranch[]) {
  return branches.reduce((sum, branch) => sum + subtreeHeight(branch), 0) + BRANCH_GAP * Math.max(0, branches.length - 1);
}

function placeSide(branches: MindMapBranch[], side: 'left' | 'right', colorOffset: number, middle: number): PlacedBranch[] {
  let top = middle - sideHeight(branches) / 2;
  return branches.map((branch, index) => {
    const total = subtreeHeight(branch);
    const height = branchHeight(branch);
    const children = branch.children ?? [];
    const childrenHeight = children.reduce((sum, child) => sum + childHeight(child), 0) + CHILD_GAP * Math.max(0, children.length - 1);
    let childTop = top + (total - childrenHeight) / 2;
    const placedChildren = children.map((child) => {
      const placed = { child, height: childHeight(child), top: childTop };
      childTop += placed.height + CHILD_GAP;
      return placed;
    });
    const placed = { branch, children: placedChildren, color: COLORS[(colorOffset + index) % COLORS.length], height, side, top: top + (total - height) / 2, total };
    top += total + BRANCH_GAP;
    return placed;
  });
}

const mirror = (x: number, width: number, side: 'left' | 'right') => (side === 'right' ? x : WIDTH - x - width);

function curve(x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  const bend = (x2 - x1) * 0.5;
  return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + bend).toFixed(1)} ${y1.toFixed(1)} ${(x2 - bend).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" style="filter:drop-shadow(0 0 5px ${color})" opacity=".9"/>`;
}

function render(map: MindMapData) {
  const { left, right } = splitSides(map.branches);
  const avatarSize = 108;
  const titleLines = lineCount(map.title, 30, CENTER_W - 40);
  const centerH = 40 + avatarSize + 14 + titleLines * 40;
  const contentH = Math.max(sideHeight(left), sideHeight(right), centerH);
  const summaryH = map.summary ? 84 : 0;
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, CONTENT_TOP + contentH + 40 + summaryH + 30));
  // A small map sits in the middle of the space it has, not at the top.
  const room = height - CONTENT_TOP - summaryH - 40;
  const middle = CONTENT_TOP + Math.max(contentH, room) / 2;
  const placed = [...placeSide(right, 'right', 0, middle), ...placeSide(left, 'left', right.length, middle)];

  const centerLeft = WIDTH / 2 - CENTER_W / 2;
  const centerTop = middle - centerH / 2;
  const lines: string[] = [];
  const nodes: string[] = [];
  for (const item of placed) {
    const dir = item.side === 'right' ? 1 : -1;
    const branchLeft = mirror(BRANCH_X, BRANCH_W, item.side);
    const branchMid = item.top + item.height / 2;
    const centerEdge = WIDTH / 2 + dir * (CENTER_W / 2 - 6);
    const branchInner = item.side === 'right' ? branchLeft : branchLeft + BRANCH_W;
    const branchOuter = item.side === 'right' ? branchLeft + BRANCH_W : branchLeft;
    lines.push(curve(centerEdge, middle, branchInner, branchMid, item.color, 3.2));
    nodes.push(`<div style="position:absolute;left:${branchLeft}px;top:${item.top.toFixed(1)}px;width:${BRANCH_W}px;padding:13px 16px;border-radius:16px;border:2px solid ${item.color};background:linear-gradient(160deg,rgba(40,50,124,.92),rgba(18,24,74,.94));box-shadow:0 0 18px ${item.color}88,inset 0 0 14px ${item.color}33;font-size:${BRANCH_FONT}px;line-height:${BRANCH_LINE}px;font-weight:800;color:#f4f6ff;text-align:center;text-shadow:0 0 10px ${item.color}aa">${esc(item.branch.text)}</div>`);
    for (const placedChild of item.children) {
      const childLeft = mirror(CHILD_X, CHILD_W, item.side);
      const childMid = placedChild.top + Math.min(placedChild.height / 2, 9 + CHILD_LINE / 2 + 2);
      const childInner = item.side === 'right' ? childLeft : childLeft + CHILD_W;
      lines.push(curve(branchOuter, branchMid, childInner, childMid, item.color, 1.8));
      const notes = (placedChild.child.notes ?? []).map((note) => `<div style="font-size:${NOTE_FONT}px;line-height:${NOTE_LINE}px;color:#a9b3ee">· ${esc(note)}</div>`).join('');
      nodes.push(`<div style="position:absolute;left:${childLeft}px;top:${placedChild.top.toFixed(1)}px;width:${CHILD_W}px;padding:9px 14px;border-radius:12px;border:1px solid ${item.color}99;border-${item.side === 'right' ? 'left' : 'right'}:4px solid ${item.color};background:rgba(16,22,68,.82);box-shadow:0 0 10px ${item.color}33">
<div style="font-size:${CHILD_FONT}px;line-height:${CHILD_LINE}px;color:#eef0ff;font-weight:600">${esc(placedChild.child.text)}</div>${notes ? `<div style="margin-top:6px">${notes}</div>` : ''}</div>`);
    }
  }
  const avatar = map.avatarDataUrl ? `<img src="${esc(map.avatarDataUrl)}" alt="" style="width:100%;height:100%;object-fit:cover">` : pawMark(56);
  const center = `<div style="position:absolute;left:${centerLeft}px;top:${centerTop.toFixed(1)}px;width:${CENTER_W}px;height:${centerH}px;padding:20px;border-radius:26px;border:2px solid rgba(190,200,255,.85);background:radial-gradient(circle at 50% 30%,rgba(70,76,170,.95),rgba(20,26,80,.96));box-shadow:0 0 34px rgba(140,160,255,.75),0 0 90px rgba(110,120,255,.35);display:flex;flex-direction:column;align-items:center;gap:14px">
<div style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;overflow:hidden;border:3px solid rgba(190,200,255,.9);box-shadow:0 0 22px rgba(140,160,255,.9);display:flex;align-items:center;justify-content:center;background:#20256a">${avatar}</div>
<div class="title" style="font-size:30px;line-height:40px;text-align:center;letter-spacing:1px">${esc(map.title)}</div></div>`;
  const summary = map.summary
    ? `<div class="panel" style="position:absolute;left:32px;right:32px;bottom:26px;height:${summaryH - 14}px;display:flex;align-items:center;gap:14px"><span style="font-size:15px;color:#ffd27a;flex:none">💡 一句话</span><span style="font-size:17px;line-height:1.5;color:#eef0ff;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden">${esc(map.summary)}</span></div>`
    : '';
  const glow = networkSvg(760, Math.min(760, contentH + 120), hashText(map.title + map.createdAt));
  return {
    body: `<div class="stage" style="width:${WIDTH}px;height:${height}px"><div class="grid"></div><div class="stars"></div>
<div style="position:absolute;left:${WIDTH / 2 - 380}px;top:${(middle - Math.min(760, contentH + 120) / 2).toFixed(1)}px;opacity:.45">${glow}</div>
${headerHtml(map, '生成时间', map.subtitle || `${map.characterName}的思维导图`)}
<svg width="${WIDTH}" height="${height}" style="position:absolute;left:0;top:0">${lines.join('')}</svg>
${nodes.join('\n')}
${center}
${summary}
</div>`,
    height,
  };
}

/** The whole page for one picture: 1536 wide, as tall as the map needs (900–2400). */
export function buildMindMapHtml(map: MindMapData) {
  const { body, height } = render(map);
  return buildReportPage(body, height);
}
