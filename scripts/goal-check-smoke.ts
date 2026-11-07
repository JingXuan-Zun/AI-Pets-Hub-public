// Goal-level verification (2026-11-06): a changing task is done only when the end state is seen.
import { strict as assert } from 'node:assert';
import {
  describeGoalCheckOutcome,
  findGoalWindow,
  formatGoalVerification,
  parseGoalChecks,
  verifyGoalChecks,
  type GoalCheckReaders,
} from '../src/agent/conversation/conversationGoalCheck';
import type { LoopWindow } from '../src/agent/loop/observationTiers';

const win = (title: string, processName: string, x: number): LoopWindow => ({ box: { height: 600, width: 800, x, y: 100 }, hwnd: x + 1, pid: 1, processName, title });
const notepad = win('*2026年11月6日 - Notepad', 'Notepad', 4000);
const calculator = win('Calculator', 'CalculatorApp', 200);

const readers: GoalCheckReaders = {
  listBrowserPages: async () => [{ title: 'Node.js — Run JavaScript Everywhere', url: 'https://nodejs.org/zh-cn' }],
  listDisplays: async () => [
    { isPrimary: true, nativeHeight: 1440, nativeWidth: 3440, nativeX: 0, nativeY: 0 },
    { isPrimary: false, nativeHeight: 1440, nativeWidth: 2560, nativeX: 3440, nativeY: -6 },
  ],
  listWindows: async () => [notepad, calculator],
  readFile: async (path) => (path.endsWith('note.txt') ? { ok: true, text: '苹果、香蕉\n橙子' } : path.endsWith('pic.png') ? { exists: true, ok: false } : { exists: false, ok: false }),
  readWindowText: async (window) => (window === notepad ? '2026年11月6日\n中断测试\nLn 2, Col 5' : ''),
};

(async () => {
  // Chinese app names find English-titled windows.
  assert.equal(findGoalWindow('记事本', [notepad, calculator]), notepad);
  assert.equal(findGoalWindow('计算器', [notepad, calculator]), calculator);
  assert.equal(findGoalWindow('画图', [notepad, calculator]), null);

  // Parsing what the model sends (array or JSON string), dropping junk.
  assert.equal(parseGoalChecks('[{"kind":"window_open","target":"记事本"}]').length, 1);
  assert.deepEqual(parseGoalChecks([{ kind: 'nope', target: 'x' }, { kind: 'file_exists' }, { kind: 'other', target: '心情变好' }]), [{ kind: 'other', target: '心情变好' }]);
  assert.equal(parseGoalChecks('not json').length, 0);
  assert.equal(parseGoalChecks(Array.from({ length: 9 }, () => ({ kind: 'other', target: 'x' }))).length, 6, 'at most 6 checks');

  const all = await verifyGoalChecks(parseGoalChecks([
    { kind: 'window_open', screen: 'secondary', target: '记事本' },
    { kind: 'window_text', target: 'Notepad', text: '中断测试' },
    { kind: 'file_contains', target: 'D:/x/note.txt', text: '香蕉' },
    { kind: 'browser_page', target: 'nodejs.org' },
    { kind: 'window_closed', target: '画图' },
    { kind: 'file_absent', target: 'D:/x/old.txt' },
  ]), readers);
  assert.deepEqual([all.passed, all.failed, all.unknown, all.total], [6, 0, 0, 6], JSON.stringify(all.outcomes.map((o) => o.evidence)));
  assert.match(formatGoalVerification(all), /^核对通过：6\/6/u);

  const mixed = await verifyGoalChecks(parseGoalChecks([
    { kind: 'window_open', screen: 'primary', target: '记事本' },
    { kind: 'window_text', target: '记事本', text: '没写的话' },
    { kind: 'file_contains', target: 'D:/x/pic.png', text: 'x' },
    { kind: 'window_closed', target: 'Calculator' },
    { kind: 'other', target: '用户满意' },
  ]), readers);
  assert.deepEqual(mixed.outcomes.map((o) => o.status), ['failed', 'failed', 'unknown', 'failed', 'unknown']);
  assert.match(mixed.outcomes[0].evidence, /副屏/u, 'says where the window really is');
  const text = formatGoalVerification(mixed);
  assert.match(text, /^失败：核对没通过（0\/5 项达到）/u, 'starts with 失败 so the step shows as failed');
  assert.match(text, /如实告诉用户/u);

  const missing = await verifyGoalChecks(parseGoalChecks([{ kind: 'window_open', target: '画图' }]), readers);
  assert.match(missing.outcomes[0].evidence, /现在开着的有：.*Notepad/u, 'lists what is open instead');

  // One display: the screen cannot be judged, which is not a failure.
  const oneScreen = await verifyGoalChecks(parseGoalChecks([{ kind: 'window_open', screen: 'secondary', target: '记事本' }]), { ...readers, listDisplays: async () => [{ isPrimary: true, nativeHeight: 1440, nativeWidth: 6000, nativeX: 0, nativeY: 0 }] });
  assert.equal(oneScreen.outcomes[0].status, 'unknown');

  // A reader that throws becomes "unknown", never a crash.
  const broken = await verifyGoalChecks(parseGoalChecks([{ kind: 'browser_page', target: 'x' }]), { ...readers, listBrowserPages: async () => { throw new Error('boom'); } });
  assert.equal(broken.outcomes[0].status, 'unknown');

  // The card's closing words.
  assert.equal(describeGoalCheckOutcome(null, false), undefined, 'nothing changed: no note');
  assert.equal(describeGoalCheckOutcome(null, true), '做完了，但没有核对结果');
  assert.equal(describeGoalCheckOutcome(all, false), '已完成，核对通过 6/6');
  assert.equal(describeGoalCheckOutcome(all, true), '做完了，但没有核对结果', 'changed again after the check');
  assert.equal(describeGoalCheckOutcome(mixed, false), '做了，但核对没通过（0/5）');
  assert.equal(describeGoalCheckOutcome({ failed: 0, outcomes: [], passed: 2, total: 3, unknown: 1 }, false), '已完成，核对 2/3（1 项没法自动核对）');

  console.log('goal check smoke ok: 24 checks');
})();
