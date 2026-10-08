const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createFixture } = require('./local-filesystem-integration-fixture.cjs');

const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const writes = new Set(['mkdir', 'rename', 'copyFile', 'cp', 'trash']);
let cases = 0;
const scenarios = [
  { name: 'info', method: 'getPathInfo', request: f => ({ path: f.at('Desktop', 'report.txt') }),
    check: result => { assert.equal(result.kind, 'file'); assert.equal(result.exists, true); } },
  { name: 'list', method: 'listDirectory', request: f => ({ folderPath: f.at('Desktop') }),
    check: result => { assert.equal(result.entries[0].kind, 'directory'); assert.equal(result.entries.length, 3); assert.equal(result.totalEntryCount, 4); } },
  { name: 'text', method: 'readTextFile', request: f => ({ filePath: f.at('Desktop', 'report.txt') }),
    check: result => assert.equal(result.text, 'hello 中文') },
  { name: 'truncated-text', method: 'readTextFile', request: f => ({ path: f.at('Desktop', 'report.txt'), maxBytes: 5 }),
    check: result => { assert.equal(result.text, 'hello'); assert.equal(result.truncated, true); } },
  { name: 'image', method: 'readFileDataUrl', request: f => ({ query: f.at('Desktop', 'photo.png') }),
    check: result => assert.equal(result.dataUrl, 'data:image/png;base64,iVBORw==') },
  { name: 'search', method: 'searchFiles', request: f => ({ rootPath: f.at('Desktop'), nameQuery: 'nested', extension: 'txt' }),
    check: result => assert.equal(result.matches[0].name, 'nested.txt') },
  { name: 'missing', method: 'getPathInfo', request: f => ({ path: f.at('missing') }), ok: false },
  { name: 'relative', method: 'readTextFile', request: () => ({ path: 'relative.txt' }), ok: false },
  { name: 'private-first', method: 'readTextFile', request: f => ({ path: f.at('private', 'secret.txt') }), sensitive: true },
  { name: 'private-second', method: 'readTextFile', instance: 1, request: f => ({ path: f.at('private', 'secret.txt') }),
    check: result => assert.equal(result.text, 'private content') },
  { name: 'key', method: 'readTextFile', request: f => ({ path: f.at('.ssh', 'id_rsa') }), sensitive: true },
  { name: 'key-second', method: 'readFileDataUrl', instance: 1, request: f => ({ path: f.at('.ssh', 'id_rsa') }), sensitive: true },
  { name: 'linked-file', method: 'readTextFile', request: f => ({ path: f.at('alias.txt') }), sensitive: true },
  { name: 'linked-parent', action: 'create_directory', request: f => ({ destinationPath: f.at('linked-folder', 'new') }), sensitive: true },
  { name: 'protected-source', action: 'copy_path', request: f => ({ sourcePath: f.at('private', 'secret.txt'), destinationPath: f.at('copied.txt') }), sensitive: true },
  { name: 'protected-target', action: 'copy_path', request: f => ({ sourcePath: f.at('Desktop', 'report.txt'), destinationPath: f.at('private', 'new.txt') }), sensitive: true },
  { name: 'protected-new-name', action: 'rename_path', request: f => ({ sourcePath: f.at('Desktop', 'report.txt'), newName: '.env' }), sensitive: true, intentionalFix: true },
  { name: 'collision', action: 'copy_path', request: f => ({ sourcePath: f.at('Desktop', 'report.txt'), destinationPath: f.at('Desktop', 'photo.png') }), ok: false },
  { name: 'unknown', action: 'unsupported', request: () => ({}), ok: false },
];
for (const action of ['copy_path', 'move_path', 'rename_path', 'trash_path', 'create_directory', 'organize_desktop_files']) {
  for (const dryRun of [true, false]) {
    scenarios.push({ name: action + (dryRun ? '-preview' : '-execute'), action, dryRun,
      request: f => action === 'organize_desktop_files' ? { desktopPath: f.at('Desktop'), dryRun }
        : action === 'create_directory' ? { destinationPath: f.at('created'), dryRun }
          : { sourcePath: f.at('Desktop', 'report.txt'),
            ...(action === 'rename_path' ? { newName: 'renamed.txt' } : { destinationPath: f.at('output.txt') }), dryRun },
      check: result => { assert.equal(result.dryRun, dryRun); if (!dryRun && action !== 'create_directory') assert.equal(result.verified, true); },
    });
  }
}
scenarios.push({ name: 'directory-copy', action: 'copy_path',
  request: f => ({ sourcePath: f.at('Desktop', 'folder'), destinationPath: f.at('folder-copy') }),
  check: (result, f) => assert.equal(f.files.get(f.at('folder-copy', 'nested.txt')).data.toString(), 'nested') });

async function run(pathApi, scenario, config, original) {
  const f = createFixture(pathApi, config, original ? baseline : null);
  const service = f.services[scenario.instance || 0];
  const method = scenario.method || 'executeFileManagementAction';
  const request = { ...scenario.request(f), ...(scenario.action ? { action: scenario.action } : {}) };
  let value;
  let error;
  try { value = await service[method](request, { shell: f.shell }); }
  catch (caught) { error = { name: caught.constructor.name, message: caught.message }; }
  assert.equal(f.descriptors.size, 0, 'Leaked file descriptor: ' + scenario.name);
  const serializedLogs = JSON.stringify(f.logs);
  assert.ok(!serializedLogs.includes('private content') && !serializedLogs.includes('hello') && !serializedLogs.includes(f.at('Desktop')));
  if (scenario.dryRun) assert.ok(!f.trace.some(event => writes.has(event[0])), 'Preview wrote files: ' + scenario.name);
  if (!config.fault) {
    assert.equal(error, undefined, scenario.name);
    assert.equal(value.ok, scenario.intentionalFix && original ? true : scenario.sensitive ? false : scenario.ok ?? true, scenario.name);
    if (scenario.sensitive && !(scenario.intentionalFix && original)) {
      assert.equal(value.reason, 'sensitive-path', scenario.name);
      assert.ok(!f.trace.some(event => writes.has(event[0]) || ['open', 'read', 'readFile'].includes(event[0])));
    }
    scenario.check?.(value, f);
    assert.equal(f.logs[scenario.instance || 0].length, 1);
    assert.equal(f.logs[1 - (scenario.instance || 0)].length, 0);
    if (!original) assert.equal(f.loaded.size, 15, 'All real production modules should load');
  }
  return { value, error, trace: f.trace, files: f.snapshot(), logs: f.logs };
}

async function sequence(pathApi, original) {
  const f = createFixture(pathApi, {}, original ? baseline : null);
  const [first, second] = f.services;
  const result = [];
  result.push(first.readTextFile({ path: f.at('private', 'secret.txt') }));
  result.push(second.readTextFile({ path: f.at('private', 'secret.txt') }));
  result.push(await first.executeFileManagementAction({ action: 'create_directory', destinationPath: f.at('created') }));
  result.push(await second.executeFileManagementAction({ action: 'copy_path', sourcePath: f.at('Desktop', 'report.txt'), destinationDirectory: f.at('created') }));
  result.push(first.readTextFile({ path: f.at('created', 'report.txt') }));
  result.push(await first.executeFileManagementAction({ action: 'rename_path', sourcePath: f.at('created', 'report.txt'), newName: 'renamed.txt' }));
  result.push(second.searchFiles({ path: f.at('created'), query: 'renamed' }));
  result.push(await second.executeFileManagementAction({ action: 'trash_path', sourcePath: f.at('created', 'renamed.txt') }, { shell: f.shell }));
  result.push(first.getPathInfo({ path: f.at('created', 'renamed.txt') }));
  assert.equal(result[0].reason, 'sensitive-path');
  assert.equal(result[1].text, 'private content');
  assert.equal(result[4].text, 'hello 中文');
  assert.equal(result[6].matches[0].name, 'renamed.txt');
  assert.equal(result[8].exists, false);
  assert.equal(f.logs[0].length, 5); assert.equal(f.logs[1].length, 4);
  assert.equal(f.descriptors.size, 0);
  return { result, trace: f.trace, files: f.snapshot(), logs: f.logs };
}

async function main() {
  for (const pathApi of [path.win32, path.posix]) {
    for (const scenario of scenarios) {
      for (const fault of [undefined, 'stat', 'realpath', 'readdir', 'open', 'read', 'close', 'readFile', 'mkdir', 'rename', 'copy', 'trash']) {
        const actual = await run(pathApi, scenario, { fault }, false);
        if (baseline && !scenario.intentionalFix) {
          const before = await run(pathApi, scenario, { fault }, true);
          if (scenario.action === 'rename_path') {
            const target = pathApi.join(pathApi === path.win32 ? 'C:\\文件夹' : '/文件夹', 'Desktop', 'renamed.txt');
            const index = actual.trace.findIndex(event => event[0] === 'realpath' && event[1] === target);
            assert.ok(index >= 0, 'Actual rename target must be checked');
            const extra = actual.trace.splice(index, 2);
            assert.deepEqual(extra, [['realpath', target], ['realpath', pathApi.dirname(target)]]);
          }
          assert.deepEqual(actual, before, scenario.name + ':' + fault);
        }
        if (baseline && scenario.intentionalFix && !fault) await run(pathApi, scenario, {}, true);
        cases++;
      }
    }
    const actual = await sequence(pathApi, false);
    if (baseline) {
      const target = pathApi.join(pathApi === path.win32 ? 'C:\\文件夹' : '/文件夹', 'created', 'renamed.txt');
      const index = actual.trace.findIndex(event => event[0] === 'realpath' && event[1] === target);
      assert.deepEqual(actual.trace.splice(index, 2), [['realpath', target], ['realpath', pathApi.dirname(target)]]);
      assert.deepEqual(actual, await sequence(pathApi, true));
    }
    cases++;
  }
  console.log(`Local filesystem service integration passed: ${cases} Windows/POSIX scenarios; real root and helpers, controlled external filesystem/shell, two live service instances.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
