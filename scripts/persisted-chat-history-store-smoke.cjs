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

  console.log('persisted chat history store smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
