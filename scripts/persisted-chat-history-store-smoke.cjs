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

  console.log('persisted chat history store smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
