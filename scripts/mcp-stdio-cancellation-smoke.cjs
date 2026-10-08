const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioClientService.cjs'), 'utf8');
const cancellation = fs.readFileSync(path.join(root, 'mcpStdioCancellation.cjs'), 'utf8');
const previous = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const ast = parse(cancellation);
assert.ok(cancellation.split('\n').length <= 300);
const functions = ast.statements.filter(ts.isFunctionDeclaration);
assert.deepEqual(functions.map(fn => fn.name.text), ['cancelMcpToolCall']);
assert.ok(ast.getLineAndCharacterOfPosition(functions[0].end).line - ast.getLineAndCharacterOfPosition(functions[0].getStart(ast)).line + 1 <= 50);
if (previous) {
  const printer = ts.createPrinter();
  const unchanged = text => {
    const tree = parse(text);
    const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMcpStdioClientService');
    return factory.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name.text === 'cancelToolCall')).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree));
  };
  assert.deepEqual(unchanged(source), unchanged(previous), 'Other instance methods and state must remain unchanged');
}

function load(text, MapBoundary, history) {
  const module = { exports: {} };
  new Function('require', 'module', '__dirname', 'Map', text)(name => {
    if (name === 'path') return path;
    if (name === './mcpStdioToolCallHandler.cjs') return require('../electron/mcpStdioToolCallHandler.cjs');
    if (name === './mcpStdioToolCatalog.cjs') return require('../electron/mcpStdioToolCatalog.cjs');
    if (name === './mcpStdioSessionManagement.cjs') return require('../electron/mcpStdioSessionManagement.cjs');
    if (name === './mcpStdioCancellation.cjs') {
      const child = { exports: {} };
      new Function('module', cancellation)(child);
      return child.exports;
    }
    // All other services are unused in these real-root cancellation scenarios.
    return {};
  }, module, root, MapBoundary);
  return module.exports.createMcpStdioClientService({ history });
}

function scenario(text, input, closeMode, observer, mapMode, metadata) {
  const calls = [];
  const closeError = new Error('close failure');
  const historyError = new Error('history failure');
  let state, recorded;
  const activeCall = {
    close() {
      assert.equal(this, activeCall);
      calls.push(['close']);
      if (closeMode === 'throw') throw closeError;
      return closeMode;
    },
    get serverId() {
      calls.push(['serverId']);
      if (metadata === 'server-throw') throw new Error('server metadata failure');
      return 'fixture-server';
    },
    get name() {
      calls.push(['name']);
      if (metadata === 'name-throw') throw new Error('name metadata failure');
      return 'fixture-tool';
    },
  };
  class ActiveMap extends Map {
    constructor() { super(); state = this; super.set('call', activeCall); }
    get(id) {
      calls.push(['get', id]);
      if (mapMode === 'get-throw') throw new Error('map get failure');
      return super.get(id);
    }
    delete(id) {
      calls.push(['delete', id]);
      if (mapMode === 'delete-throw') throw new Error('map delete failure');
      return super.delete(id);
    }
  }
  const history = observer === 'absent' ? null : {
    recordCancellation(result) {
      assert.equal(this, history);
      recorded = result;
      calls.push(['history', { ...result }]);
      if (observer === 'throw') throw historyError;
    },
  };
  const client = load(text, ActiveMap, history);
  let reads = 0;
  const request = input === 'null' ? null : input === 'undefined' ? undefined : input === 'absent' ? {} : {
    get requestId() {
      calls.push(['requestId']);
      reads += 1;
      if (input === 'throw') throw new Error('request getter failure');
      if (input === 'changing') return reads === 1 ? 'call' : 7;
      return { normal: 'call', whitespace: ' call ', blank: ' ', missing: 'missing', nonstring: 7 }[input];
    },
  };
  let outcome;
  try {
    const value = client.cancelToolCall(request);
    if (history) assert.equal(value, recorded, 'History must receive the returned result object');
    outcome = { value };
  } catch (error) {
    if (error.message === 'close failure') assert.equal(error, closeError);
    if (error.message === 'history failure') assert.equal(error, historyError);
    outcome = { error: error.message };
  }
  const kinds = calls.map(call => call[0]);
  if (['undefined', 'absent', 'blank', 'nonstring', 'null', 'throw', 'changing'].includes(input)) assert.ok(!kinds.includes('get'));
  if (kinds.includes('delete')) assert.ok(kinds.indexOf('close') < kinds.indexOf('delete'));
  if (kinds.includes('serverId')) assert.ok(kinds.indexOf('delete') < kinds.indexOf('serverId'));
  if (closeMode === 'throw' && kinds.includes('close')) {
    assert.ok(!kinds.includes('delete') && !kinds.includes('history'));
    assert.equal(state.size, 1);
  }
  if (kinds.includes('delete') && mapMode !== 'delete-throw') assert.equal(state.size, 0);
  if (kinds.includes('name')) assert.ok(kinds.indexOf('serverId') < kinds.indexOf('name'));
  if (outcome.value?.ok !== undefined) assert.equal(outcome.value.ok, closeMode);
  // Repeated cancellation observes the same per-instance active map.
  let repeated;
  try { repeated = { value: client.cancelToolCall({ requestId: 'call' }) }; }
  catch (error) { repeated = { error: error.message }; }
  return { outcome, repeated, calls, remaining: state.size };
}

function checkIsolation(text) {
  const maps = [], closed = [];
  class InstanceMap extends Map { constructor() { super(); maps.push(this); } }
  const first = load(text, InstanceMap, null), second = load(text, InstanceMap, null);
  assert.equal(maps.length, 2);
  assert.notEqual(maps[0], maps[1]);
  maps.forEach((map, index) => map.set('same-id', { serverId: `server-${index}`, name: 'tool', close() { closed.push(index); return true; } }));
  assert.equal(first.cancelToolCall({ requestId: 'same-id' }).serverId, 'server-0');
  assert.equal(maps[1].size, 1);
  assert.equal(first.cancelToolCall({ requestId: 'same-id' }).cancelled, false);
  assert.equal(second.cancelToolCall({ requestId: 'same-id' }).serverId, 'server-1');
  assert.deepEqual(closed, [0, 1]);
}

const results = [];
for (const input of ['normal', 'whitespace', 'blank', 'missing', 'nonstring', 'null', 'undefined', 'absent', 'throw', 'changing']) {
  for (const closeMode of [true, false, null, 'closed', 'throw']) {
    for (const observer of ['normal', 'absent', 'throw']) {
      for (const mapMode of ['normal', 'get-throw', 'delete-throw']) {
        for (const metadata of ['normal', 'server-throw', 'name-throw']) {
          const result = scenario(source, input, closeMode, observer, mapMode, metadata);
          if (previous) assert.deepEqual(result, scenario(previous, input, closeMode, observer, mapMode, metadata));
          results.push(result);
        }
      }
    }
  }
}
checkIsolation(source);
if (previous) checkIsolation(previous);
const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
const expected = 'b675eb5a33fe256568f49a0b771c13637fb92376289a9635b0ba6d3c6f3e1999';
assert.equal(digest, expected);
console.log(`MCP cancellation passed: ${results.length} real-root cases; ${digest}; repeated cancellation and two-instance isolation; no real process termination.`);
