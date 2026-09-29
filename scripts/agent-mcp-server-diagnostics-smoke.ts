import { strict as assert } from 'node:assert';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type DiagnosticsService = {
  inspect: (request?: { serverId?: string }) => Promise<DesktopPetMcpServerDiagnosticLike>;
};

const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [
    {
      args: [fakeServerPath],
      command: process.execPath,
      id: 'fake-diagnostics',
      title: 'Fake Diagnostics MCP',
    },
  ],
});

const { createMcpServerDiagnosticsService } = await import('../electron/mcpServerDiagnosticsService.cjs') as {
  createMcpServerDiagnosticsService: (options: Record<string, unknown>) => DiagnosticsService;
};

const service = createMcpServerDiagnosticsService({ projectRoot });
const ok = await service.inspect({ serverId: 'fake-diagnostics' });
assert.equal(ok.ok, true);
assert.equal(ok.serverId, 'fake-diagnostics');
assert.equal(ok.cwdExists, true);
assert.equal(ok.commandPathExists, true);
assert.equal(ok.toolCount, 1);
assert.equal(ok.tools[0]?.name, 'echo');
assert.equal(typeof ok.durationMs, 'number');
assert.ok(ok.timeoutMs > 0);
assert.equal(ok.compatibility?.issueCode, 'ready');
assert.equal(ok.compatibility?.status, 'ready');

const unknown = await service.inspect({ serverId: 'missing-diagnostics' });
assert.equal(unknown.ok, false);
assert.match(unknown.error ?? '', /Unknown MCP server/u);
assert.equal(unknown.compatibility?.issueCode, 'unknown-server');
assert.equal(unknown.compatibility?.status, 'blocked');

console.log('agent MCP server diagnostics smoke passed');
