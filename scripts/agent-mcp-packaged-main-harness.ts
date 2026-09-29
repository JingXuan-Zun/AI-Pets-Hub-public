import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

interface HarnessOptions {
  configPath: string;
  outputPath: string;
  projectRoot: string;
  rounds: number;
}

interface RawHarnessOptions {
  config?: string;
  output?: string;
  pretty?: boolean;
  projectRoot?: string;
  rounds?: number;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(max, Math.round(parsed))) : fallback;
}

function usage() {
  return [
    'Usage: npx tsx scripts/agent-mcp-packaged-main-harness.ts',
    '[--config .desktop-pet-mcp.json] [--output tmp/mcp-packaged-production-run/packaged-main-harness-call-report.json]',
    '[--project-root .] [--rounds 3] [--pretty]',
  ].join(' ');
}

export function parseMcpPackagedMainHarnessArgs(args: readonly string[]) {
  const options: RawHarnessOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--pretty') {
      options.pretty = true;
    } else if (arg === '--config') {
      options.config = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.output = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--project-root') {
      options.projectRoot = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--rounds') {
      options.rounds = normalizePositiveInteger(readArgValue(args, index, arg), 3, 50);
      index += 1;
    } else {
      throw new Error(`${usage()} Unexpected argument: ${arg}`);
    }
  }

  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  return {
    configPath: path.resolve(projectRoot, options.config || '.desktop-pet-mcp.json'),
    outputPath: path.resolve(projectRoot, options.output || 'tmp/mcp-packaged-production-run/packaged-main-harness-call-report.json'),
    pretty: Boolean(options.pretty),
    projectRoot,
    rounds: normalizePositiveInteger(options.rounds, 3, 50),
  };
}

export async function runMcpPackagedMainHarness(options: HarnessOptions) {
  const previousConfigPath = process.env.DESKTOP_PET_MCP_CONFIG_PATH;
  process.env.DESKTOP_PET_MCP_CONFIG_PATH = options.configPath;
  try {
    const { createMcpHistoryService } = await import('../electron/mcpHistoryService.cjs');
    const { createMcpServerHealthService } = await import('../electron/mcpServerHealthService.cjs');
    const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs');
    const { runMcpPackagedReadOnlyCallProbe } = await import('../electron/mcpPackagedReadOnlyCallProbe.cjs');
    const history = createMcpHistoryService({ maxEntries: 200 });
    const service = createMcpStdioClientService({
      health: createMcpServerHealthService(),
      history,
      projectRoot: options.projectRoot,
      reuseSessions: true,
    });

    try {
      return await runMcpPackagedReadOnlyCallProbe({
        app: { getVersion: () => '0.0.1-harness' },
        env: {
          DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT: options.outputPath,
          DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS: String(options.rounds),
        },
        mcpHistoryService: history,
        mcpStdioClientService: service,
        runtimeKind: 'packaged-main-harness',
        runtimeMode: 'unknown',
      });
    } finally {
      service.dispose('packaged-main-harness-complete');
    }
  } finally {
    if (previousConfigPath === undefined) {
      delete process.env.DESKTOP_PET_MCP_CONFIG_PATH;
    } else {
      process.env.DESKTOP_PET_MCP_CONFIG_PATH = previousConfigPath;
    }
  }
}

async function runCli() {
  const options = parseMcpPackagedMainHarnessArgs(process.argv.slice(2));
  const report = await runMcpPackagedMainHarness(options);
  if (options.pretty) {
    fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(`MCP packaged-main harness report written: ${options.outputPath}`);
  console.log(JSON.stringify(report.totals));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
