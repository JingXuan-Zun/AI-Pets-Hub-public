const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDeepSeekHarnessRuntimeService } = require('../electron/deepseekHarnessRuntimeService.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-pets-dsh-'));
void (async () => {
try {
  const service = createDeepSeekHarnessRuntimeService({ runnerRoot: root });
  const probe = await service.probe({ pythonPath: path.join(root, 'missing-python.exe') });
  assert.equal(probe.available, false);
  assert.equal(typeof probe.error, 'string');
  const invalidUpdate = await service.checkUpdate({ pythonPath: path.join(root, 'missing-python.exe') });
  assert.equal(invalidUpdate.checked, false);
  const homePath = path.join(root, 'dsh-home');
  fs.mkdirSync(homePath);
  const prepared = service.prepareCapabilityProfile({ dshHome: homePath });
  assert.equal(prepared.ok, true);
  const profileText = fs.readFileSync(prepared.profilePath, 'utf8');
  assert.match(profileText, /id: persistent-pwsh/u);
  assert.match(profileText, /id: str-replace-editor/u);
  assert.match(profileText, /disabled: true/u);
  assert.match(profileText, /ai-pets-capability-bridge/u);
  assert.match(profileText, /file:\/\//u);
  const pluginText = fs.readFileSync(service.getCapabilityPluginPath(), 'utf8');
  assert.doesNotMatch(pluginText, /@deepseek-ai\/dsh-tools/u);
  const invalidRun = await service.run({ workspace: '', dshHome: '' });
  assert.equal(invalidRun.ok, false);
  assert.match(invalidRun.error, /Workspace/u);
  assert.ok(service.getRunnerPath().endsWith('deepseek-harness-runner.py'));
  console.log('deepseek harness runtime service smoke passed');
} finally {
  fs.rmSync(root, { force: true, recursive: true });
}
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
