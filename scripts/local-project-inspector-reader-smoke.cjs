const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = path.resolve(__dirname, '../electron/localProjectInspectorReader.cjs');
const text = fs.readFileSync(file, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
function budgets(node) {
  if (ts.isFunctionLike(node) && node.body) assert.ok(tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(node, budgets);
}
budgets(tree);
if (baseline) {
  const printer = ts.createPrinter();
  function retained(value) {
    value = value.replace(/  resolveInsideRoot,\r?\n/, '');
    const source = ts.createSourceFile('root.cjs', value, ts.ScriptTarget.Latest, true);
    const moved = new Set(['getSafeStat', 'normalizeEntry', 'listTopLevelEntries', 'readKeyTextFile']);
    return source.statements.filter(node => {
      if (ts.isFunctionDeclaration(node) && moved.has(node.name.text)) return false;
      const text = node.getText(source);
      return !text.startsWith("const fs = require('fs')") && !text.includes("require('./localProjectInspectorReader.cjs')")
        && !['MAX_TOP_LEVEL_ENTRIES', 'MAX_KEY_FILE_BYTES', 'IGNORED_DIRECTORY_NAMES'].some(name => text.startsWith('const ' + name + ' ='));
    }).map(node => printer.printNode(ts.EmitHint.Unspecified, node, source)).join('\n');
  }
  assert.equal(retained(fs.readFileSync(path.resolve(__dirname, '../electron/localProjectInspectorService.cjs'), 'utf8')), retained(baseline));
}
function load(io, paths, original) {
  const module = { exports: {} };
  const ruleModule = { exports: {} };
  new Function('require', 'module', fs.readFileSync(require.resolve('../electron/localProjectInspectorRules.cjs'), 'utf8'))(() => paths, ruleModule);
  const source = original ? baseline + '\nmodule.exports = { MAX_TOP_LEVEL_ENTRIES, getSafeStat, normalizeEntry, listTopLevelEntries, readKeyTextFile };' : text;
  new Function('require', 'module', source)(id => {
    if (id === 'fs') return io;
    if (id === 'path') return paths;
    if (id === './localProjectInspectorRules.cjs') return ruleModule.exports;
    if (id === 'child_process') return { spawn() { throw Error('Unexpected launch'); } };
    if (id === './ipcSenderGuard.cjs') return require('../electron/ipcSenderGuard.cjs');
    throw Error('Unexpected module ' + id);
  }, module);
  return module.exports;
}
function readScenario(paths, mode, size, relative, original) {
  const trace = [], readFiles = [], warnings = [], root = paths === path.win32 ? 'C:\\project' : '/project';
  const io = { statSync(target) {
    trace.push(['stat', target]);
    if (mode === 'stat') throw Error('stat failure');
    return { isFile() { trace.push(['isFile']); return mode !== 'directory'; }, size };
  }, readFileSync(target, encoding) {
    trace.push(['read', target, encoding]);
    if (mode === 'read') throw Error('read failure');
    if (mode === 'primitive') throw 'primitive failure';
    return mode === 'empty' ? '' : 'content';
  } };
  const reader = load(io, paths, original);
  const value = reader.readKeyTextFile(root, relative, readFiles, warnings);
  if (relative.startsWith('..')) assert.equal(trace.length, 0, 'Outside root does not stat or read');
  if (size > 256 * 1024 && !['stat', 'directory'].includes(mode) && !relative.startsWith('..')) assert.equal(trace.filter(x => x[0] === 'read').length, 0);
  if (mode === 'empty' && size <= 256 * 1024 && !relative.startsWith('..')) assert.deepEqual(readFiles, [relative]);
  return { value, trace, readFiles, warnings };
}
function directoryScenario(paths, count, mode, original) {
  const trace = [], root = paths === path.win32 ? 'C:\\project' : '/project';
  const names = ['.git', 'node_modules', 'dist', 'Directory', 'File10.TXT', 'File2.txt', ...Array.from({ length: count }, (_, i) => 'item' + i + '.json')];
  const io = { readdirSync(target, options) {
    trace.push(['list', target, options]); if (mode === 'list') throw Error('list failure');
    return names.map(name => ({ name, isDirectory() { trace.push(['dir', name]); return name === 'Directory'; }, isFile() { trace.push(['file', name]); return name !== 'Directory'; } }));
  }, statSync(target) {
    trace.push(['stat', target]); if (mode === 'stat') throw Error('stat failure');
    return { isFile: () => paths.basename(target) !== 'Directory', size: 25 };
  } };
  try {
    const value = load(io, paths, original).listTopLevelEntries(root);
    assert.equal(value.totalEntryCount, names.length);
    assert.equal(value.truncated, names.length > 180);
    assert.equal(value.entries.length, Math.min(names.length - 3, 180));
    assert.equal(value.entries[0].name, 'Directory');
    assert.ok(!trace.some(row => row[0] === 'stat' && ['.git', 'node_modules', 'dist'].includes(paths.basename(row[1]))));
    return { value, trace };
  } catch (error) { if (mode !== 'list') throw error; return { error: error.message, trace }; }
}
const outcomes = [];
let reads = 0, directories = 0;
for (const paths of [path.win32, path.posix]) {
  for (const mode of ['normal', 'stat', 'directory', 'read', 'primitive', 'empty'])
    for (const size of [0, 262143, 262144, 262145]) for (const relative of ['package.json', 'nested/file.txt', '../outside']) {
      const actual = readScenario(paths, mode, size, relative, false);
      if (baseline) assert.deepEqual(actual, readScenario(paths, mode, size, relative, true));
      outcomes.push(actual); reads++;
    }
  for (const count of [0, 173, 174, 175, 180, 200]) for (const mode of ['normal', 'stat', 'list']) {
    const actual = directoryScenario(paths, count, mode, false);
    if (baseline) assert.deepEqual(actual, directoryScenario(paths, count, mode, true));
    outcomes.push(actual); directories++;
  }
  const marker = {}, reader = load({ statSync: () => marker }, paths, false);
  assert.strictEqual(reader.getSafeStat('target'), marker);
  assert.equal(load({ statSync() { throw Error('missing'); } }, paths, false).getSafeStat('target'), null);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, '3a807f93a2f1435f5b77756d523cdc6311e73df986c207762693d9a42f6027d2', 'Reviewed reading outcomes and I/O order remain unchanged');
console.log('Project inspector reader passed: ' + reads + ' read cases, ' + directories + ' directory cases; hash ' + hash);
