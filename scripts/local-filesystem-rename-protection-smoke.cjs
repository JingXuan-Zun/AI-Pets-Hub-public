const assert = require('node:assert/strict');
const path = require('node:path');
const { createFixture } = require('./local-filesystem-integration-fixture.cjs');

let cases = 0;
async function main() {
  for (const pathApi of [path.win32, path.posix]) {
    for (const action of ['rename', 'rename_path', 'rename_file', 'rename_folder']) {
      for (const field of ['newName', 'name', 'fileName', 'folderName']) {
        for (const mode of ['execute', 'dryRun', 'preview']) {
          for (const name of ['.env', '.env.local', 'id_rsa', 'server.pem', '.ssh', '.env.example', '正常.txt']) {
            const f = createFixture(pathApi);
            const source = f.at('Desktop', 'report.txt');
            const request = { sourcePath: source, [field]: name,
              action: mode === 'preview' ? 'preview' : action,
              ...(mode === 'preview' ? { intendedAction: action } : {}), dryRun: mode === 'dryRun' };
            const result = await f.services[0].executeFileManagementAction(request);
            const sensitive = !['.env.example', '正常.txt'].includes(name);
            assert.equal(result.ok, !sensitive, JSON.stringify(request));
            if (sensitive) {
              assert.equal(result.reason, 'sensitive-path');
              assert.equal(result.sourcePath, f.at('Desktop', name));
              assert.equal(f.files.has(source), true);
              assert.equal(f.files.has(f.at('Desktop', name)), false);
            } else if (mode === 'execute') {
              assert.equal(result.verified, true);
              assert.equal(f.files.get(f.at('Desktop', name)).data.toString(), 'hello 中文');
            }
            if (sensitive || mode !== 'execute') assert.ok(!f.trace.some(event => event[0] === 'rename'));
            cases++;
          }
        }
      }
    }
    for (const field of ['action', 'fileAction', 'operation']) {
      const f = createFixture(pathApi);
      const result = await f.services[0].executeFileManagementAction({ [field]: 'rename', sourcePath: f.at('Desktop', 'folder'), newName: '.ssh' });
      assert.equal(result.reason, 'sensitive-path');
      assert.equal(f.files.has(f.at('Desktop', 'folder', 'nested.txt')), true);
      assert.ok(!f.trace.some(event => event[0] === 'rename'));
      cases++;
    }
    for (const field of ['intendedAction', 'previewAction', 'targetAction', 'operationType']) {
      const f = createFixture(pathApi);
      const result = await f.services[0].executeFileManagementAction({ action: 'preview', [field]: 'rename', sourcePath: f.at('Desktop', 'report.txt'), newName: '.env' });
      assert.equal(result.reason, 'sensitive-path');
      assert.ok(!f.trace.some(event => event[0] === 'rename'));
      cases++;
    }
    for (const extra of [{ newName: '../.env' }, { newName: '' }, { sourcePath: 'relative', newName: '.env' }]) {
      const f = createFixture(pathApi);
      const result = await f.services[0].executeFileManagementAction({ action: 'rename', sourcePath: f.at('Desktop', 'report.txt'), ...extra });
      assert.equal(result.ok, false);
      assert.notEqual(result.reason, 'sensitive-path');
      assert.ok(!f.trace.some(event => event[0] === 'rename'));
      cases++;
    }
  }
  console.log(`Local filesystem rename protection passed: ${cases} real service cases; aliases, previews, directory renames, invalid input and .env.example exception.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
