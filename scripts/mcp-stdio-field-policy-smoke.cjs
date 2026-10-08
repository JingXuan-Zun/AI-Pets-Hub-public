const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpFieldPolicy.cjs'), 'utf8');
const texts = Object.fromEntries(['mcpFieldPolicyRules.cjs', 'mcpFieldPolicyResolvedRule.cjs'].map(name => ['./' + name, fs.readFileSync(path.join(root, name), 'utf8')]));
const previous = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function functions(tree) {
  const found = [];
  function walk(node) { if (ts.isFunctionDeclaration(node)) found.push(node); ts.forEachChild(node, walk); }
  walk(tree); return found;
}
for (const text of [source, ...Object.values(texts)]) {
  const tree = parse(text);
  assert.ok(text.split('\n').length <= 300);
  for (const fn of functions(tree)) assert.ok(tree.getLineAndCharacterOfPosition(fn.end).line - tree.getLineAndCharacterOfPosition(fn.getStart(tree)).line + 1 <= 50);
}
if (previous) {
  const oldTree = parse(previous), rulesTree = parse(texts['./mcpFieldPolicyRules.cjs']), resolvedTree = parse(texts['./mcpFieldPolicyResolvedRule.cjs']), printer = ts.createPrinter();
  const print = (node, tree) => printer.printNode(ts.EmitHint.Unspecified, node, tree);
  for (const fn of functions(oldTree).filter(fn => fn.name.text !== 'evaluateMcpFieldPolicy')) assert.equal(print(fn, oldTree), print(functions(rulesTree).find(n => n.name.text === fn.name.text), rulesTree), 'Pure helper AST must remain unchanged');
  assert.deepEqual(oldTree.statements.filter(ts.isVariableStatement).map(n => print(n, oldTree)), rulesTree.statements.filter(ts.isVariableStatement).map(n => print(n, rulesTree)));
  const oldEvaluate = functions(oldTree).find(fn => fn.name.text === 'evaluateMcpFieldPolicy');
  const oldLoop = oldEvaluate.body.statements.find(ts.isForOfStatement);
  const statements = [...oldLoop.statement.statements];
  const split = statements.findIndex(n => ts.isIfStatement(n) && n.expression.getText(oldTree).includes("rawRule.mode === 'allow-items'"));
  const newBody = functions(resolvedTree)[0].body.statements;
  assert.deepEqual(statements.slice(split).map(n => print(n, oldTree).replace(/continue;/g, 'return null;')), [...newBody].slice(0, -1).map(n => print(n, resolvedTree)), 'Only loop continuation becomes a neutral helper result');
}
function load(text) {
  const cache = new Map();
  const requireLocal = name => {
    assert.ok(Object.hasOwn(texts, name), 'Unexpected field-policy dependency: ' + name);
    if (!cache.has(name)) {
      const module = { exports: {} };
      new Function('require', 'module', texts[name])(requireLocal, module);
      cache.set(name, module.exports);
    }
    return cache.get(name);
  };
  const module = { exports: {} };
  new Function('require', 'module', text)(requireLocal, module);
  assert.deepEqual(Object.keys(module.exports), ['evaluateMcpFieldPolicy']);
  return module.exports.evaluateMcpFieldPolicy;
}
const current = load(source), old = previous ? load(previous) : null;
function evaluate(fn, config, request, expectedError) {
  try {
    const decision = fn(config, request);
    assert.ok(!JSON.stringify(decision).includes('secret-marker-300'), 'Decisions must not expose argument values');
    return { decision };
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    if (expectedError && error.message === expectedError.message) assert.equal(error, expectedError);
    return { error: { name: error.name, message: error.message } };
  }
}
const results = [];
function compare(config, request) {
  const result = evaluate(current, config, request);
  if (old) assert.deepEqual(result, evaluate(old, config, request));
  results.push(result);
}
const pointers = ['', '/value', '/nested/value', '/tuple/0', '/tuple/01', '/a~1b', '/t~0x', '/__proto__', '/constructor', '/prototype', '/bad~2', '/', '/' + 'x'.repeat(256), '/a/b/c/d/e/f/g/h', '/a/b/c/d/e/f/g/h/i'];
const argumentsValues = [
  { value: 1, nested: { value: 1 }, tuple: [1], 'a/b': 1, 't~x': 1 },
  { value: 'secret-marker-300', nested: { value: 'secret-marker-300' } },
  { value: [1] }, { value: [] }, { value: new Array(1) },
  { value: Array(1025).fill(1) }, { value: [{}] }, Object.create({ value: 1 }), null, undefined,
];
for (const pointer of pointers) for (const mode of ['allow', 'allow-items', 'deny', 'deny-items']) {
  for (const values of [undefined, [], [1], [0, -0, NaN, null, 'safe', true], new Array(1), Array(33).fill(1), ['x'.repeat(513)]]) {
    for (const args of argumentsValues) compare({ policies: { tools: { 'server/tool': { fields: { [pointer]: { mode, values } } } } } }, { serverId: ' server ', toolName: ' tool ', arguments: args });
  }
}
for (const config of [undefined, null, {}, { fieldPolicyConfigInvalid: true }, { policies: [] }, { policies: { tools: [] } }, { policies: { tools: { 'server/tool': null } } }, { policies: { tools: { 'server/tool': {} } } }, { policies: { tools: { 'server/tool': { fields: [] } } } }, { policies: { tools: { 'server/tool': { fields: Object.fromEntries(Array.from({ length: 33 }, (_, i) => ['/x' + i, { mode: 'deny' }])) } } } }]) {
  for (const request of [{ serverId: 'server', toolName: 'tool', arguments: {} }, {}, null]) compare(config, request);
}
for (const fields of [
  { '/value': { mode: 'deny' }, '/later': { mode: 'unknown' } },
  { '/missing': { mode: 'deny' }, '/value': { mode: 'deny' } },
  { '/missing': { mode: 'unknown' }, '/value': { mode: 'deny' } },
  { '/value': { mode: 'allow', values: [1] }, '/later': { mode: 'deny' } },
]) compare({ policies: { tools: { 'server/tool': { fields } } } }, { serverId: 'server', toolName: 'tool', arguments: { value: 1, later: 1 } });

function observed(fn, target, nth, changing) {
  const calls = [], counts = new Map(), cache = new WeakMap(), failure = new Error('getter failure');
  const wrap = (value, prefix) => {
    if (!value || typeof value !== 'object') return value;
    if (cache.has(value)) return cache.get(value);
    const proxy = new Proxy(value, {
      get(object, key, receiver) {
        const name = prefix + '.' + String(key), count = (counts.get(name) || 0) + 1;
        counts.set(name, count); calls.push(['get', name, count]);
        if (name === target && count === nth) {
          if (!changing) throw failure;
          return name.endsWith('.mode') ? 'deny-items' : null;
        }
        return wrap(Reflect.get(object, key, receiver), name);
      },
      ownKeys(object) { calls.push(['keys', prefix]); return Reflect.ownKeys(object); },
      getOwnPropertyDescriptor(object, key) { calls.push(['own', prefix + '.' + String(key)]); return Reflect.getOwnPropertyDescriptor(object, key); },
    });
    cache.set(value, proxy); return proxy;
  };
  const config = wrap({ policies: { tools: { 'server/tool': { fields: { '/value': { mode: 'allow', values: [1] } } } } } }, 'config');
  const request = wrap({ serverId: 'server', toolName: 'tool', arguments: { value: 1 } }, 'request');
  return { result: evaluate(fn, config, request, failure), calls };
}
for (const target of ['config.fieldPolicyConfigInvalid', 'config.policies', 'config.policies.tools', 'config.policies.tools.server/tool', 'config.policies.tools.server/tool.fields', 'config.policies.tools.server/tool.fields./value.mode', 'config.policies.tools.server/tool.fields./value.values', 'request.serverId', 'request.toolName', 'request.arguments', 'request.arguments.value']) {
  for (const nth of [1, 2, 3]) for (const changing of [false, true]) {
    const result = observed(current, target, nth, changing);
    if (old) assert.deepEqual(result, observed(old, target, nth, changing));
    results.push(result);
  }
}
const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
const expected = '7cf43db95e30214e24c149d2f0f2becca65399e428abf1b53f025bd28dcb7639';
assert.equal(digest, expected);
console.log(`MCP field policy passed: ${results.length} actual-policy cases; ${digest}; pointer/scalar/array/order/getter/error contracts; no external calls.`);
