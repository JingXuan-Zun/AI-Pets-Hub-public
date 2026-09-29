import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

interface SoakReadinessOptions {
  inputPath?: string;
  outputPath?: string;
  projectRoot?: string;
  rawText?: string;
  reportDir?: string;
  rounds?: number;
}

interface McpSoakReadinessService {
  createReadinessReport: (request?: {
    rawText?: string;
    reportDir?: string;
    rounds?: number;
  }) => McpSoakReadinessReport;
}

interface McpSoakReadinessReport {
  configPresent: boolean;
  kind: string;
  runbook: {
    allServers: string;
    indexReports: string;
    perServer: Array<{ command: string; serverId: string }>;
  };
  servers: Array<{
    blockers?: string[];
    fakeFixture: boolean;
    id: string;
    readyForRealSoak: boolean;
  }>;
  source: string;
  status: 'blocked' | 'ready';
  totals: {
    fakeFixtureServers: number;
    readyServers: number;
    servers: number;
  };
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

function normalizeRounds(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(200, Math.round(parsed))) : 10;
}

export function parseMcpSoakReadinessArgs(args: readonly string[]): SoakReadinessOptions {
  const options: SoakReadinessOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--projectRoot' || arg === '--project-root') {
      options.projectRoot = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--reportDir' || arg === '--report-dir') {
      options.reportDir = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--rounds') {
      options.rounds = normalizeRounds(readArgValue(args, index, arg));
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--input' || arg === '--inputPath' || arg === '--input-path') {
      options.inputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--rawText' || arg === '--raw-text') {
      options.rawText = readArgValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

function readDraftConfigText(options: SoakReadinessOptions, projectRoot: string) {
  if (options.inputPath && options.rawText) {
    throw new Error('Use either --input or --rawText, not both.');
  }

  if (options.rawText) {
    return options.rawText;
  }

  const inputPath = options.inputPath
    ? path.resolve(projectRoot, options.inputPath)
    : '';
  return inputPath ? fs.readFileSync(inputPath, 'utf8') : undefined;
}

async function createReadinessService(projectRoot: string) {
  const { createMcpSoakReadinessService } = await import('../electron/mcpSoakReadinessService.cjs') as {
    createMcpSoakReadinessService: (options?: { projectRoot?: string }) => McpSoakReadinessService;
  };
  return createMcpSoakReadinessService({ projectRoot });
}

export async function runMcpSoakReadiness(options: SoakReadinessOptions = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const service = await createReadinessService(projectRoot);
  const report = service.createReadinessReport({
    rawText: readDraftConfigText(options, projectRoot),
    reportDir: options.reportDir,
    rounds: options.rounds,
  });
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  return report;
}

async function runCli() {
  const report = await runMcpSoakReadiness(parseMcpSoakReadinessArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    status: report.status,
    totals: report.totals,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
