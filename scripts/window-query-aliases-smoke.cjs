// “记事本” must also find the window titled “… - Notepad” (benchmark 2026-11-05).
const assert = require('node:assert/strict');
const { resolveWindowQueryAliases } = require('../electron/appLauncher/windowsAppChineseAliases.cjs');

assert.deepEqual(resolveWindowQueryAliases('记事本'), ['Notepad']);
assert.deepEqual(resolveWindowQueryAliases('计算器'), ['Calculator', 'CalculatorApp']);
assert.deepEqual(resolveWindowQueryAliases(' 任务管理器 '), ['Task Manager', 'Taskmgr']);
assert.deepEqual(resolveWindowQueryAliases('Edge 浏览器'), ['Microsoft Edge', 'msedge']);
assert.deepEqual(resolveWindowQueryAliases('Notepad'), [], 'English names are matched as they are');
assert.deepEqual(resolveWindowQueryAliases('今天也要加油啊.txt'), []);
assert.deepEqual(resolveWindowQueryAliases(''), []);
console.log('window query aliases smoke ok: 7 checks');
