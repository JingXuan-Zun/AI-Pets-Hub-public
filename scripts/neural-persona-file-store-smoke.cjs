const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  RECORD_FILE_SUFFIX,
  createNeuralPersonaFileStore,
} = require('../electron/neuralPersonaFileStore.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-persona-store-'));

try {
  const firstProcess = createNeuralPersonaFileStore({ userDataPath: root });
  assert.deepEqual(firstProcess.read('role-a'), { ok: true, value: null });
  assert.deepEqual(firstProcess.compareAndSwap('role-a', null, '{"revision":0}'), {
    matched: true,
    ok: true,
  });
  assert.deepEqual(firstProcess.compareAndSwap('role-a', null, '{"revision":1}'), {
    matched: false,
    ok: true,
  });
  assert.equal(firstProcess.read('role-b').value, null);

  const restartedProcess = createNeuralPersonaFileStore({ userDataPath: root });
  assert.equal(restartedProcess.read('role-a').value, '{"revision":0}');
  assert.equal(restartedProcess.compareAndSwap(
    'role-a', '{"revision":0}', '{"revision":1}',
  ).matched, true);
  assert.equal(restartedProcess.read('role-a').value, '{"revision":1}');
  assert.equal(restartedProcess.read('../role-a').value, null);

  const files = fs.readdirSync(path.join(root, 'neural-persona'));
  assert.ok(files.every((name) => name.endsWith(RECORD_FILE_SUFFIX)));
  assert.ok(files.every((name) => !name.includes('role-a')));
  assert.equal(files.some((name) => name.endsWith('.tmp')), false);
  console.log('neural persona file store smoke ok');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
