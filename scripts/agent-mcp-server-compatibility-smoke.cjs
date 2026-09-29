const assert = require('assert/strict');
const { classifyMcpServerCompatibility } = require('../electron/mcpServerCompatibility.cjs');

function classify(input) {
  return classifyMcpServerCompatibility({
    command: 'custom-mcp',
    commandPathExists: null,
    cwdExists: true,
    error: '',
    ok: false,
    stderrSnippet: '',
    ...input,
  });
}

assert.equal(classify({ ok: true }).issueCode, 'ready');
assert.equal(classify({ cwdExists: false }).issueCode, 'cwd-missing');
assert.equal(classify({ command: 'node', error: 'spawn node ENOENT' }).issueCode, 'runtime-missing');
assert.equal(classify({ commandPathExists: false }).issueCode, 'command-missing');
assert.equal(classify({ error: 'spawn EPERM' }).issueCode, 'permission-denied');
assert.equal(classify({
  command: 'npx.cmd',
  stderrSnippet: 'npm error code ENOTFOUND',
}).issueCode, 'package-unavailable');
assert.equal(classify({ error: 'MCP request timed out: initialize' }).issueCode, 'startup-timeout');
assert.equal(classify({ error: 'MCP server exited code=1 signal=null' }).issueCode, 'server-crash');
assert.equal(classify({ error: 'unsupported protocol version' }).issueCode, 'protocol-or-startup-error');

for (const result of [
  classify({ error: 'spawn EPERM' }),
  classify({ command: 'npx.cmd', stderrSnippet: 'npm error code ENOTFOUND' }),
]) {
  assert.equal(typeof result.summary, 'string');
  assert.equal(typeof result.nextAction, 'string');
  assert.equal(JSON.stringify(result).includes('secret='), false);
}

console.log('agent MCP server compatibility smoke passed');
