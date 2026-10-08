const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const moduleFile = require.resolve('../electron/localProjectInspectorTarget.cjs');
const source = fs.readFileSync(moduleFile, 'utf8');
const tree = ts.createSourceFile(moduleFile, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let baselineSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8');
  const start = old.indexOf('    const rawPath = normalizeInputPath');
  const end = old.indexOf('    const warnings = [];', start);
  assert.ok(start >= 0 && end > start);
  baselineSource = "const path = require('path'); const { getSafeStat } = require('./localProjectInspectorReader.cjs'); const { normalizeInputPath } = require('./localProjectInspectorRules.cjs');\nfunction resolveProjectTarget(request = {}) {\n"
    + old.slice(start, end) + '\nreturn { ok: true, targetPath, targetStat, rootPath, targetFilePath }; }\nmodule.exports = { resolveProjectTarget };';
}
function run(paths, inputMode, statMode, original) {
  const trace = [], cache = new Map();
  const root = paths === path.win32 ? 'C:\\controlled\\project' : '/controlled/project';
  const targetPath = statMode === 'directory' ? root : paths.join(root, 'entry.txt');
  const values = { path: '', projectPath: '', folderPath: '', filePath: '', query: '' };
  if (inputMode === 'relative') values.path = 'relative/project';
  else if (inputMode === 'quoted') values.path = '  “' + targetPath + '”  ';
  else if (inputMode === 'whitespace') { values.path = ' '; values.query = targetPath; }
  else if (inputMode !== 'missing' && inputMode !== 'null' && inputMode !== 'undefined') values[inputMode] = targetPath;
  if (inputMode === 'path') values.projectPath = 'should-not-read';
  const request = inputMode === 'null' ? null : inputMode === 'undefined' ? undefined : {};
  if (request) for (const key of Object.keys(values)) Object.defineProperty(request, key, {
    get() { trace.push(['input', key]); return values[key]; },
  });
  function stat(label, directory, file) {
    return {
      isDirectory() { assert.equal(this, objects[label]); trace.push([label, 'isDirectory']); if (statMode === label + '-directory-throw') throw Error('directory failure'); return directory; },
      isFile() { assert.equal(this, objects[label]); trace.push([label, 'isFile']); if (statMode === 'target-file-throw') throw Error('file failure'); return file; },
    };
  }
  const objects = {};
  objects.target = stat('target', statMode === 'directory', statMode !== 'directory' && statMode !== 'special');
  objects.root = stat('root', statMode !== 'root-file', false);
  let reads = 0;
  const io = { statSync(target) {
    trace.push(['stat', target]);
    reads++;
    if (reads === 1 && statMode === 'missing' || reads === 2 && statMode === 'root-missing') throw Error('missing');
    return reads === 1 ? objects.target : objects.root;
  } };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    new Function('require', 'module', original && file === moduleFile ? baselineSource : fs.readFileSync(file, 'utf8'))(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'path') return paths;
      if (id === 'fs') return io;
      throw Error('Unexpected dependency ' + id);
    }, module);
    return module.exports;
  }
  let value, error;
  try { value = load(moduleFile).resolveProjectTarget(request); } catch (failure) { error = failure.message; }
  if (value?.ok) {
    assert.equal(value.targetStat, objects.target);
    assert.equal(value.targetPath, targetPath);
    assert.equal(value.rootPath, root);
    assert.equal(value.targetFilePath, statMode === 'directory' || statMode === 'special' ? '' : targetPath);
    value = { ...value, targetStat: 'target-stat-identity' };
  }
  if (['missing', 'null', 'undefined', 'whitespace'].includes(inputMode)) {
    assert.deepEqual(value, { ok: false, error: 'Missing project path.' });
    assert.equal(reads, 0);
  } else if (inputMode === 'relative') {
    assert.deepEqual(value, { ok: false, error: 'Project path must be an absolute local path.', path: 'relative/project' });
    assert.equal(reads, 0);
  } else if (statMode === 'missing') assert.deepEqual(value, { ok: false, error: 'Path does not exist.', path: targetPath });
  else if (['root-missing', 'root-file'].includes(statMode)) assert.deepEqual(value, { ok: false, error: 'Unable to resolve containing folder.', path: targetPath });
  else if (statMode.includes('throw')) assert.equal(error, statMode === 'target-file-throw' ? 'file failure' : 'directory failure');
  else assert.equal(value.ok, true);
  return { value, error, trace };
}
const outcomes = [];
for (const paths of [path.win32, path.posix]) for (const input of ['missing', 'null', 'undefined', 'relative', 'whitespace', 'quoted', 'path', 'projectPath', 'folderPath', 'filePath', 'query'])
  for (const stat of ['directory', 'file', 'special', 'missing', 'root-missing', 'root-file', 'target-directory-throw', 'target-file-throw', 'root-directory-throw']) {
    const actual = run(paths, input, stat, false);
    if (baselineSource) assert.deepEqual(actual, run(paths, input, stat, true));
    outcomes.push(actual);
  }
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, 'e0e264d2707085d76c497ecccc383114ddf94410b72ebe61b3c98b441078abb2', 'Reviewed target resolution and call order remain unchanged');
console.log('Project target validation passed: ' + outcomes.length + ' alias/path/stat/identity/error/order cases; hash ' + hash);
