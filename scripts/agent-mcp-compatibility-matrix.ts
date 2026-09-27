import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type CompatibilityIssueCode = DesktopPetMcpServerDiagnosticLike['compatibility'] extends infer Compatibility
  ? Compatibility extends { issueCode: infer IssueCode } ? IssueCode : string
  : string;

interface MatrixRow {
  actualIssueCode: CompatibilityIssueCode;
  durationMs: number;
  expectedIssueCode: CompatibilityIssueCode;
  passed: boolean;
  scenario: string;
  toolCount: number;
}

interface MatrixReport {
  generatedAt: string;
  kind: 'mcp-compatibility-matrix-report.v1';
  platform: NodeJS.Platform;
  rows: MatrixRow[];
  summary: { failed: number; passed: number; total: number };
}

type DiagnosticService = {
  inspect: (request: { serverId: string }) => Promise<DesktopPetMcpServerDiagnosticLike>;
};

function reportRow(
  scenario: string,
  expectedIssueCode: CompatibilityIssueCode,
  result: DesktopPetMcpServerDiagnosticLike,
): MatrixRow {
  const actualIssueCode = result.compatibility?.issueCode ?? 'protocol-or-startup-error';
  return {
    actualIssueCode,
    durationMs: result.durationMs,
    expectedIssueCode,
    passed: actualIssueCode === expectedIssueCode,
    scenario,
    toolCount: result.toolCount,
  };
}

export async function runMcpCompatibilityMatrix(outputPath: string): Promise<MatrixReport> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop pet mcp compatibility '));
  const spacedFixturePath = path.join(tempRoot, 'server fixture with spaces.cjs');
  const recoveryStatePath = path.join(tempRoot, 'recovery-state.txt');
  fs.copyFileSync(projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs'), spacedFixturePath);

  const previousConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
    servers: [
      {
        command: 'node',
        cwd: tempRoot,
        env: { PATH: '', Path: '' },
        id: 'compat-no-node',
        timeoutMs: 1_000,
      },
      {
        args: [projectPath('scripts/fixtures/mcp-compat-package-unavailable.cjs')],
        command: process.execPath,
        cwd: tempRoot,
        id: 'compat-package-unavailable',
        timeoutMs: 1_000,
      },
      {
        args: [projectPath('scripts/fixtures/mcp-compat-permission-denied.cjs')],
        command: process.execPath,
        cwd: tempRoot,
        id: 'compat-permission-denied',
        timeoutMs: 1_000,
      },
      {
        args: [projectPath('scripts/fixtures/hanging-mcp-stdio-server.cjs')],
        command: process.execPath,
        cwd: tempRoot,
        id: 'compat-startup-timeout',
        timeoutMs: 1_000,
      },
      {
        args: [projectPath('scripts/fixtures/failing-mcp-stdio-server.cjs')],
        command: process.execPath,
        cwd: tempRoot,
        id: 'compat-server-crash',
        timeoutMs: 1_000,
      },
      {
        args: [projectPath('scripts/fixtures/flaky-mcp-stdio-server.cjs')],
        command: process.execPath,
        cwd: tempRoot,
        env: { FLAKY_MCP_STATE_PATH: recoveryStatePath },
        id: 'compat-crash-recovery',
        timeoutMs: 1_000,
      },
      {
        args: [spacedFixturePath],
        command: process.execPath,
        cwd: tempRoot,
        id: 'compat-space-path',
        timeoutMs: 1_000,
      },
    ],
  });

  try {
    const { createMcpServerDiagnosticsService } = await import('../electron/mcpServerDiagnosticsService.cjs') as {
      createMcpServerDiagnosticsService: (options: { projectRoot: string }) => DiagnosticService;
    };
    const service = createMcpServerDiagnosticsService({ projectRoot });
    const noNode = await service.inspect({ serverId: 'compat-no-node' });
    const packageUnavailable = await service.inspect({ serverId: 'compat-package-unavailable' });
    const permissionDenied = await service.inspect({ serverId: 'compat-permission-denied' });
    const startupTimeout = await service.inspect({ serverId: 'compat-startup-timeout' });
    const serverCrash = await service.inspect({ serverId: 'compat-server-crash' });
    const recoveryFirst = await service.inspect({ serverId: 'compat-crash-recovery' });
    const recoverySecond = await service.inspect({ serverId: 'compat-crash-recovery' });
    const spacePath = await service.inspect({ serverId: 'compat-space-path' });

    assert.equal(serverCrash.stderrSnippet.includes('secret-token'), false);
    assert.equal(serverCrash.stderrSnippet.includes('token=[redacted]'), true);
    assert.equal(spacedFixturePath.includes(' '), true);

    const rows = [
      reportRow('no-node-runtime', 'runtime-missing', noNode),
      reportRow('offline-or-cache-miss', 'package-unavailable', packageUnavailable),
      reportRow('permission-denied', 'permission-denied', permissionDenied),
      reportRow('startup-timeout', 'startup-timeout', startupTimeout),
      reportRow('server-crash', 'server-crash', serverCrash),
      reportRow('crash-first-attempt', 'server-crash', recoveryFirst),
      reportRow('crash-recovery', 'ready', recoverySecond),
      reportRow('paths-with-spaces', 'ready', spacePath),
    ];
    const report: MatrixReport = {
      generatedAt: new Date().toISOString(),
      kind: 'mcp-compatibility-matrix-report.v1',
      platform: process.platform,
      rows,
      summary: {
        failed: rows.filter((row) => !row.passed).length,
        passed: rows.filter((row) => row.passed).length,
        total: rows.length,
      },
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
  } finally {
    if (previousConfig === undefined) delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
    else process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousConfig;
    await new Promise((resolve) => setTimeout(resolve, 250));
    fs.rmSync(tempRoot, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const outputPath = path.resolve(process.argv[2] || projectPath('tmp/mcp-compatibility-matrix-report.json'));
  const report = await runMcpCompatibilityMatrix(outputPath);
  console.log(JSON.stringify({ outputPath, summary: report.summary }));
  if (report.summary.failed) process.exitCode = 1;
}
