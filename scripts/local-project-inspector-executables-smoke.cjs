const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const rootFile = path.resolve(__dirname, '../electron/localProjectInspectorService.cjs');
const moduleFile = path.resolve(__dirname, '../electron/localProjectInspectorExecutables.cjs');
const text = fs.readFileSync(moduleFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = ts.createSourceFile(moduleFile, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
function visit(node) {
  if (ts.isFunctionLike(node) && node.body) assert.ok(tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(node, visit);
}
visit(tree);
let oldSource;
if (baseline) {
  const source = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'inspectExecutableFolder');
  const constant = source.statements.find(n => n.getText(source).startsWith('const EXECUTABLE_EXTENSIONS'));
  oldSource = constant.getText(source) + '\n' + fn.getText(source) + '\nmodule.exports = { inspectExecutableFolder };';
  function retained(text) {
    const source = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    return source.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name.text === 'inspectExecutableFolder')
      && !n.getText(source).startsWith('const EXECUTABLE_EXTENSIONS')
      && !n.getText(source).includes("require('./localProjectInspectorExecutables.cjs')"))
      .map(n => ts.createPrinter().printNode(ts.EmitHint.Unspecified, n, source)).join('\n');
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(baseline));
}
function scenario(platform, count, targetKind, mode, original) {
  const trace = [], failure = Error('controlled failure'), modules = new Map();
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const root = platform === 'win32' ? 'C:\\controlled\\project' : '/controlled/project';
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    new Function('require', 'module', file === moduleFile && original
      ? "const path = require('path'); const { getSafeStat } = require('./localProjectInspectorReader.cjs'); const { createDetection, createSuggestedAction } = require('./localProjectInspectorRules.cjs');\n" + oldSource
      : fs.readFileSync(file, 'utf8'))(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'path') return paths;
      if (id === 'fs') return { statSync(target) { trace.push(['stat', target]); if (mode === 'stat') throw failure; return { size: mode === 'zero' ? 0 : mode === 'absent' ? undefined : 900 }; } };
      throw Error('Unexpected module ' + id);
    }, module);
    return module.exports;
  }
  const api = load(moduleFile);
  const entries = Array.from({ length: count }, (_, i) => {
    const extension = ['.cmd', '.exe', '.ps1', '.lnk', '.url', '.bat', '.appref-ms'][i % 7];
    const name = (i === 0 ? 'duplicate' : 'file' + (count - i)) + extension;
    return { name, path: paths.join(root, name), extension, isFile: true, isDirectory: false, sizeBytes: i };
  });
  entries.push({ name: 'directory.exe', path: paths.join(root, 'directory.exe'), extension: '.exe', isFile: false });
  entries.push({ name: 'not-supported.TXT', path: paths.join(root, 'not-supported.TXT'), extension: '.txt', isFile: true });
  entries.push({ name: 'uppercase.EXE', path: paths.join(root, 'uppercase.EXE'), extension: '.EXE', isFile: true });
  if (count) entries.push({ ...entries[0], name: 'DUPLICATE.CMD', path: entries[0].path.toUpperCase(), sizeBytes: 123 });
  const target = targetKind === 'none' ? '' : paths.join(root, targetKind === 'duplicate' ? 'duplicate.cmd' : targetKind === 'exe' ? 'target.EXE' : targetKind === 'cmd' ? 'target.cmd' : 'readme.txt');
  const inputBefore = JSON.stringify(entries);
  const value = api.inspectExecutableFolder(entries, root, target);
  assert.equal(JSON.stringify(entries), inputBefore, 'Sorting leaves the input array unchanged');
  if (value) { assert.ok(value.actions.length <= 6); assert.ok(value.info.executableCandidates.length <= 12); }
  if (targetKind === 'none' || targetKind === 'text') assert.equal(trace.length, 0);
  if (targetKind === 'exe' || targetKind === 'cmd') assert.equal(value.actions[0].command, target);
  if (targetKind === 'duplicate' && count) assert.equal(value.actions[0].command, entries.at(-1).path, 'First key position uses the last duplicate value');
  return { value, trace };
}
const outcomes = [];
for (const platform of ['win32', 'linux']) for (const count of [0, 1, 5, 6, 11, 12, 20])
  for (const target of ['none', 'exe', 'cmd', 'text', 'duplicate']) for (const mode of ['normal', 'stat', 'zero', 'absent']) {
    const actual = scenario(platform, count, target, mode, false);
    if (baseline) assert.deepEqual(actual, scenario(platform, count, target, mode, true));
    outcomes.push(actual);
  }
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, '30d27628b07dce15fe3f9ca62cd5372f3f96dcea937ef9dbb72ea881cadef632', 'Reviewed executable candidates and stat calls remain unchanged');
console.log('Project inspector executables passed: ' + outcomes.length + ' platform/extension/priority/dedup/limit/stat cases; hash ' + hash);
