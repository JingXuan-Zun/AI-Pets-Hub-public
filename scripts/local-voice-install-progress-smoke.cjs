const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeCommandUtils.cjs');
const { createInstallProgressReporter } = require(modulePath);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function originalFactory() {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', baseline)(createRequire(modulePath), module, module.exports);
  return module.exports.createInstallProgressReporter;
}
function scenario(config, original = false) {
  const trace = [], history = [], failure = new Error('progress failure');
  let reporter, progressCount = 0, messageCount = 0, reentered = false;
  const onProgress = config.progress ? snapshot => {
    trace.push(['progress', structuredClone(snapshot)]);
    if (++progressCount === config.failProgress) throw failure;
    if (config.mutate) { snapshot.messages.push('external'); snapshot.missingPackages.push('external'); }
    if (config.reenter === 'progress' && !reentered) { reentered = true; reporter.setStage('reentrant'); }
  } : undefined;
  const onMessage = config.message ? text => {
    trace.push(['message', text]);
    if (++messageCount === config.failMessage) throw failure;
    if (config.reenter === 'message' && !reentered) { reentered = true; reporter.push('inner'); }
  } : null;
  reporter = (original ? originalFactory() : createInstallProgressReporter)(onProgress, onMessage);
  assert.deepEqual(trace, [], 'creation emits no progress');
  const methods = Object.keys(reporter);
  const objectError = { toString() { trace.push(['error-string']); if (config.failString) throw failure; return 'converted-error'; } };
  const objectMessage = { toString() { trace.push(['message-string']); if (config.failString) throw failure; return ' converted message '; } };
  const operations = [
    ['setStage', 'installing'], ['setExecutable', 'python'], ['setExecutable', ''],
    ['setError', objectError], ['setError', 0], ['setMissingPackages', [' torch ', 'torch', '', 'numpy']],
    ['setMissingPackages', null], ['push', ' \x1b[32mDownloading\x1b[0m '], ['push', 'Downloading'],
    ['push', '  '], ['push', objectMessage], ['push', null],
    ...Array.from({ length: config.long ? 85 : 2 }, (_, i) => ['push', 'message-' + i]),
    ['push', 'Downloading'], ['setStage', 'done'],
  ];
  for (const [method, value] of operations) {
    let result, error;
    try { result = reporter[method](value); } catch (e) { error = e === failure ? 'original-error' : e.message; }
    const messages = reporter.getMessages(); history.push({ method, result, error, messages: [...messages] });
    messages.push('external-getMessages');
    assert.equal(reporter.getMessages().includes('external-getMessages'), false);
  }
  return { trace, history, methods, messages: reporter.getMessages() };
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  for (const item of actual.history) if (item.error !== undefined) assert.equal(item.error, 'original-error');
  assert.ok(actual.messages.length <= 80);
  assert.equal(actual.messages.includes('external'), false);
  return actual;
}
let count = 0;
for (const progress of [true, false]) for (const message of [true, false]) for (const long of [true, false]) {
  for (const mutate of [true, false]) for (const reenter of [undefined, 'message', 'progress']) {
    for (const fail of [undefined, 'progress-first', 'progress-second', 'message-first', 'message-second', 'string']) {
      compare({ progress, message, long, mutate, reenter,
        failProgress: fail === 'progress-first' ? 1 : fail === 'progress-second' ? 2 : undefined,
        failMessage: fail === 'message-first' ? 1 : fail === 'message-second' ? 2 : undefined,
        failString: fail === 'string' }); count++;
    }
  }
}
const normal = compare({ progress: true, message: true, long: true, mutate: true });
assert.equal(normal.messages.length, 80);
assert.equal(normal.messages[0], 'message-6');
assert.equal(normal.messages.at(-1), 'Downloading');
assert.equal(normal.trace.filter(t => t[0] === 'message' && t[1] === 'Downloading').length, 3);
assert.equal(normal.history.find(h => h.method === 'push').messages.length, 1);
assert.deepEqual(normal.trace.filter(t => t[0] === 'message' || t[0] === 'progress').slice(7, 11).map(t => t[0]),
  ['message', 'progress', 'message', 'progress']);
const reentrant = compare({ progress: true, message: true, reenter: 'message' });
const messageIndex = reentrant.trace.findIndex(t => t[0] === 'message');
assert.deepEqual(reentrant.trace.slice(messageIndex, messageIndex + 4).map(t => t[0]), ['message', 'message', 'progress', 'progress']);
assert.equal(reentrant.trace[messageIndex + 3][1].currentStep, 'inner');
const failedMessage = compare({ progress: true, message: true, failMessage: 1 });
assert.equal(failedMessage.history.find(h => h.method === 'push').error, 'original-error');
assert.equal(failedMessage.history.find(h => h.method === 'push').messages[0], 'Downloading');
const a = createInstallProgressReporter(), b = createInstallProgressReporter(); a.push('first'); assert.deepEqual(b.getMessages(), []);
const source = fs.readFileSync(modulePath, 'utf8'); assert.ok(source.split('\n').length <= 300);
const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function walk(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
  ts.forEachChild(n, walk);
}
walk(ast);
console.log(`local voice install progress: ${count} state/history/callback/reentrancy/error cases, instance isolation passed${baseline ? ' against baseline' : ''}`);
