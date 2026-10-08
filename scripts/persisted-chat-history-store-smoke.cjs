const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPersistedChatHistoryStore } = require('../electron/persistedChatHistoryStore.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-chat-history-'));
try {
  const store = createPersistedChatHistoryStore({ userDataPath: tempRoot });
  const initial = store.load();
  assert.equal(initial.ok, false);
  assert.deepEqual(initial.messages, []);

  const messages = [{ id: 'message-1', role: 'user', text: '请保留这条对话。', createdAt: 1 }];
  const saved = store.save(messages);
  assert.equal(saved.ok, true);
  assert.equal(saved.messageCount, 1);
  assert.deepEqual(store.load().messages, messages);

  const nextMessages = [...messages, { id: 'message-2', role: 'model', text: '已经保存。', createdAt: 2 }];
  assert.equal(store.save(nextMessages).ok, true);
  const paths = store.getPaths();
  fs.writeFileSync(paths.primaryPath, '{broken json', 'utf8');
  const recovered = store.load();
  assert.equal(recovered.ok, true);
  assert.equal(recovered.source, 'backup');
  assert.deepEqual(recovered.messages, messages);
  assert.equal(recovered.repairedPrimary, true);

  fs.writeFileSync(paths.primaryPath, '{broken json', 'utf8');
  const originalCopy = fs.copyFileSync;
  const originalRename = fs.renameSync;
  const failPrimaryWrite = (source, target, ...args) => {
    if (target === paths.primaryPath) throw new Error('simulated primary write failure');
    return originalCopy(source, target, ...args);
  };
  try {
    fs.copyFileSync = failPrimaryWrite;
    fs.renameSync = (source, target, ...args) => {
      if (target === paths.primaryPath) throw new Error('simulated primary write failure');
      return originalRename(source, target, ...args);
    };
    assert.equal(store.save(nextMessages).ok, false);
  } finally {
    fs.copyFileSync = originalCopy;
    fs.renameSync = originalRename;
  }
  assert.equal(store.load().ok, true, 'A failed save must retain the last valid backup.');
  assert.deepEqual(store.load().messages, messages);
  assert.equal(fs.readdirSync(tempRoot).some((name) => name.endsWith('.tmp')), false);

  try {
    fs.renameSync = (source, target, ...args) => {
      if (target === paths.primaryPath) throw new Error('simulated replacement failure');
      return originalRename(source, target, ...args);
    };
    assert.equal(store.save(nextMessages).ok, false);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.deepEqual(store.load().messages, messages, 'A failed replacement must leave the primary readable.');
  assert.equal(fs.readdirSync(tempRoot).some((name) => name.endsWith('.tmp')), false);

  // Shared-state sync pushes the same messages about once a second; identical
  // saves must not rewrite the primary, rotate the backup, or log a save.
  const dedupeRoot = path.join(tempRoot, 'dedupe');
  const logLines = [];
  const dedupeStore = createPersistedChatHistoryStore({
    log: (message) => logLines.push(message),
    userDataPath: dedupeRoot,
  });
  const dedupePaths = dedupeStore.getPaths();
  assert.equal(dedupeStore.save(messages).ok, true);
  assert.equal(dedupeStore.save(nextMessages).ok, true);
  const savedCountAfterChanges = logLines.filter((line) => line === 'persisted chat history saved').length;
  assert.equal(savedCountAfterChanges, 2);
  const primaryMtime = fs.statSync(dedupePaths.primaryPath).mtimeMs;
  const backupText = fs.readFileSync(dedupePaths.backupPath, 'utf8');
  for (let index = 0; index < 50; index += 1) {
    const repeated = dedupeStore.save(nextMessages.map((message) => ({ ...message })));
    assert.equal(repeated.ok, true);
    assert.equal(repeated.unchanged, true);
    assert.equal(repeated.messageCount, nextMessages.length);
  }
  assert.equal(logLines.filter((line) => line === 'persisted chat history saved').length, savedCountAfterChanges,
    'Identical saves must not be written or logged.');
  assert.equal(fs.statSync(dedupePaths.primaryPath).mtimeMs, primaryMtime);
  assert.equal(fs.readFileSync(dedupePaths.backupPath, 'utf8'), backupText,
    'Identical saves must keep the backup at the previous distinct history.');
  assert.deepEqual(JSON.parse(backupText).messages, messages);

  const thirdMessages = [...nextMessages, { id: 'message-3', role: 'user', text: '继续。', createdAt: 3 }];
  const changed = dedupeStore.save(thirdMessages);
  assert.equal(changed.ok, true);
  assert.notEqual(changed.unchanged, true);
  assert.deepEqual(dedupeStore.load().messages, thirdMessages);
  assert.deepEqual(JSON.parse(fs.readFileSync(dedupePaths.backupPath, 'utf8')).messages, nextMessages,
    'A real change must still rotate the previous primary into the backup.');

  fs.rmSync(dedupePaths.primaryPath);
  const rewritten = dedupeStore.save(thirdMessages);
  assert.notEqual(rewritten.unchanged, true, 'A missing primary must be rewritten even if content is unchanged.');
  assert.deepEqual(dedupeStore.load().messages, thirdMessages);

  const reopenedStore = createPersistedChatHistoryStore({ userDataPath: dedupeRoot });
  assert.deepEqual(reopenedStore.load().messages, thirdMessages);
  assert.equal(reopenedStore.save(thirdMessages).unchanged, true,
    'Saving what was just loaded must not rewrite the file.');

  console.log('persisted chat history store smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
