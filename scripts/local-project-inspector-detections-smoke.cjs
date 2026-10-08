const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const text = fs.readFileSync(require.resolve('../electron/localProjectInspectorDetections.cjs'), 'utf8');
const tree = ts.createSourceFile('detections.cjs', text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
const names = ['inspectPackageJson', 'inspectPython', 'inspectUnity', 'inspectExecutableFolder', 'inspectOtherProjectTypes'];
let oldFactory;
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  const start = baseline.indexOf('    const detectedProjectTypes = []');
  const end = baseline.indexOf('    const result = createProjectInspectionResult', start);
  assert.ok(start > 0 && end > start);
  oldFactory = new Function(...names, 'return function(input) { const { texts, entries, rootPath, targetFilePath, warnings } = input;\n'
    + baseline.slice(start, end) + '\nreturn { detectedProjectTypes, suggestedActions, details }; };');
}
function run(mask, otherCount, mode, original) {
  const trace = [], warnings = [], entries = [], failure = Error('controlled ' + mode);
  const texts = { get(key) { assert.strictEqual(this, texts); trace.push(['text', key]); if (mode === 'text') throw failure; return 'text:' + key; } };
  const input = { texts, entries, rootPath: '/project', targetFilePath: '/project/app.exe', warnings };
  function inspection(name) {
    return {
      get detection() { trace.push(['detection', name]); if (mode === 'detection') throw failure; return { id: name }; },
      get actions() {
        trace.push(['actions', name]);
        return { *[Symbol.iterator]() { trace.push(['iterate', name]); if (mode === 'actions') throw failure; yield { command: name, cwd: '/project' }; } };
      },
      get info() { trace.push(['info', name]); if (mode === 'info') throw failure; return { name }; },
    };
  }
  const dependencies = Object.fromEntries(names.map((name, index) => [name, (...args) => {
    trace.push(['call', name, args]);
    if (name === 'inspectPackageJson') { assert.strictEqual(args[1], entries); assert.strictEqual(args[3], warnings); }
    else assert.strictEqual(args[0], entries);
    if (mode === 'call') throw failure;
    if (mode === 'warnings' && name === 'inspectPackageJson') warnings.push('node warning');
    if (index === 4) return Array.from({ length: otherCount }, (_, i) => inspection('other-' + i));
    return mask & (1 << index) ? inspection(name) : null;
  }]));
  let collect;
  if (original) collect = oldFactory(...names.map(name => dependencies[name]));
  else {
    const module = { exports: {} };
    new Function('require', 'module', text)(() => dependencies, module);
    collect = module.exports.collectProjectDetections;
  }
  try {
    const value = collect(input);
    const expected = names.slice(0, 4).filter((_, i) => mask & (1 << i)).concat(Array.from({ length: otherCount }, (_, i) => 'other-' + i));
    assert.deepEqual(value.detectedProjectTypes.map(d => d.id), expected);
    assert.deepEqual(value.suggestedActions.map(a => a.command), expected);
    assert.deepEqual(Object.keys(value.details), ['node', 'python', 'unity', 'windowsApp'].filter((_, i) => mask & (1 << i)));
    assert.ok(!trace.some(row => row[0] === 'info' && row[1].startsWith('other-')), 'Other detection info stays unread');
    return { value, trace, warnings };
  } catch (error) { assert.strictEqual(error, failure); return { error: error.message, trace, warnings }; }
}
const outcomes = [];
for (let mask = 0; mask < 16; mask++) for (const otherCount of [0, 1, 3]) for (const mode of ['normal', 'warnings', 'text', 'call', 'detection', 'actions', 'info']) {
  const actual = run(mask, otherCount, mode, false);
  if (oldFactory) assert.deepEqual(actual, run(mask, otherCount, mode, true));
  outcomes.push(actual);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, '87f47024ca2131c5cb24cb8fde18fbdf18a2e0a38e3e14f3988d376cb8993c42', 'Reviewed detector call and collection order remain unchanged');
console.log('Project detection collection passed: ' + outcomes.length + ' call/text/property/iterator/warning/detail/short-circuit/error cases; hash ' + hash);
