import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const windowManager = read('../electron/windowManager.cjs');
const ipcHandlers = read('../electron/ipcHandlers.cjs');
const preload = read('../electron/preload.cjs');
const controller = read('../src/components/chat/agentRunController.ts');

assert.match(windowManager, /function setAgentDesktopExecutionActive\(active\)/u);
assert.match(
  windowManager,
  /const nextIgnore = isAgentDesktopExecutionActive\s*\? !hasInteractiveWindowShape\(\)\s*:\s*Boolean\(requestedPointerPassthrough\) && !hasFullWindowShape/u,
);
assert.match(windowManager, /chatWindow\.setFocusable\(!nextActive\)/u);
assert.match(windowManager, /chatWindow\.setIgnoreMouseEvents\(nextActive/u);
assert.match(windowManager, /settingsWindow\.setIgnoreMouseEvents\(nextActive/u);
assert.match(windowManager, /win === mainWindow \|\| win === chatWindow \|\| win === settingsWindow/u);

assert.match(ipcHandlers, /registerLoggedHandle\([\s\S]*desktop-pet:set-agent-desktop-execution-active/u);
assert.match(preload, /ipcRenderer\.invoke\('desktop-pet:set-agent-desktop-execution-active'/u);
assert.doesNotMatch(
  controller,
  /setAgentDesktopExecutionActive\(/u,
  'Agent runs must not make the desktop pet windows non-interactive',
);

console.log('agent desktop execution window isolation smoke ok');
