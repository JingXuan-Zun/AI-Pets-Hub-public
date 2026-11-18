// Task report plugin (2026-11-09): data normalizing, the page template, reading her arguments
// and the QQ/WeChat relay sending the picture.
import assert from 'node:assert/strict';
import { readMindMapArgs, readTaskReportArgs } from '../src/reports/reportCapabilities';
import { buildMindMapHtml } from '../src/reports/mindMapTemplate';
import { MIND_MAP_LIMITS, normalizeMindMap } from '../src/reports/mindMapTypes';
import { buildTaskReportHtml } from '../src/reports/taskReportTemplate';
import { countReportItems, formatReportDuration, normalizeTaskReport, REPORT_LIMITS } from '../src/reports/taskReportTypes';
import { collectQqRelayOutgoing, createQqRelayState } from '../src/qq-bridge/qqBridgeRelay';
import type { ChatMessage } from '../src/types';

let checks = 0;
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks += 1; };

// Normalizing: bad statuses become done, empty labels drop, long text is cut, junk is ignored.
const normalized = normalizeTaskReport({
  avatarDataUrl: 'https://example.com/a.png',
  characterName: '',
  checks: { passed: 5, total: 3 },
  items: [
    { label: 'a', status: 'done' },
    { label: '', status: 'failed' },
    { label: 'b', status: 'weird' },
    { label: 'x'.repeat(80), note: 'n'.repeat(90), status: 'attention' },
    'not an item',
  ],
  steps: [{ label: 's', ms: -5, status: 'failed' }],
  suggestions: ['one', '', 'two', 'three', 'four', 'five'],
  title: '',
});
check(normalized.items.length === 3, 'empty and junk items dropped');
check(normalized.items[1].status === 'done', 'unknown status becomes done');
check(normalized.items[2].label.length === REPORT_LIMITS.labelChars && normalized.items[2].label.endsWith('…'), 'long label cut');
check((normalized.items[2].note ?? '').length === REPORT_LIMITS.noteChars, 'long note cut');
check(!normalized.avatarDataUrl, 'only data: avatars are kept');
check(normalized.checks?.passed === 3, 'passed checks never exceed the total');
check(normalized.title === '任务报告' && normalized.characterName === '她', 'fallback title and name');
check(normalized.steps?.[0].ms === undefined, 'negative time dropped');
check(normalized.suggestions?.length === REPORT_LIMITS.suggestions, 'suggestions capped');
check(normalizeTaskReport({ items: Array.from({ length: 99 }, (_, i) => ({ label: `f${i}`, status: 'done' })) }).items.length === REPORT_LIMITS.items, 'items capped');
check(JSON.stringify(countReportItems(normalized)) === JSON.stringify({ attention: 1, done: 2, failed: 0, skipped: 0 }), 'counts');
check(formatReportDuration(48_000) === '48秒' && formatReportDuration(125_000) === '2分5秒' && formatReportDuration(120_000) === '2分钟' && formatReportDuration(0) === '', 'durations');

// The page: exact size, its own strict CSP, no script, nothing loaded from outside, text escaped.
const report = normalizeTaskReport({
  characterName: '小桃',
  items: [
    { label: '<img src=x onerror=alert(1)>', status: 'failed' },
    ...Array.from({ length: 30 }, (_, i) => ({ label: `文件${i}`, note: '已移动', status: 'done' })),
  ],
  steps: [{ label: '扫描', ms: 1200, status: 'done' }],
  summary: '好啦',
  title: '整理',
});
const landscape = buildTaskReportHtml(report);
check(landscape.width === 1536 && landscape.height === 1024, 'picture size');
for (const page of [landscape]) {
  check(page.html.includes(`content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"`), 'page carries its own CSP');
  check(!/<script/i.test(page.html), 'no script in the page');
  check(!/(src|href)="https?:/i.test(page.html) && !/url\(\s*['"]?https?:/i.test(page.html), 'nothing loaded from outside');
  check(!page.html.includes('<img src=x') && page.html.includes('&lt;img src=x'), 'labels are escaped');
}
check(landscape.html.includes('还有'), 'overflowing lists say how many more');

// Her arguments: JSON strings or arrays, suggestions one per line.
const fromStrings = readTaskReportArgs({
  checks_passed: 2,
  checks_total: '3',
  duration_seconds: 30,
  items: '[{"label":"a","status":"done"},{"label":"b","status":"attention","note":"决定一下"}]',
  steps: [{ label: 's', ms: 100, status: 'done' }],
  suggestions: '先看 b\n再说',
  title: '测试',
}, '示例角色');
check(fromStrings.items.length === 2 && fromStrings.items[1].note === '决定一下', 'items from a JSON string');
check(fromStrings.steps?.length === 1, 'steps from an array');
check(fromStrings.suggestions?.join('|') === '先看 b|再说', 'suggestions one per line');
check(fromStrings.checks?.passed === 2 && fromStrings.checks.total === 3 && fromStrings.durationMs === 30_000, 'checks and duration');
check(readTaskReportArgs({ items: 'not json', title: 'x' }, '').items.length === 0, 'unreadable items give an empty list');

// QQ / WeChat send the report like any other picture.
const state = createQqRelayState(0);
const messages = [
  { attachments: [{ dataUrl: 'data:image/jpeg;base64,LAND', id: 'i1', kind: 'image', mimeType: 'image/jpeg', name: 'r.jpg' }], createdAt: 1, id: 'm1', role: 'model', text: '' },
] as unknown as ChatMessage[];
check(collectQqRelayOutgoing(messages, state, false)[0]?.imageDataUrls[0] === 'data:image/jpeg;base64,LAND', 'relay sends the report picture');

// Mind map: normalizing, reading her arguments, the page growing with the content.
const map = normalizeMindMap({
  branches: [
    '只有名字',
    { children: ['子节点', { name: '用 name 也行', notes: ['n1', '', 'n2', 'n3', 'n4'] }, { text: '' }], label: 'b'.repeat(30) },
    { text: '' },
    ...Array.from({ length: 10 }, (_, i) => ({ children: Array.from({ length: 9 }, (_, j) => `c${i}-${j}`), text: `分支${i}` })),
  ],
  title: '',
});
check(map.branches.length === MIND_MAP_LIMITS.branches, 'branches capped, empty dropped');
check(map.branches[0].text === '只有名字' && map.branches[1].text.length === MIND_MAP_LIMITS.branchChars, 'bare strings and long labels');
check(map.branches[1].children?.length === 2 && map.branches[1].children[1].notes?.join('') === 'n1n2n3', 'children from strings or name, notes capped');
check(map.branches.every((branch) => (branch.children?.length ?? 0) <= MIND_MAP_LIMITS.children), 'children per branch capped');
check(map.branches.reduce((sum, branch) => sum + (branch.children?.length ?? 0), 0) <= MIND_MAP_LIMITS.totalChildren, 'total children capped');
check(map.title === '思维导图', 'fallback title');
const fromArgs = readMindMapArgs({
  branches: '[{"text":"关系网","children":[{"text":"关系是节点","notes":["双向各存一份"]}]},{"text":"<b>思考</b>","children":["慢思考"]}]',
  summary: '记忆是一张会生长的网',
  title: '记忆系统',
}, '小桃');
check(fromArgs.branches.length === 2 && fromArgs.branches[0].children?.[0].notes?.[0] === '双向各存一份', 'mind map args read');
const smallMap = buildMindMapHtml(fromArgs);
const bigMap = buildMindMapHtml(map);
check(smallMap.width === 1536 && smallMap.height >= 760 && bigMap.height > smallMap.height && bigMap.height <= 2400, 'mind map grows with its content within limits');
check(!/<script/i.test(bigMap.html) && !/(src|href)="https?:/i.test(bigMap.html), 'mind map page has no script and loads nothing');
check(smallMap.html.includes('&lt;b&gt;思考') && !smallMap.html.includes('<b>思考'), 'mind map text escaped');

console.log(`task report smoke ok: ${checks} checks`);
