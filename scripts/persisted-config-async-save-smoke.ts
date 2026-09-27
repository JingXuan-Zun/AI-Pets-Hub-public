import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const preloadSource = readProjectFile('electron/preload.cjs');
const handlersSource = readProjectFile('electron/ipcHandlers.cjs');
const persistenceSource = readProjectFile('src/persistentPetConfig.ts');
const controllerSource = readProjectFile('src/hooks/usePetRuntimeConfigController.ts');

assert.doesNotMatch(preloadSource, /savePersistedConfigSync/u);
assert.doesNotMatch(handlersSource, /save-persisted-config-sync/u);
assert.match(preloadSource, /savePersistedConfig: \(config\) => ipcRenderer\.invoke\('desktop-pet:save-persisted-config'/u);
assert.match(handlersSource, /let persistedConfigSaveQueue = Promise\.resolve\(\)/u);
assert.match(handlersSource, /registerLoggedHandle\(ipcMain, runtimeLogger, 'desktop-pet:save-persisted-config'/u);
assert.match(persistenceSource, /export async function persistPetConfig/u);
assert.match(controllerSource, /void persistPetConfig\(normalizedConfig\)\.then/u);

console.log('persisted config async save smoke ok');
