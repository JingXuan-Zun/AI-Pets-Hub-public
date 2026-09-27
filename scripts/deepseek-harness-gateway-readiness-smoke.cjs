const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDeepSeekHarnessRuntimeService } = require('../electron/deepseekHarnessRuntimeService.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-pets-dsh-ready-'));
void (async () => {
  try {
    const workspace = path.join(root, 'workspace');
    const dshHome = path.join(root, 'dsh-home');
    fs.mkdirSync(workspace);
    fs.mkdirSync(dshHome);
    const service = createDeepSeekHarnessRuntimeService({ runnerRoot: root });
    const result = await service.validateSetup({
      dshHome,
      pythonPath: path.join(root, 'missing-python.exe'),
      workspace,
    });
    assert.equal(result.ok, false);
    assert.equal(result.checks?.directories, true);
    assert.equal(result.checks?.sdk, false);
    console.log('deepseek harness gateway readiness smoke passed');
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
