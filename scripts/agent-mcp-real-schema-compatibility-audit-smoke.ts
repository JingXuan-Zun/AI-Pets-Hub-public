import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseMcpRealSchemaCompatibilityAuditArgs,
  runMcpRealSchemaCompatibilityAudit,
} from './agent-mcp-real-schema-compatibility-audit.ts';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-real-schema-audit-'));
const outputPath = path.join(tempRoot, 'report.json');
const callCountPath = path.join(tempRoot, 'call-count.txt');
const previousConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;
fs.writeFileSync(path.join(tempRoot, '.desktop-pet-mcp.json'), `${JSON.stringify({
  servers: [{
    args: [projectPath('scripts/fixtures/schema-diversity-mcp-stdio-server.cjs')],
    command: process.execPath,
    env: { SCHEMA_DIVERSITY_MCP_CALL_COUNT_PATH: callCountPath },
    id: 'schema-diversity',
    timeoutMs: 2_000,
  }],
}, null, 2)}\n`, 'utf8');
process.env.DESKTOP_PET_MCP_SERVERS_JSON = '';

try {
  const options = parseMcpRealSchemaCompatibilityAuditArgs([
    '--projectRoot', tempRoot,
    '--serverId', 'schema-diversity',
    '--output', outputPath,
  ]);
  const report = await runMcpRealSchemaCompatibilityAudit(options);
  assert.equal(report.ok, true);
  assert.equal(report.serverCount, 1);
  assert.equal(report.toolCount, 3);
  assert.equal(report.schemaSupportedCount, 3);
  assert.equal(report.schemaBlockedCount, 0);
  assert.deepEqual(report.draftCounts, { '2019-09': 1, '2020-12': 1, 'draft-07': 1 });
  assert.equal(report.rows.find((row) => row.toolName === 'draft7_ref')?.localRefCount, 1);
  assert.equal(report.rows.find((row) => row.toolName === 'draft2019_nested')?.scalarArrayItemFieldCount, 1);
  assert.equal(report.rows.find((row) => row.toolName === 'draft2020_tuple')?.fixedTupleCount, 1);
  assert.equal(fs.existsSync(callCountPath), false);
  assert.equal(fs.existsSync(outputPath), true);
  const outputText = fs.readFileSync(outputPath, 'utf8');
  assert.equal(outputText.includes(tempRoot), false);
  assert.equal(outputText.includes('SCHEMA_DIVERSITY_MCP_CALL_COUNT_PATH'), false);
  assert.equal(outputText.includes('inputSchema'), false);
  await assert.rejects(
    () => runMcpRealSchemaCompatibilityAudit({ projectRoot: tempRoot, serverIds: ['missing'] }),
    /Unknown MCP server IDs/u,
  );
} finally {
  if (previousConfig === undefined) delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  else process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousConfig;
  await new Promise((resolve) => setTimeout(resolve, 200));
  fs.rmSync(tempRoot, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
}

console.log('agent MCP real schema compatibility audit smoke passed');
