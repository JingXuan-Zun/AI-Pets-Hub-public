import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpPackagedProductionReview,
  type SettingsMcpPackagedProductionReport,
} from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';
import {
  createSettingsMcpPackagedProductionReportFromSoakSummary,
  type SettingsMcpPackagedProductionReportBuildOptions,
} from '../src/components/settings/settingsMcpPackagedProductionReportBuilder.ts';
import type { SettingsMcpSoakSummaryResult } from '../src/components/settings/settingsMcpSoakSummary.ts';

export interface McpPackagedProductionReportBuilderCliOptions {
  build: SettingsMcpPackagedProductionReportBuildOptions;
  outputPath: string;
  prettyJson?: boolean;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

function numberArg(args: readonly string[], index: number, name: string) {
  const value = Number(readArgValue(args, index, name));
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number after ${name}.`);
  }

  return value;
}

function runtimeMode(value: string) {
  if (value === 'dev' || value === 'packaged' || value === 'unknown') {
    return value;
  }

  throw new Error(`Invalid runtime mode: ${value}`);
}

function configSource(value: string) {
  if (value === 'draft-config' || value === 'saved-config' || value === 'unknown') {
    return value;
  }

  throw new Error(`Invalid config source: ${value}`);
}

function isSoakSummary(value: unknown): value is SettingsMcpSoakSummaryResult {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as Partial<SettingsMcpSoakSummaryResult>).kind === 'mcp-real-server-soak-summary'
    && (value as Partial<SettingsMcpSoakSummaryResult>).version === 1
    && Array.isArray((value as Partial<SettingsMcpSoakSummaryResult>).servers);
}

function readSoakSummary(inputPath: string) {
  const summary = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8')) as unknown;
  if (!isSoakSummary(summary)) {
    throw new Error('Input is not an MCP real-server soak summary.');
  }

  return summary;
}

function usage() {
  return [
    'Usage: npx tsx scripts/agent-mcp-packaged-production-report-builder.ts',
    '--soak-summary summary.json --output report.json --ready-server id',
    '--runtime-mode packaged --config-source saved-config --duration-minutes 31',
    '--startup-count 1 --controlled-close-count 1 --unexpected-exit-count 0',
    '--automatic-high-risk-call-count 0 [--pretty]',
  ].join(' ');
}

export function parseMcpPackagedProductionReportBuilderArgs(
  args: readonly string[],
): McpPackagedProductionReportBuilderCliOptions {
  const readyServerIds: string[] = [];
  const options: Partial<McpPackagedProductionReportBuilderCliOptions> = {};
  const build: Partial<SettingsMcpPackagedProductionReportBuildOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (parseRequiredArg(arg, args, index, options, build, readyServerIds)) {
      index += 1;
    } else if (arg === '--pretty') {
      options.prettyJson = true;
    } else {
      parseOptionalArg(arg, args, index, build);
      if (arg !== '--pretty') {
        index += 1;
      }
    }
  }

  build.readyServerIds = readyServerIds;
  assertRequiredOptions(options, build);
  return { ...options, build: build as SettingsMcpPackagedProductionReportBuildOptions };
}

function parseRequiredArg(
  arg: string,
  args: readonly string[],
  index: number,
  options: Partial<McpPackagedProductionReportBuilderCliOptions>,
  build: Partial<SettingsMcpPackagedProductionReportBuildOptions>,
  readyServerIds: string[],
) {
  if (arg === '--soak-summary') {
    build.soakSummary = readSoakSummary(readArgValue(args, index, arg));
  } else if (arg === '--output') {
    options.outputPath = readArgValue(args, index, arg);
  } else if (arg === '--ready-server') {
    readyServerIds.push(readArgValue(args, index, arg));
  } else if (arg === '--runtime-mode') {
    build.runtimeMode = runtimeMode(readArgValue(args, index, arg));
  } else if (arg === '--config-source') {
    build.configSource = configSource(readArgValue(args, index, arg));
  } else if (arg === '--duration-minutes') {
    build.durationMs = numberArg(args, index, arg) * 60 * 1000;
  } else if (arg === '--startup-count') {
    build.startupCount = numberArg(args, index, arg);
  } else if (arg === '--controlled-close-count') {
    build.controlledCloseCount = numberArg(args, index, arg);
  } else if (arg === '--unexpected-exit-count') {
    build.unexpectedExitCount = numberArg(args, index, arg);
  } else if (arg === '--automatic-high-risk-call-count') {
    build.automaticHighRiskCallCount = numberArg(args, index, arg);
  } else {
    return false;
  }

  return true;
}

function parseOptionalArg(
  arg: string,
  args: readonly string[],
  index: number,
  build: Partial<SettingsMcpPackagedProductionReportBuildOptions>,
) {
  if (arg === '--artifact') {
    build.packagedArtifactPath = readArgValue(args, index, arg);
  } else if (arg === '--platform') {
    build.platform = readArgValue(args, index, arg);
  } else if (arg === '--app-version') {
    build.runtimeVersion = readArgValue(args, index, arg);
  } else if (arg === '--config-path') {
    build.configPath = readArgValue(args, index, arg);
  } else if (arg === '--started-at') {
    build.startedAt = readArgValue(args, index, arg);
  } else if (arg === '--ended-at') {
    build.endedAt = readArgValue(args, index, arg);
  } else if (arg === '--session-count') {
    build.sessionCount = numberArg(args, index, arg);
  } else if (arg === '--pooled-session-reuse-count') {
    build.pooledSessionReuseCount = numberArg(args, index, arg);
  } else if (arg === '--graceful-quit-count') {
    build.gracefulQuitCount = numberArg(args, index, arg);
  } else if (arg === '--denied-high-risk-call-count') {
    build.deniedHighRiskCallCount = numberArg(args, index, arg);
  } else if (arg === '--write-tool-call-count') {
    build.writeToolCallCount = numberArg(args, index, arg);
  } else {
    throw new Error(`Unexpected argument: ${arg}`);
  }
}

function assertRequiredOptions(
  options: Partial<McpPackagedProductionReportBuilderCliOptions>,
  build: Partial<SettingsMcpPackagedProductionReportBuildOptions>,
) {
  if (!options.outputPath || !build.soakSummary || !build.runtimeMode || !build.configSource) {
    throw new Error(usage());
  }
  if (!build.readyServerIds?.length) {
    throw new Error('At least one --ready-server value is required.');
  }
}

export function runMcpPackagedProductionReportBuilder(
  options: McpPackagedProductionReportBuilderCliOptions,
): SettingsMcpPackagedProductionReport {
  const report = createSettingsMcpPackagedProductionReportFromSoakSummary(options.build);
  const outputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, options.prettyJson ? 2 : 0)}\n`, 'utf8');
  return report;
}

function runCli() {
  const report = runMcpPackagedProductionReportBuilder(
    parseMcpPackagedProductionReportBuilderArgs(process.argv.slice(2)),
  );
  console.log(createSettingsMcpPackagedProductionReview(report).summaryText);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
