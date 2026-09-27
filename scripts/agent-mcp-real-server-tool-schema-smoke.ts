import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseMcpRealServerToolSchemaArgs,
  runMcpRealServerToolSchema,
} from './agent-mcp-real-server-tool-schema.ts';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-tool-schema-'));
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
const previousEnvConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;

fs.writeFileSync(path.join(tempRoot, '.desktop-pet-mcp.json'), `${JSON.stringify({
  servers: [{
    args: [fakeServerPath],
    command: process.execPath,
    id: 'schema-fake',
    timeoutMs: 1000,
    title: 'Schema Fake MCP',
  }],
}, null, 2)}\n`, 'utf8');
process.env.DESKTOP_PET_MCP_SERVERS_JSON = '';

const outputPath = path.join(tempRoot, 'echo-schema.json');
const parsed = parseMcpRealServerToolSchemaArgs([
  '--projectRoot',
  tempRoot,
  '--serverId',
  'schema-fake',
  '--toolName',
  'echo',
  '--output',
  outputPath,
]);
assert.equal(parsed.projectRoot, tempRoot);
assert.equal(parsed.serverId, 'schema-fake');
assert.equal(parsed.toolName, 'echo');

const report = await runMcpRealServerToolSchema(parsed);
assert.equal(report.kind, 'mcp-real-server-tool-schema');
assert.equal(report.serverId, 'schema-fake');
assert.equal(report.toolName, 'echo');
assert.equal(report.readOnlyCandidate, true);
assert.equal(report.requiredInputsPresent, false);
assert.equal(report.inputSchema.type, 'object');
assert.equal(fs.existsSync(outputPath), true);

await assert.rejects(
  () => runMcpRealServerToolSchema({ projectRoot: tempRoot, serverId: 'schema-fake', toolName: 'missing' }),
  /was not listed/u,
);
assert.throws(
  () => parseMcpRealServerToolSchemaArgs(['--serverId', 'schema-fake']),
  /Usage: npx tsx/u,
);

if (previousEnvConfig === undefined) {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
} else {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousEnvConfig;
}

console.log('agent MCP real-server tool schema smoke passed');
