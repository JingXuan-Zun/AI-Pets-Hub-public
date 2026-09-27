import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpPackagedReadOnlyCoverageReview,
} from '../src/components/settings/settingsMcpPackagedReadOnlyCoverage.ts';
import type {
  SettingsMcpPackagedReadOnlyCallReport,
} from '../src/components/settings/settingsMcpPackagedReadOnlyCoverage.ts';
import type { SettingsMcpPackagedProductionReport } from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';

interface PackagedReadOnlyCoverageCliOptions {
  callReportPath?: string;
  inputPath: string;
  outputPath?: string;
  pretty?: boolean;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

function usage() {
  return [
    'Usage: npx tsx scripts/agent-mcp-packaged-read-only-coverage.ts',
    '--input report.json [--call-report packaged-call-report.json]',
    '[--output review.json] [--pretty]',
  ].join(' ');
}

export function parseMcpPackagedReadOnlyCoverageArgs(
  args: readonly string[],
): PackagedReadOnlyCoverageCliOptions {
  const options: Partial<PackagedReadOnlyCoverageCliOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input') {
      options.inputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--call-report') {
      options.callReportPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--pretty') {
      options.pretty = true;
    } else {
      throw new Error(`${usage()} Unexpected argument: ${arg}`);
    }
  }

  if (!options.inputPath) {
    throw new Error(usage());
  }

  return options as PackagedReadOnlyCoverageCliOptions;
}

function readReport(inputPath: string): SettingsMcpPackagedProductionReport {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8')) as unknown;
  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || (parsed as Partial<SettingsMcpPackagedProductionReport>).kind !== 'mcp-packaged-production-long-run-report'
  ) {
    throw new Error('Input is not an MCP packaged-production long-run report.');
  }

  return parsed as SettingsMcpPackagedProductionReport;
}

function readCallReport(inputPath: string): SettingsMcpPackagedReadOnlyCallReport {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8')) as unknown;
  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || (parsed as Partial<SettingsMcpPackagedReadOnlyCallReport>).kind !== 'mcp-packaged-read-only-call-report'
  ) {
    throw new Error('Input is not an MCP packaged read-only call report.');
  }

  return parsed as SettingsMcpPackagedReadOnlyCallReport;
}

export function runMcpPackagedReadOnlyCoverage(options: PackagedReadOnlyCoverageCliOptions) {
  const review = createSettingsMcpPackagedReadOnlyCoverageReview(
    readReport(options.inputPath),
    options.callReportPath ? readCallReport(options.callReportPath) : undefined,
  );
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(review, null, options.pretty ? 2 : 0)}\n`, 'utf8');
  }

  return review;
}

function runCli() {
  const review = runMcpPackagedReadOnlyCoverage(
    parseMcpPackagedReadOnlyCoverageArgs(process.argv.slice(2)),
  );
  console.log(review.summaryText);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
