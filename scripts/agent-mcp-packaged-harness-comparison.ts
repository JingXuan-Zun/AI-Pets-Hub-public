import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpPackagedHarnessComparison,
} from '../src/components/settings/settingsMcpPackagedHarnessComparison.ts';
import type {
  SettingsMcpPackagedReadOnlyCallReport,
} from '../src/components/settings/settingsMcpPackagedReadOnlyCoverage.ts';

interface HarnessComparisonOptions {
  harnessReportPath: string;
  outputPath?: string;
  packagedReportPath: string;
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
    'Usage: npx tsx scripts/agent-mcp-packaged-harness-comparison.ts',
    '--packaged-report packaged-read-only-call-report.json',
    '--harness-report packaged-main-harness-call-report-20r.json',
    '[--output comparison.json] [--pretty]',
  ].join(' ');
}

export function parseMcpPackagedHarnessComparisonArgs(args: readonly string[]) {
  const options: Partial<HarnessComparisonOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--pretty') {
      options.pretty = true;
    } else if (arg === '--packaged-report') {
      options.packagedReportPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--harness-report') {
      options.harnessReportPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`${usage()} Unexpected argument: ${arg}`);
    }
  }

  if (!options.packagedReportPath || !options.harnessReportPath) {
    throw new Error(usage());
  }

  return options as HarnessComparisonOptions;
}

function readCallReport(inputPath: string): SettingsMcpPackagedReadOnlyCallReport {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8')) as unknown;
  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || (parsed as Partial<SettingsMcpPackagedReadOnlyCallReport>).kind !== 'mcp-packaged-read-only-call-report'
  ) {
    throw new Error(`Input is not an MCP packaged read-only call report: ${inputPath}`);
  }

  return parsed as SettingsMcpPackagedReadOnlyCallReport;
}

export function runMcpPackagedHarnessComparison(options: HarnessComparisonOptions) {
  const comparison = createSettingsMcpPackagedHarnessComparison(
    readCallReport(options.packagedReportPath),
    readCallReport(options.harnessReportPath),
  );
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(comparison, null, options.pretty ? 2 : 0)}\n`, 'utf8');
  }

  return comparison;
}

function runCli() {
  const comparison = runMcpPackagedHarnessComparison(
    parseMcpPackagedHarnessComparisonArgs(process.argv.slice(2)),
  );
  console.log(comparison.summaryText);
  console.log(comparison.conclusion);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
