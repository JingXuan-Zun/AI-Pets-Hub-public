// Fixes from the 2026-11-05 stability tests (interference / long chain / interruption).
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyLoopActionRisk } from '../src/agent/loop/loopApproval';
import { FAILED_RESULT, SIGN_IN_TITLE, SIGN_IN_WALL } from '../src/agent/conversation/desktopDeadEnds';

const require = createRequire(import.meta.url);

// Enter after typing: a new line in an editor, possibly "send" anywhere else.
const typed = { action: 'type_text', text: '中断测试' } as const;
const enter = { action: 'press_keys', keys: '{ENTER}' } as const;
assert.equal(classifyLoopActionRisk(enter, { previousAction: typed, windowProcessName: 'Notepad' }).risk, 'scope');
assert.equal(classifyLoopActionRisk(enter, { previousAction: typed, windowProcessName: 'Code.exe' }).risk, 'scope');
assert.equal(classifyLoopActionRisk(enter, { previousAction: typed, windowProcessName: 'QQ' }).risk, 'confirm', 'chat apps still ask');
assert.equal(classifyLoopActionRisk(enter, { previousAction: typed, windowProcessName: 'chrome' }).risk, 'confirm');
assert.equal(classifyLoopActionRisk(enter, { previousAction: typed }).risk, 'confirm', 'unknown window still asks');
assert.equal(classifyLoopActionRisk({ action: 'press_keys', keys: '%{F4}' }, { windowProcessName: 'Notepad' }).risk, 'confirm', 'Alt+F4 always asks');

// Sign-in / activation walls.
for (const title of ['versions.csv - Excel (未经授权产品)', '登录以设置 Office', 'Microsoft Office 激活向导', '输入产品密钥', 'Unlicensed Product', 'Sign in to set up Office', '登录']) {
  assert.ok(SIGN_IN_WALL.test(title) || SIGN_IN_TITLE.test(title), title);
}
for (const title of ['*第二轮测试 - Notepad', '哔哩哔哩 (゜-゜)つロ 干杯~', 'QQ', '登录记录.txt - Notepad', 'Calculator']) {
  assert.ok(!SIGN_IN_WALL.test(title) && !SIGN_IN_TITLE.test(title), title);
}
assert.ok(FAILED_RESULT.test('结果：失败，点击没有生效'));
assert.ok(!FAILED_RESULT.test('结果：已点击'));

// Opening files: documents yes, programs and scripts never.
const { createKnownFoldersService } = require('../electron/knownFoldersIpcHandlers.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-file-'));
const doc = path.join(dir, 'a.csv');
const script = path.join(dir, 'b.ps1');
fs.writeFileSync(doc, 'x');
fs.writeFileSync(script, 'x');
const service = createKnownFoldersService({ app: { getPath: () => dir }, projectRoot: dir });
const opened: string[] = [];
const shell = { openPath: async (target: string) => { opened.push(target); return ''; } };
const spawned: string[][] = [];
const fakeSpawn = (command: string, args: string[]) => { spawned.push([command, ...args]); return { unref() {} }; };

(async () => {
  assert.deepEqual(await service.openFile(shell, doc, undefined, fakeSpawn), { app: 'default', ok: true, path: doc });
  assert.deepEqual(await service.openFile(shell, doc, '记事本', fakeSpawn), { app: 'notepad', ok: true, path: doc });
  assert.deepEqual(spawned, [['notepad.exe', doc]]);
  await assert.rejects(service.openFile(shell, script, undefined, fakeSpawn), /程序或脚本/u);
  await assert.rejects(service.openFile(shell, dir, undefined, fakeSpawn), /文件夹/u);
  await assert.rejects(service.openFile(shell, 'relative.txt', undefined, fakeSpawn), /绝对路径/u);
  await assert.rejects(service.openFile(shell, doc, 'excel', fakeSpawn), /默认程序或记事本/u);
  assert.deepEqual(opened, [doc]);
  fs.rmSync(dir, { force: true, recursive: true });
  console.log('stability findings smoke ok: 26 checks');
})();
