const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const moduleFile = require.resolve('../electron/localProjectInspectorOtherTypes.cjs');
const text = fs.readFileSync(moduleFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = ts.createSourceFile(moduleFile, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldText;
if (baseline) {
  const tree = ts.createSourceFile('root.cjs', baseline, ts.ScriptTarget.Latest, true);
  oldText = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'inspectOtherProjectTypes').getText(tree);
  function retained(text) {
    for (const name of ['getEntryByName', 'hasEntry', 'createSuggestedAction']) text = text.replace(new RegExp('  ' + name + ',\\r?\\n'), '');
    const tree = ts.createSourceFile('root.cjs', text, ts.ScriptTarget.Latest, true);
    return tree.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name.text === 'inspectOtherProjectTypes') && !n.getText(tree).includes("require('./localProjectInspectorOtherTypes.cjs')"))
      .map(n => ts.createPrinter().printNode(ts.EmitHint.Unspecified, n, tree)).join('\n');
  }
  assert.equal(retained(fs.readFileSync(path.resolve(__dirname, '../electron/localProjectInspectorService.cjs'), 'utf8')), retained(baseline));
}
function load(paths, original) {
  const rules = { exports: {} }, module = { exports: {} };
  new Function('require', 'module', fs.readFileSync(require.resolve('../electron/localProjectInspectorRules.cjs'), 'utf8'))(() => paths, rules);
  if (original) return new Function('path', ...Object.keys(rules.exports), oldText + '\nreturn inspectOtherProjectTypes;')(paths, ...Object.values(rules.exports));
  new Function('require', 'module', text)(id => id === 'path' ? paths : rules.exports, module);
  return module.exports.inspectOtherProjectTypes;
}
const outcomes = [], names = ['Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'demo.sln', 'demo.csproj', 'index.html'];
for (const paths of [path.win32, path.posix]) for (let mask = 0; mask < 256; mask++) for (const upperCase of [false, true]) {
  const entries = names.filter((_, index) => mask & (1 << index)).map(name => ({ name: upperCase ? name.toUpperCase() : name, isFile: true, extension: paths.extname(name) }));
  const root = paths === path.win32 ? 'C:\\controlled\\project' : '/controlled/project';
  const actual = load(paths, false)(entries, root);
  if (baseline) assert.deepEqual(actual, load(paths, true)(entries, root));
  const expected = [mask & 1 ? 'rust' : null, mask & 2 ? 'go' : null, mask & 4 ? 'maven-java' : null, mask & 24 ? 'gradle-java' : null, mask & 96 ? 'dotnet' : null, mask & 128 ? 'static-web' : null].filter(Boolean);
  assert.deepEqual(actual.map(result => result.detection.id), expected);
  const dotnet = actual.find(result => result.detection.id === 'dotnet');
  if (dotnet) assert.equal(dotnet.actions[0].command, mask & 64 ? 'dotnet run --project "' + (upperCase ? 'DEMO.CSPROJ' : 'demo.csproj') + '"' : 'start "" "' + (upperCase ? 'DEMO.SLN' : 'demo.sln') + '"');
  assert.ok(actual.every(result => result.actions.length === 1 && result.actions[0].risk === 'launch'));
  outcomes.push(actual);
}
for (const entries of [[{ name: 'demo.sln', extension: '.sln', isFile: false }], [{ name: 'demo.csproj', extension: '.CSPROJ', isFile: true }], [{ name: 'Cargo.toml', isFile: false }]]) {
  const actual = load(path.win32, false)(entries, 'C:\\project');
  if (baseline) assert.deepEqual(actual, load(path.win32, true)(entries, 'C:\\project'));
  outcomes.push(actual);
}
function exceptional(mode, original) {
  const trace = [], failure = Error('controlled ' + mode);
  const entries = [{ get name() { trace.push('name'); if (mode === 'name') throw failure; return 'demo.csproj'; }, get isFile() { trace.push('isFile'); if (mode === 'file') throw failure; return mode !== 'skip'; }, get extension() { trace.push('extension'); if (mode === 'extension') throw failure; return '.csproj'; } }];
  try { return { value: load(path.win32, original)(entries, 'C:\\project'), trace }; }
  catch (error) { assert.strictEqual(error, failure); return { error: error.message, trace }; }
}
for (const mode of ['normal', 'name', 'file', 'extension', 'skip']) {
  const actual = exceptional(mode, false);
  if (baseline) assert.deepEqual(actual, exceptional(mode, true));
  outcomes.push(actual);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, '126d6d8125d1a8f15f37060f316c2e42d696e41a2ad784148a35a532f3ccd3aa', 'Reviewed project detections and evaluation order remain unchanged');
console.log('Project inspector other types passed: ' + outcomes.length + ' recognition/order/case/Gradle/.NET/HTML/getter/error cases; hash ' + hash);
