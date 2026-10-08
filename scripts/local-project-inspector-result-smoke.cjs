const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const rules = require('../electron/localProjectInspectorRules.cjs');
const { createProjectInspectionResult } = require('../electron/localProjectInspectorResult.cjs');
const source = fs.readFileSync(require.resolve('../electron/localProjectInspectorResult.cjs'), 'utf8');
const tree = ts.createSourceFile('result.cjs', source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let old;
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile('root.cjs', baseline, ts.ScriptTarget.Latest, true);
  const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createLocalProjectInspectorService');
  const inspect = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'inspectLocalProject');
  const start = inspect.body.statements.find(n => ts.isIfStatement(n) && n.expression.getText(tree) === 'truncated').getStart(tree);
  const end = inspect.body.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(tree) === 'result')).end;
  old = new Function('input', 'clock', ...Object.keys(rules), 'MAX_TOP_LEVEL_ENTRIES',
    'const { details, detectedProjectTypes, suggestedActions, entries, targetPath, readFiles, readmeText, rootPath, targetStat, totalEntryCount, warnings, truncated } = input; const Date = clock;\n'
    + baseline.slice(start, end) + '\nreturn result;');
}
function run(typeCount, actionCount, duplicates, truncated, directory, original) {
  const trace = [], details = { node: { name: 'demo' } }, warnings = ['existing'], readFiles = ['package.json'];
  const detectedProjectTypes = Array.from({ length: typeCount }, (_, i) => ({ id: 'type-' + i, confidence: i % 2 ? 90 : 20 }));
  const suggestedActions = Array.from({ length: actionCount }, (_, i) => ({ command: 'command-' + i, cwd: '/project', label: 'action-' + i }));
  if (duplicates && actionCount) suggestedActions.push({ ...suggestedActions[0], label: 'last duplicate' });
  if (duplicates === 2) suggestedActions.push({ command: 'a|b', cwd: 'c', label: 'first collision' }, { command: 'a', cwd: 'b|c', label: 'last collision' });
  const entries = Array.from({ length: 50 }, (_, i) => ({ name: 'item' + i, isDirectory: i < 30, isFile: i >= 30 }));
  const targetStat = { isDirectory() { assert.strictEqual(this, targetStat); trace.push('target-kind'); return directory; } };
  const clock = { now() { assert.strictEqual(this, clock); trace.push('now'); return 123456; } };
  const input = { details, detectedProjectTypes, suggestedActions, entries, targetPath: '/project/target', readFiles, readmeText: 'npm start\n普通说明', rootPath: '/project', targetStat, totalEntryCount: 200, warnings, truncated };
  const value = original ? old(input, clock, ...Object.values(rules), 180) : createProjectInspectionResult(input, clock);
  assert.strictEqual(value.details, details);
  assert.strictEqual(value.warnings, warnings);
  assert.strictEqual(value.readFiles, readFiles);
  assert.strictEqual(value.detectedProjectTypes, detectedProjectTypes, 'Original in-place type sort is retained');
  assert.equal(value.primaryType.id, typeCount ? typeCount > 1 ? 'type-1' : 'type-0' : 'unknown-folder');
  assert.ok(value.suggestedActions.length <= 12);
  assert.equal(value.entrySummary.directories.length, 24);
  if (duplicates && actionCount) assert.equal(value.suggestedActions[0].label, 'last duplicate');
  assert.deepEqual(trace, ['now', 'target-kind']);
  return { value, trace, mutatedTypes: detectedProjectTypes, mutatedWarnings: warnings };
}
const outcomes = [];
for (const typeCount of [0, 1, 4]) for (const actionCount of [0, 1, 11, 12, 13, 20]) for (const duplicates of [0, 1, 2])
  for (const truncated of [false, true]) for (const directory of [false, true]) {
    const actual = run(typeCount, actionCount, duplicates, truncated, directory, false);
    if (old) assert.deepEqual(actual, run(typeCount, actionCount, duplicates, truncated, directory, true));
    outcomes.push(actual);
  }
function exceptional(mode, original) {
  const trace = [], failure = Error('controlled ' + mode);
  const clock = { now() { trace.push('now'); if (mode === 'clock') throw failure; return 1; } };
  const input = { details: {}, detectedProjectTypes: [{ id: 'known', confidence: 1 }], suggestedActions: [{ get command() { trace.push('command'); if (mode === 'command') throw failure; return 'run'; }, get cwd() { trace.push('cwd'); return '/project'; } }], entries: [{ name: 'entry', get isDirectory() { trace.push('directory'); if (mode === 'summary') throw failure; return true; }, isFile: false }], targetPath: '/project', readFiles: [], readmeText: '', rootPath: '/project', targetStat: { isDirectory() { trace.push('kind'); if (mode === 'kind') throw failure; return true; } }, totalEntryCount: 1, warnings: [], truncated: false };
  try { const result = original ? old(input, clock, ...Object.values(rules), 180) : createProjectInspectionResult(input, clock); return { ok: result.ok, trace }; }
  catch (error) { assert.strictEqual(error, failure); return { error: error.message, trace }; }
}
for (const mode of ['normal', 'command', 'summary', 'clock', 'kind']) {
  const actual = exceptional(mode, false);
  if (old) assert.deepEqual(actual, exceptional(mode, true));
  outcomes.push(actual);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, '9475b97e9b0899839ae211380bbf52d108edac939192a1d043d0572a853725af', 'Reviewed inspection result and evaluation order remain unchanged');
console.log('Project inspection result passed: ' + outcomes.length + ' sorting/dedup/collision/limits/fallback/identity/clock/error cases; hash ' + hash);
