const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const sourceFile = require.resolve('../electron/localProjectInspectorActions.cjs');
const selectionApi = require('../electron/localProjectInspectorActionSelection.cjs');
let oldFunction;
if (process.argv[2]) {
  const source = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile('baseline.cjs', source, ts.ScriptTarget.Latest, true);
  function visit(n) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'runLocalProjectAction') oldFunction = n.getText(tree);
    ts.forEachChild(n, visit);
  }
  visit(tree);
  assert.ok(oldFunction);
}
async function run(inspectionMode, kind, requestMode, behavior, original) {
  const trace = [], failure = Error('controlled failure');
  const first = { kind, command: 'first command', label: 'first label', risk: behavior === 'not-launch' ? 'inspect' : 'launch' };
  const second = { kind: 'open-path', command: 'second command', label: 'second label', risk: 'launch' };
  const inspection = inspectionMode === 'invalid' ? { ok: false, error: 'inspection failure' }
    : inspectionMode === 'empty' ? { ok: true, suggestedActions: [], rootPath: '/project' }
    : { ok: true, suggestedActions: [first, second], rootPath: '/project' };
  const request = {};
  let inspectionReads = 0;
  Object.defineProperty(request, 'inspection', { get() {
    trace.push(['inspection', ++inspectionReads]);
    return inspectionMode === 'fallback' ? false : inspectionMode === 'missing' ? undefined : inspection;
  } });
  if (requestMode === 'dry') request.dryRun = true;
  if (requestMode === 'second') request.actionIndex = 2;
  if (requestMode === 'invalid-index') request.actionIndex = 99;
  if (requestMode === 'command') request.command = first.command;
  if (requestMode === 'command-miss') request.command = 'missing';
  if (requestMode === 'label') request.label = 'second';
  if (requestMode === 'index-wins') { request.actionIndex = 1; request.command = second.command; }
  const shell = { name: 'controlled shell' };
  Object.defineProperty(request, 'shell', { get() { trace.push(['shell']); if (behavior === 'shell-throw') throw failure; return shell; } });
  function inspect(value) { assert.equal(value, request); trace.push(['inspect']); if (behavior === 'inspect-throw') throw failure; return inspection; }
  const execution = { name: 'execution' }, verification = { confidence: 'request-accepted' };
  const result = { ok: behavior !== 'failed', error: behavior === 'failed' ? 'execution failure' : undefined, execution, pid: behavior === 'zero-pid' ? 0 : undefined, verification };
  const clock = { now: () => 123456 };
  function terminal(action, givenClock) { assert.equal(givenClock, clock); trace.push(['terminal', action === first ? 'first' : 'second']); if (behavior === 'executor-throw') throw failure; return result; }
  async function open(action, givenShell, givenClock, branch) {
    assert.equal(givenShell, shell); assert.equal(givenClock, clock);
    trace.push([branch, action === first ? 'first' : 'second']);
    await Promise.resolve(); trace.push(['settled']);
    if (behavior === 'executor-throw') throw failure;
    return result;
  }
  const url = (a, s, c) => open(a, s, c, 'url'), openedPath = (a, s, c) => open(a, s, c, 'path');
  function log(message, details) { trace.push(['log', message, details]); if (behavior === 'log-throw') throw failure; }
  let runner;
  if (original) runner = new Function('inspectLocalProject', 'logMessage', 'findSuggestedActionSelection', 'openUrlAction', 'openPathAction', 'runTerminalCommand', 'Date', oldFunction + '\nreturn runLocalProjectAction;')(inspect, log, selectionApi.findSuggestedActionSelection, url, openedPath, terminal, clock);
  else {
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(sourceFile, 'utf8'))(id => {
      if (id.endsWith('ActionSelection.cjs')) return selectionApi;
      if (id.endsWith('OpenUrl.cjs')) return { openUrlAction: url };
      if (id.endsWith('OpenPath.cjs')) return { openPathAction: openedPath };
      if (id.endsWith('Terminal.cjs')) return { runTerminalCommand: terminal };
      throw Error('Unexpected dependency ' + id);
    }, module);
    const dependencies = { inspectLocalProject: inspect, logMessage: log, clock };
    runner = module.exports.createProjectActionRunner(dependencies);
    assert.notEqual(runner, module.exports.createProjectActionRunner(dependencies));
  }
  let value, error;
  try { value = await runner(request); } catch (e) { assert.equal(e, failure); error = e.message; }
  if (value) {
    assert.equal(value.inspection, inspection);
    if (value.action) assert.ok(value.action === first || value.action === second);
    if (value.execution) { assert.equal(value.execution, execution); assert.equal(value.verification, verification); }
    assert.ok(!Object.hasOwn(value, 'ready'));
    value = { ...value, inspection: 'original-inspection', ...(value.action ? { action: value.action === first ? 'first' : 'second' } : {}) };
  }
  if (['invalid', 'empty'].includes(inspectionMode) || requestMode === 'dry' || behavior === 'not-launch' && !['second', 'label'].includes(requestMode)) assert.ok(!trace.some(row => ['url', 'path', 'terminal'].includes(row[0])));
  return { value, error, trace };
}
async function main() {
  const outcomes = [];
  for (const inspection of ['valid', 'invalid', 'empty', 'fallback', 'missing']) for (const kind of ['open-url', 'open-path', 'terminal-command', 'unknown'])
    for (const request of ['default', 'dry', 'second', 'invalid-index', 'command', 'command-miss', 'label', 'index-wins'])
      for (const behavior of ['normal', 'failed', 'zero-pid', 'not-launch', 'inspect-throw', 'shell-throw', 'executor-throw', 'log-throw']) {
        const actual = await run(inspection, kind, request, behavior, false);
        if (oldFunction) assert.deepEqual(actual, await run(inspection, kind, request, behavior, true));
        outcomes.push(actual);
      }
  const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
  assert.equal(hash, 'e110bfcf0d6d40a45f7357628d0fd6eca00baedc454619d9296c641033cedec5', 'Reviewed action orchestration and call order remain unchanged');
  console.log('Project action orchestration passed: ' + outcomes.length + ' selection/dry-run/dispatch/identity/log/error/order cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
