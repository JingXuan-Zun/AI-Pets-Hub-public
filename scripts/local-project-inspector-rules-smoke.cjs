const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const rules = require('../electron/localProjectInspectorRules.cjs');
const rootFile = path.resolve(__dirname, '../electron/localProjectInspectorService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const text = fs.readFileSync(require.resolve('../electron/localProjectInspectorRules.cjs'), 'utf8');
const source = ts.createSourceFile('rules.cjs', text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
function check(node) {
  if (ts.isFunctionLike(node) && node.body) assert.ok(
    source.getLineAndCharacterOfPosition(node.end).line - source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 <= 50);
  ts.forEachChild(node, check);
}
check(source);
const oldRules = baseline ? new Function('require', 'module', baseline + '\nmodule.exports = {' + Object.keys(rules).join(',') + '};') : null;
if (baseline) {
  const printer = ts.createPrinter();
  const retained = value => {
    const tree = ts.createSourceFile('root.cjs', value, ts.ScriptTarget.Latest, true);
    return tree.statements.filter(node => {
      if (ts.isFunctionDeclaration(node) && Object.hasOwn(rules, node.name.text)) return false;
      const text = node.getText(tree);
      return !text.startsWith('const README_LINE_LIMIT') && !text.includes("require('./localProjectInspectorRules.cjs')");
    }).map(node => printer.printNode(ts.EmitHint.Unspecified, node, tree)).join('\n');
  };
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(baseline), 'Remaining service statements are unchanged');
}
let cases = 0;
function compare(name, args) {
  const actual = rules[name](...args);
  if (oldRules) {
    const module = { exports: {} };
    oldRules(id => id === 'child_process' ? { spawn() { throw Error('Unexpected launch'); } } : require(id.startsWith('./') ? path.resolve(path.dirname(rootFile), id) : id), module);
    assert.deepEqual(actual, module.exports[name](...args));
  }
  cases++;
  return actual;
}
for (const value of [undefined, null, '', false, 0, 123, '  “C:\\项目”  ', "' /tmp/project '", '\"nested\"', 'relative', { toString: () => ' x ' }]) compare('normalizeInputPath', [value]);
assert.equal(rules.normalizeInputPath(' “C:\\项目” '), 'C:\\项目');
for (const root of ['C:\\项目', '/tmp/project', '.']) for (const relative of ['', '.', '..', '../other', 'package.json', 'a/../../outside']) compare('resolveInsideRoot', [root, relative]);
for (let mask = 0; mask < 16; mask++) {
  const entries = ['package.json', 'pnpm-lock.yaml', 'yarn.lock', 'README.md'].filter((_, index) => mask & (1 << index))
    .map((name, index) => ({ name, isDirectory: index % 2 === 0, isFile: index % 2 !== 0 }));
  compare('selectPackageManager', [entries]);
  compare('summarizeDirectoryEntries', [entries]);
  for (const name of ['PACKAGE.JSON', 'yarn.lock', 'missing']) { compare('getEntryByName', [entries, name]); compare('hasEntry', [entries, name]); }
}
for (const manager of ['npm', 'yarn', 'pnpm', 'other']) for (const script of ['start', 'dev', 'test:unit', '-x', '', 'a b', 'a;echo', '中文']) compare('createNodeRunCommand', [manager, script]);
for (const command of ['https://example.org', 'HTTP://example.org', '/tmp/a', 'C:\\a', '', ' npm run dev ', null, 12])
  for (const risk of [undefined, 'launch']) compare('createSuggestedAction', ['label', command, '/tmp/project', 'source', risk]);
compare('createDetection', ['node', 'Node', 90, 'reason']);
for (const readme of ['', null, 'plain text\nnpm run dev\r\n  启动程序  ', Array(20).fill('python main.py').join('\n'), 'run ' + 'a'.repeat(180)]) compare('extractReadmeHints', [readme]);
const failure = Error('conversion');
assert.throws(() => rules.normalizeInputPath({ toString() { throw failure; } }), error => error === failure);

async function scenario(flavor, platform, original) {
  const trace = [], modules = new Map(), paths = platform === 'win32' ? path.win32 : path.posix;
  const root = platform === 'win32' ? 'C:\\controlled\\project' : '/controlled/project';
  const files = new Map(), directories = new Set([root]);
  function add(name, content = '') { files.set(paths.join(root, name), content); }
  if (flavor === 'node' || flavor === 'mixed') { add('package.json', JSON.stringify({ name: 'demo', scripts: { dev: 'vite', start: 'node main', 'bad;name': 'bad' }, dependencies: { react: '1', vite: '1' } })); add('pnpm-lock.yaml'); }
  if (flavor === 'broken') add('package.json', '{broken');
  if (flavor === 'python' || flavor === 'mixed') { add('main.py'); add('manage.py'); add('requirements.txt', 'django'); add('pyproject.toml', '[project]'); }
  if (flavor === 'unity' || flavor === 'mixed') { directories.add(paths.join(root, 'Assets')); directories.add(paths.join(root, 'ProjectSettings')); add('ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 6000.3'); add('Packages/manifest.json', '{}'); }
  if (flavor === 'executables' || flavor === 'mixed') { add('app.exe'); add('run.cmd'); }
  if (flavor === 'other' || flavor === 'mixed') for (const name of ['Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle.kts', 'app.csproj', 'index.html']) add(name);
  if (flavor === 'large') for (let i = 0; i < 190; i++) add('file' + i + '.txt');
  if (flavor !== 'empty') add('README.md', 'npm run dev\n运行程序\nplain text');
  function stat(target) { trace.push(['stat', target]); if (!files.has(target) && !directories.has(target)) throw Error('ENOENT'); return { isDirectory: () => directories.has(target), isFile: () => files.has(target), size: Buffer.byteLength(files.get(target) || '') }; }
  const io = { statSync: stat, readdirSync(target, options) {
    trace.push(['list', target, options]);
    const names = new Set([...files.keys(), ...directories].filter(p => p !== root && paths.dirname(p) === root).map(p => paths.basename(p)));
    return [...names].map(name => ({ name, isDirectory: () => directories.has(paths.join(root, name)), isFile: () => files.has(paths.join(root, name)) }));
  }, readFileSync(target, encoding) { trace.push(['read', target, encoding]); return files.get(target); } };
  function load(file) {
    if (path.basename(file) === 'ipcSenderGuard.cjs') return require(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', original && file === rootFile ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'fs') return io;
      if (id === 'path') return paths;
      if (id === 'child_process') return { spawn() { throw Error('Unexpected launch'); } };
      throw Error('Unexpected dependency: ' + id);
    }, module, module.exports, { platform }, { now: () => 123456 });
    return module.exports;
  }
  const api = load(rootFile), first = api.createLocalProjectInspectorService({ log: (...args) => trace.push(['log', ...args]) });
  const second = api.createLocalProjectInspectorService();
  assert.deepEqual(Object.keys(first), ['inspectLocalProject', 'runLocalProjectAction']);
  assert.notStrictEqual(first.inspectLocalProject, second.inspectLocalProject);
  const inspection = first.inspectLocalProject({ path: ' “' + root + '” ' });
  assert.equal(inspection.ok, true);
  const values = [inspection, second.inspectLocalProject({ folderPath: root }), first.inspectLocalProject({ path: '' }), first.inspectLocalProject({ path: 'relative' })];
  for (const request of [{}, { actionIndex: 1 }, { index: 99 }, { command: 'npm start' }, { label: '运行' }]) values.push(await first.runLocalProjectAction({ inspection, dryRun: true, ...request }));
  return { values, trace };
}
async function main() {
  const outcomes = [];
  for (const platform of ['win32', 'linux']) for (const flavor of ['empty', 'node', 'broken', 'python', 'unity', 'executables', 'other', 'mixed', 'large']) {
    const actual = await scenario(flavor, platform, false);
    if (baseline) assert.deepEqual(actual, await scenario(flavor, platform, true));
    outcomes.push(actual);
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
  assert.equal(hash, 'eb0ffb46771fce5ca987a573582a242201a92e5c71f3c1f0d40a32d5c7a2dfd7', 'Reviewed complete outputs and I/O order remain unchanged');
  console.log('Project inspector rules passed: ' + cases + ' direct cases, 18 real-root two-instance inspection/dry-run chains; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
