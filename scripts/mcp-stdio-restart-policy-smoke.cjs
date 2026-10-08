const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioSessionRestartPolicy.cjs'), 'utf8');
const texts = Object.fromEntries(['Rules', 'StatusStore', 'Recorder'].map(suffix => {
  const name = suffix === 'Rules' ? 'mcpStdioRestartPolicyRules.cjs' : `mcpStdioRestart${suffix}.cjs`;
  return ['./' + name, fs.readFileSync(path.join(root, name), 'utf8')];
}));
const previous = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const trees = [source, ...Object.values(texts)].map(parse);
function functions(tree) {
  const found = [];
  function walk(node) { if (ts.isFunctionDeclaration(node)) found.push(node); ts.forEachChild(node, walk); }
  walk(tree); return found;
}
const currentFunctions = trees.flatMap(tree => functions(tree).map(fn => ({ fn, tree })));
for (const tree of trees) {
  assert.ok(tree.text.split('\n').length <= 300);
  for (const fn of functions(tree)) assert.ok(tree.getLineAndCharacterOfPosition(fn.end).line - tree.getLineAndCharacterOfPosition(fn.getStart(tree)).line + 1 <= 50);
}
if (previous) {
  const oldTree = parse(previous), printer = ts.createPrinter();
  for (const fn of functions(oldTree).filter(fn => fn.name.text !== 'createMcpStdioSessionRestartPolicy')) {
    const next = currentFunctions.find(item => item.fn.name.text === fn.name.text);
    assert.ok(next);
    assert.equal(printer.printNode(ts.EmitHint.Unspecified, fn, oldTree), printer.printNode(ts.EmitHint.Unspecified, next.fn, next.tree), 'Original helper and policy method AST must stay unchanged');
  }
}
const encode = value => JSON.stringify(value, (_, v) => v === undefined ? '$undefined' : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
function load(text, clock, MapBoundary = Map) {
  const requireLocal = name => {
    assert.ok(Object.hasOwn(texts, name), 'Unexpected restart dependency: ' + name);
    const module = { exports: {} };
    new Function('require', 'module', 'Date', texts[name])(requireLocal, module, { now: clock });
    return module.exports;
  };
  const module = { exports: {} };
  new Function('require', 'module', 'Date', 'Map', text)(requireLocal, module, { now: clock }, MapBoundary);
  return module.exports.createMcpStdioSessionRestartPolicy;
}

function scenario(text, pairMode, clockMode, idMode, errorMode) {
  const calls = [], outcomes = [];
  let ticks = 0, time = 1000, idReads = 0, mutable;
  const clockError = new Error('clock failure');
  const clock = () => {
    ticks += 1; calls.push(['now', ticks]);
    if (clockMode === 'throw-first' && ticks === 1 || clockMode === 'throw-third' && ticks === 3) throw clockError;
    if (clockMode === 'nan') return NaN;
    if (clockMode === 'increasing') time += 100;
    return time;
  };
  class StatusMap extends Map {
    constructor() { super(); mutable = this; calls.push(['map']); }
    has(id) { calls.push(['has', id]); return super.has(id); }
    get(id) { calls.push(['get', id]); return super.get(id); }
    set(id, value) { calls.push(['set', id, { ...value }]); return super.set(id, value); }
    delete(id) { calls.push(['delete', id]); return super.delete(id); }
    clear() { calls.push(['clear']); return super.clear(); }
  }
  const pairs = { defaults: [undefined, undefined], zero: [0, 0], cap: [10, 5], fraction: [1.5, 2.4], negative: [-5, 40000], nonfinite: [Infinity, 'bad'], strings: ['10', '20'], coercion: [{ valueOf() { calls.push(['base-coerce']); throw new Error('backoff coercion failure'); } }, 10], 'max-throw': [10, 20] };
  const pair = pairs[pairMode];
  const options = {
    get now() { calls.push(['option', 'now']); if (clockMode === 'option-throw') throw new Error('now option failure'); return clockMode === 'default' ? 7 : clock; },
    get baseBackoffMs() { calls.push(['option', 'base']); return pair[0]; },
    get maxBackoffMs() { calls.push(['option', 'max']); if (pairMode === 'max-throw') throw new Error('max option failure'); return pair[1]; },
  };
  const ids = { normal: ' server ', blank: ' ', null: null, number: 7, symbol: Symbol('server'), changing: { toString() { idReads += 1; calls.push(['id-string', idReads]); return `server-${idReads}`; } } };
  const errors = { normal: new Error('failure'), undefined, empty: '', null: null, symbol: Symbol('failure'), coercion: { toString() { calls.push(['error-string']); throw new Error('error coercion failure'); } } };
  let policy;
  try { policy = load(text, clock, StatusMap)(options); }
  catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    return { constructorError: error.message, calls };
  }
  assert.ok(!calls.some(call => call[0] === 'now'), 'Construction must not read time');
  assert.deepEqual(Object.keys(policy), ['getGate', 'getStatus', 'listStatuses', 'recordFailure', 'recordStart', 'recordSuccess', 'reset', 'resetAll']);
  const invoke = (name, ...args) => {
    try {
      const value = policy[name](...args);
      if (name === 'getStatus') assert.ok(![...Map.prototype.values.call(mutable)].includes(value), 'Returned status must be a snapshot');
      outcomes.push([name, encode(value)]);
      if (name === 'getStatus') {
        value.lastError = 'client-mutation';
        assert.ok([...Map.prototype.values.call(mutable)].every(status => status.lastError !== 'client-mutation'), 'Caller mutation must not modify internal status');
      }
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      if (error.message === 'clock failure') assert.equal(error, clockError);
      outcomes.push([name, { error: error.message }]);
    }
  };
  const id = ids[idMode], error = errors[errorMode];
  invoke('getStatus', id); invoke('getGate', id); invoke('recordStart', id);
  invoke('recordFailure', id, error); invoke('getGate', id);
  time += 5;
  invoke('recordFailure', id, error); invoke('listStatuses');
  time += 100000;
  invoke('getGate', id); invoke('recordSuccess', id); invoke('getStatus', id);
  invoke('reset', id); invoke('resetAll'); invoke('getStatus', id); invoke('listStatuses');
  return { calls, outcomes };
}

function checkIsolation(text) {
  let now = 100;
  const create = load(text, () => now);
  const first = create({ now: () => now, baseBackoffMs: 10, maxBackoffMs: 25 });
  const second = create({ now: () => now, baseBackoffMs: 10, maxBackoffMs: 25 });
  assert.equal(first.recordFailure('same-id', 'failure').nextRestartAt, 110);
  assert.equal(first.recordFailure('same-id', 'failure').nextRestartAt, 120);
  assert.equal(first.recordFailure('same-id', 'failure').nextRestartAt, 125);
  assert.equal(second.getGate('same-id').allowed, true);
  assert.equal(first.getGate('same-id').allowed, false);
  now = 125;
  assert.equal(first.getGate('same-id').allowed, true);
  second.recordFailure('same-id', 'failure');
  first.resetAll();
  assert.equal(second.getStatus('same-id').consecutiveFailures, 1);
  assert.equal(first.listStatuses().length, 0);
}

const results = [];
for (const pairMode of ['defaults', 'zero', 'cap', 'fraction', 'negative', 'nonfinite', 'strings', 'coercion', 'max-throw']) {
  for (const clockMode of ['stable', 'increasing', 'default', 'throw-first', 'throw-third', 'nan', 'option-throw']) {
    for (const idMode of ['normal', 'blank', 'null', 'number', 'symbol', 'changing']) for (const errorMode of ['normal', 'undefined', 'empty', 'null', 'symbol', 'coercion']) {
      const result = scenario(source, pairMode, clockMode, idMode, errorMode);
      if (previous) assert.deepEqual(result, scenario(previous, pairMode, clockMode, idMode, errorMode));
      results.push(result);
    }
  }
}
checkIsolation(source);
if (previous) checkIsolation(previous);
const digest = crypto.createHash('sha256').update(encode(results)).digest('hex');
const expected = '3c7dcb614ba1b31a1887f53589791122219152a115c63fe75757cfb66d1685bc';
assert.equal(digest, expected);
console.log(`MCP restart policy passed: ${results.length} actual-policy cases; ${digest}; backoff cap/clock order/snapshot/two-instance isolation; no external calls.`);
