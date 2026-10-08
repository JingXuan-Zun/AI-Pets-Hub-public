import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const projectRoot = resolve(import.meta.dirname, '..');

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

const agentBridgeSource = readProjectFile('src/runtime-world/agentRuntimeWorldBridge.ts');
const petHookSource = readProjectFile('src/components/pet/useRuntimeWorldExpressionAction.ts');
const preloadSource = readProjectFile('electron/preload.cjs');
const ipcHandlerSource = readProjectFile('electron/ipcHandlers.cjs');
const windowManagerSource = readModuleProjectFile('electron/windowManager.cjs');

assert.match(agentBridgeSource, /publishRuntimeWorldPresentationIntent\(result\.presentationIntent\)/u);
assert.match(petHookSource, /subscribeRuntimeWorldPresentationIntent\(setIntent\)/u);
assert.match(preloadSource, /desktop-pet:publish-runtime-world-presentation-intent/u);
assert.match(preloadSource, /desktop-pet:runtime-world-presentation-intent/u);
assert.match(ipcHandlerSource, /broadcastRuntimeWorldPresentationIntent\(intent, event\.sender\.id\)/u);
assert.match(windowManagerSource, /desktop-pet:runtime-world-presentation-intent/u);
assert.match(windowManagerSource, /win\.webContents\.id === excludedWebContentsId/u);

console.log('runtime world presentation IPC contract smoke passed');
