const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchDevToolsClient.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const fn = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createDevToolsClient');
  assert.ok(fn);
  oldSource = fn.getText(t) + '\nmodule.exports = { createDevToolsClient };';
  const printer = ts.createPrinter();
  const retained = t.statements.filter(n => n !== fn).map(n => printer.printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  const current = ts.createSourceFile(rootFile, fs.readFileSync(rootFile, 'utf8'), ts.ScriptTarget.Latest, true);
  assert.equal(current.statements.filter(n => !n.getText(current).includes("require('./browserSearchDevToolsClient.cjs')")).map(n => printer.printNode(ts.EmitHint.Unspecified, n, current)).join('\n'), retained, 'Remaining production statements unchanged');
}
async function run(startup, sendMode, count, responseMode, ending, original) {
  const trace = [], sockets = [], failure = Error('controlled transport failure');
  class Socket {
    static get OPEN() { trace.push(['OPEN']); return 1; }
    constructor(url) { trace.push(['construct', url]); if (startup === 'constructor-throw') throw failure; this.readyState = 1; sockets.push(this); }
    send(payload) {
      assert.equal(this, sockets[0]); trace.push(['send', payload]);
      if (sendMode === 'send-throw' && JSON.parse(payload).id === 1) throw failure;
      if (sendMode === 'reentrant') this.onmessage({ data: JSON.stringify({ id: JSON.parse(payload).id, result: { sync: true } }) });
    }
    close() { trace.push(['close']); if (ending === 'close-throw') throw failure; this.onclose(); }
  }
  const globals = {};
  Object.defineProperty(globals, 'WebSocket', { get() { trace.push(['WebSocket']); return startup === 'missing' ? undefined : startup === 'invalid' ? {} : Socket; } });
  const module = { exports: {} };
  new Function('module', 'global', original ? oldSource : source)(module, globals);
  const connection = module.exports.createDevToolsClient('ws://controlled/devtools');
  const connected = connection.then(value => ({ value }), error => ({ error }));
  if (startup === 'pre-error') sockets[0].onerror();
  else if (startup === 'normal') sockets[0].onopen();
  const connectionResult = await connected;
  if (startup !== 'normal') {
    if (startup === 'constructor-throw') assert.equal(connectionResult.error, failure);
    assert.ok(connectionResult.error instanceof Error);
    return { trace, error: connectionResult.error.message };
  }
  const client = connectionResult.value, ws = sockets[0];
  assert.deepEqual(Object.keys(client), ['send', 'close']);
  const commands = [], results = [], errors = [];
  function track(index, operation) {
    let next;
    try { next = operation(); } catch (error) { next = Promise.reject(error); }
    commands.push(next.then(value => { results[index] = { value }; }, error => { errors[index] = error; results[index] = { error: error.message }; }));
  }
  if (sendMode === 'closed') ws.readyState = 3;
  for (let i = 0; i < count; i++) {
    const params = i === 0 && sendMode === 'serialization-throw' ? { toJSON() { throw failure; } } : { index: i };
    track(i, () => client.send('Runtime.test', params));
    ws.readyState = 1;
  }
  // Repeated open keeps the same command sequence and pending queue.
  ws.onopen();
  track(count, () => client.send('Runtime.followup'));
  const ids = trace.filter(row => row[0] === 'send').map(row => JSON.parse(row[1]).id);
  assert.equal(ids.at(-1), count + 1 - (sendMode === 'closed' ? 1 : 0));
  for (const data of ['', 'invalid', 'null', '{}', JSON.stringify({ id: '1', result: 'ignored' }), JSON.stringify({ id: 9999 })]) ws.onmessage({ data });
  if (responseMode !== 'pending') for (const id of [...ids].reverse()) {
    const data = responseMode === 'error' ? { id, error: { message: 'command failed' } } : responseMode === 'empty-error' ? { id, error: {} } : responseMode === 'missing-result' ? { id } : { id, result: { id, answer: '中文' } };
    ws.onmessage({ data: JSON.stringify(data) });
    ws.onmessage({ data: JSON.stringify({ id, result: 'duplicate ignored' }) });
  }
  if (ending === 'error') ws.onerror();
  else if (ending === 'close-throw') { client.close(); ws.onclose(); }
  else client.close();
  await Promise.all(commands);
  if (sendMode === 'serialization-throw' || sendMode === 'send-throw') assert.equal(errors[0], failure);
  if (sendMode === 'closed') assert.equal(errors[0].message, 'DevTools websocket is not open');
  if (responseMode === 'pending' && sendMode !== 'reentrant') {
    const shared = errors.filter(error => error && error !== failure && error.message !== 'DevTools websocket is not open');
    assert.ok(shared.length > 0); assert.ok(shared.every(error => error === shared[0]), 'Cleanup uses the same error for all pending commands');
  }
  return { trace, results };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  async function check(...args) {
    const actual = await run(...args, false);
    if (oldSource) assert.deepEqual(actual, await run(...args, true));
    fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
  }
  for (const startup of ['missing', 'invalid', 'constructor-throw', 'pre-error']) await check(startup, 'normal', 1, 'pending', 'close');
  for (const mode of ['normal', 'closed', 'serialization-throw', 'send-throw', 'reentrant']) for (const count of [1, 2, 4])
    for (const response of ['success', 'error', 'empty-error', 'missing-result', 'pending']) for (const ending of ['close', 'error', 'close-throw']) await check('normal', mode, count, response, ending);
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '98eaa3858c457e84c911588e9b5817d2e246e2b820a57a97fa95c12e7a372386', 'Reviewed DevTools protocol and event order remain unchanged');
  console.log('DevTools client passed: ' + cases + ' startup/sequence/response/reentrant/send/cleanup/close/error cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
