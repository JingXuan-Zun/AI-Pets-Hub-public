const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rules = require('../electron/mcpStdioClientRules.cjs');
const { parseJsonObject } = require('../electron/mcpServerConfigLoader.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'electron/mcpStdioClientRules.cjs'), 'utf8');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const ast = parse(source);
const names = ['createTextContent', 'normalizeToolContent', 'normalizeToolCallResult', 'inferMcpCallErrorStatus', 'createCooldownToolCallResult', 'createSchemaRejectedToolCallResult', 'createFieldPolicyDeniedToolCallResult', 'shouldRecordServerFailure'];
assert.deepEqual(Object.keys(rules), names);
assert.ok(source.split('\n').length <= 300);
const functions = ast.statements.filter(ts.isFunctionDeclaration);
assert.equal(functions.length, 8);
for (const fn of functions) assert.ok(ast.getLineAndCharacterOfPosition(fn.end).line - ast.getLineAndCharacterOfPosition(fn.getStart(ast)).line + 1 <= 50);
let previous;
if (process.argv[2]) {
  const oldAst = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const moved = oldAst.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text));
  assert.deepEqual(moved.map(n => n.getText(oldAst)), functions.map(n => n.getText(ast)));
  previous = new Function('parseJsonObject', moved.map(n => n.getText(oldAst)).join('\n') + '\nreturn {' + names.join(',') + '};')(parseJsonObject);
  const nextAst = parse(fs.readFileSync(path.join(root, 'electron/mcpStdioClientService.cjs'), 'utf8'));
  const printer = ts.createPrinter();
  const imports = n => ts.isVariableStatement(n) && n.getText().includes('require(');
  const print = (n, tree) => printer.printNode(ts.EmitHint.Unspecified, n, tree);
  assert.deepEqual(oldAst.statements.filter(n => !moved.includes(n) && !imports(n)).map(n => print(n, oldAst)), nextAst.statements.filter(n => !imports(n)).map(n => print(n, nextAst)));
}

function outcome(api, name, args) {
  try {
    const value = api[name](...args);
    const identities = name === 'normalizeToolCallResult' ? { structured: value.structuredContent === args[0]?.structuredContent } :
      name === 'createSchemaRejectedToolCallResult' ? { validation: value.structuredContent.schemaValidation === args[0] } :
      name === 'createFieldPolicyDeniedToolCallResult' ? { decision: value.structuredContent.fieldPolicy === args[0] } :
      name === 'createCooldownToolCallResult' ? { status: value.structuredContent.mcpServerHealth === args[1].status } : undefined;
    return { value, identities };
  } catch (error) { return { error: error.name, message: error.message }; }
}
const results = [];
function check(name, args) {
  const result = outcome(rules, name, args);
  if (previous) assert.deepEqual(result, outcome(previous, name, args));
  results.push({ name, result });
}
const values = [undefined, null, false, true, 0, -1, 0.49, 0.5, NaN, Infinity, '', ' text ', [], {}, 3n, Symbol('fixture'), { toString() { throw new Error('string conversion'); } }];
const cyclic = {}; cyclic.self = cyclic;
for (const value of [...values, cyclic]) {
  check('createTextContent', [value]);
  check('normalizeToolContent', [value]);
  check('normalizeToolContent', [{ type: 'text', text: value }]);
  check('normalizeToolCallResult', [value]);
  check('normalizeToolCallResult', [{ content: [null, value, { type: 'text', text: 'hello' }], isError: value, structuredContent: { fixture: 1 } }]);
  check('inferMcpCallErrorStatus', [value]);
  check('shouldRecordServerFailure', [value]);
  check('createFieldPolicyDeniedToolCallResult', [{ reason: value, allowed: false }]);
}
for (const content of [undefined, null, [], [{ type: 'image', data: 'fixture' }], [{ type: 'text', text: null }], Array(2), 'ignored']) {
  for (const structuredContent of values) {
    for (const isError of [undefined, false, true, 'false']) check('normalizeToolCallResult', [{ content, structuredContent, isError }]);
  }
}
for (const waitMs of values) {
  for (const reason of [undefined, '', ' custom reason ', false, 7]) check('createCooldownToolCallResult', [{ id: 'fixture' }, { waitMs, reason, status: { status: 'unhealthy' } }]);
}
for (const validation of [undefined, null, false, { ok: false, errors: ['invalid'] }, { error: 'mcp_tool_schema_unavailable', errors: [], ok: false, truncated: false }]) check('createSchemaRejectedToolCallResult', [validation]);
for (const message of ['timeout', 'TIMED OUT', 'cancelled', 'canceled', 'closed', 'timeout then closed', 'failure', '']) {
  check('inferMcpCallErrorStatus', [new Error(message)]);
  check('inferMcpCallErrorStatus', [{ message }]);
  check('shouldRecordServerFailure', [message]);
}
assert.equal(rules.inferMcpCallErrorStatus(new Error('closed after timeout')), 'timeout');
assert.equal(rules.shouldRecordServerFailure('cancelled'), false);
assert.equal(rules.shouldRecordServerFailure('timeout'), true);
assert.deepEqual(rules.normalizeToolCallResult({ content: [], structuredContent: [] }), { content: [], isError: false, structuredContent: null });
assert.deepEqual(rules.normalizeToolContent({ type: 'image', data: 'fixture' }), { text: '{"type":"image","data":"fixture"}', type: 'json' });
assert.equal(rules.createCooldownToolCallResult({ id: 'fixture' }, { waitMs: -1 }).structuredContent.retryAfterMs, 0);
assert.equal(rules.createCooldownToolCallResult({ id: 'fixture' }, { waitMs: 0.5 }).structuredContent.retryAfterMs, 1);
const encode = (_, value) => value === cyclic ? '<fixture-cycle>' : typeof value === 'bigint' ? 'bigint:' + value : typeof value === 'symbol' ? String(value) : typeof value === 'number' && !Number.isFinite(value) ? String(value) : value;
const digest = crypto.createHash('sha256').update(JSON.stringify(results, encode)).digest('hex');
const expected = '0d8766525e0dc9a976e0775d26610abccf365274a631a09580ca2e515fbb2d77';
assert.equal(digest, expected);
console.log(`MCP stdio client rules passed: ${results.length} cases; ${digest}${previous ? '; original functions and remaining root AST unchanged' : ''}; no external calls.`);
