import { strict as assert } from 'node:assert';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  historyHookSource,
  ipcSource,
  mainSource,
  preloadSource,
  runtimeSource,
  storeSource,
} = readProjectSources({
  historyHookSource: 'src/hooks/usePersistedChatHistory.ts',
  ipcSource: 'electron/ipcHandlers.cjs',
  mainSource: 'electron/main.cjs',
  preloadSource: 'electron/preload.cjs',
  runtimeSource: 'src/hooks/usePetRuntimeState.ts',
  storeSource: 'electron/persistedChatHistoryStore.cjs',
});

assert.match(historyHookSource, /loadPersistedChatHistory/u);
assert.match(historyHookSource, /persistChatHistory/u);
assert.match(historyHookSource, /desktopPetChatStore\.subscribe/u);
assert.match(historyHookSource, /pagehide/u);
assert.match(runtimeSource, /usePersistedChatHistory/u);
assert.match(runtimeSource, /chatHistoryReady/u);
assert.match(ipcSource, /load-persisted-chat-history/u);
assert.match(ipcSource, /save-persisted-chat-history/u);
assert.match(ipcSource, /normalizedState\.chatState\.messages/u);
assert.match(preloadSource, /loadPersistedChatHistory/u);
assert.match(preloadSource, /savePersistedChatHistory/u);
assert.match(mainSource, /createPersistedChatHistoryStore/u);
assert.match(mainSource, /before-quit/u);
assert.match(mainSource, /persistedChatHistoryStore\.save/u);
assert.match(storeSource, /desktop-pet-chat-history\.v1\.json/u);
assert.match(storeSource, /desktop-pet-chat-history\.v1\.backup\.json/u);
assert.match(storeSource, /restored from backup/u);

console.log('persisted chat history wiring smoke passed');
