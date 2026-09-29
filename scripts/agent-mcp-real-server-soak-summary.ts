import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { redactMcpSoakText } from './agent-mcp-real-server-soak-config.ts';
import {
  createSettingsMcpSoakSummaryResult,
  type SettingsMcpSoakReport,
  type SettingsMcpSoakSummaryResult,
} from '../src/components/settings/settingsMcpSoakSummary.ts';

export interface McpRealServerSoakSummaryOptions {
  includeJsonText?: boolean;
  inputPath: string;
  outputPath?: string;
  prettyJson?: boolean;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

export function parseMcpRealServerSoakSummaryArgs(
  args: readonly string[],
): McpRealServerSoakSummaryOptions {
  const options: Partial<McpRealServerSoakSummaryOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input') {
      options.inputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--json') {
      options.includeJsonText = true;
    } else if (arg === '--pretty') {
      options.includeJsonText = true;
      options.prettyJson = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.inputPath) {
    throw new Error('Usage: npx tsx scripts/agent-mcp-real-server-soak-summary.ts --input report.json [--output summary.json] [--json] [--pretty]');
  }

  return options as McpRealServerSoakSummaryOptions;
}

function readSoakReport(inputPath: string): SettingsMcpSoakReport {
  const report = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as SettingsMcpSoakReport;
  if (report.kind !== 'mcp-real-server-soak-report') {
    throw new Error('Input is not an MCP real-server soak report.');
  }

  return report;
}

export function runMcpRealServerSoakSummary(
  options: McpRealServerSoakSummaryOptions,
): SettingsMcpSoakSummaryResult {
  const inputPath = path.resolve(options.inputPath);
  const report = readSoakReport(inputPath);
  const finalResult = createSettingsMcpSoakSummaryResult({
    includeJsonText: options.includeJsonText,
    inputPath,
    prettyJson: options.prettyJson,
    report,
  });
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(finalResult, null, 2)}\n`, 'utf8');
  }

  return finalResult;
}

function runCli() {
  const result = runMcpRealServerSoakSummary(parseMcpRealServerSoakSummaryArgs(process.argv.slice(2)));
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(redactMcpSoakText(error));
    process.exitCode = 1;
  }
}
