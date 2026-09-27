import assert from 'node:assert/strict';
import {
  createReferenceEverythingServerConfig,
  parseMcpReferenceEverythingSchemaAuditArgs,
  runMcpReferenceEverythingSchemaAudit,
} from './agent-mcp-reference-everything-schema-audit.ts';

const server = createReferenceEverythingServerConfig();
assert.deepEqual(server, {
  args: ['-y', '@modelcontextprotocol/server-everything@2026.7.4'],
  command: 'npx.cmd',
  id: 'reference-everything',
  timeoutMs: 120_000,
  title: 'MCP reference everything schema audit',
});
assert.deepEqual(parseMcpReferenceEverythingSchemaAuditArgs([
  '--project-root', 'project', '--output', 'report.json',
]), { outputPath: 'report.json', projectRoot: 'project' });
assert.throws(() => parseMcpReferenceEverythingSchemaAuditArgs(['--server-id', 'unexpected']));

const previousConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;
const originalEnvironmentConfig = JSON.stringify({
  servers: [{ command: 'node', env: { API_KEY: 'hidden' }, id: 'existing-server' }],
});
process.env.DESKTOP_PET_MCP_SERVERS_JSON = originalEnvironmentConfig;
try {
  let observedEnvironmentConfig: Record<string, unknown> | null = null;
  const result = await runMcpReferenceEverythingSchemaAudit({
    outputPath: 'report.json',
    projectRoot: 'project',
  }, async (options) => {
    observedEnvironmentConfig = JSON.parse(process.env.DESKTOP_PET_MCP_SERVERS_JSON || '{}') as Record<string, unknown>;
    assert.deepEqual(options, {
      outputPath: 'report.json',
      projectRoot: 'project',
      serverIds: ['filesystem', 'memory', 'reference-everything'],
    });
    return { ok: true };
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(
    (observedEnvironmentConfig?.servers as Array<{ id: string }>).map((entry) => entry.id),
    ['reference-everything'],
  );
  assert.equal(JSON.stringify(observedEnvironmentConfig).includes('hidden'), false);
  assert.equal(process.env.DESKTOP_PET_MCP_SERVERS_JSON, originalEnvironmentConfig);
} finally {
  if (previousConfig === undefined) delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  else process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousConfig;
}

console.log('agent MCP reference everything schema audit smoke passed');
