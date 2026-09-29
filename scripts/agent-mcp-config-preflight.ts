import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpConfigPreflight,
  type SettingsMcpConfigPreflightResult,
} from '../src/components/settings/settingsMcpConfigPreflight';
import {
  createSettingsMcpConfigPreflightEvidenceSummary,
  type SettingsMcpConfigPreflightEvidenceSummary,
} from '../src/components/settings/settingsMcpConfigPreflightEvidence';
import {
  parseSettingsMcpConfigPreflightExportText,
} from '../src/components/settings/settingsMcpConfigPreflightExport';

const MCP_CONFIG_FILE_NAME = '.desktop-pet-mcp.json';

interface McpConfigPreflightOptions {
  evidencePath?: string;
  inputPath?: string;
  outputPath?: string;
  projectRoot?: string;
  rawText?: string;
}

interface McpConfigPreflightSource {
  configPath: string | null;
  exists: boolean;
  rawText: string;
  source: 'input-file' | 'raw-text' | 'saved-config';
}

export interface McpConfigPreflightReport {
  configPath: string | null;
  exists: boolean;
  evidence?: SettingsMcpConfigPreflightEvidenceSummary;
  kind: 'desktop-pet-mcp-config-preflight.v1';
  preflight: SettingsMcpConfigPreflightResult;
  source: McpConfigPreflightSource['source'];
  status: SettingsMcpConfigPreflightResult['status'];
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

export function parseMcpConfigPreflightArgs(args: readonly string[]): McpConfigPreflightOptions {
  const options: McpConfigPreflightOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--projectRoot' || arg === '--project-root') {
      options.projectRoot = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--input' || arg === '--inputPath' || arg === '--input-path') {
      options.inputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--rawText' || arg === '--raw-text') {
      options.rawText = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--evidence' || arg === '--evidencePath' || arg === '--evidence-path') {
      options.evidencePath = readArgValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

function readPreflightSource(
  options: McpConfigPreflightOptions,
  projectRoot: string,
): McpConfigPreflightSource {
  if (options.inputPath && options.rawText) {
    throw new Error('Use either --input or --rawText, not both.');
  }

  if (options.rawText !== undefined) {
    return {
      configPath: null,
      exists: false,
      rawText: options.rawText,
      source: 'raw-text',
    };
  }

  const configPath = path.resolve(projectRoot, options.inputPath || MCP_CONFIG_FILE_NAME);
  const exists = fs.existsSync(configPath);
  return {
    configPath,
    exists,
    rawText: exists ? fs.readFileSync(configPath, 'utf8') : '{"servers":[]}',
    source: options.inputPath ? 'input-file' : 'saved-config',
  };
}

function readEvidenceSummary(
  evidencePath: string | undefined,
  projectRoot: string,
  preflight: SettingsMcpConfigPreflightResult,
) {
  if (!evidencePath) {
    return undefined;
  }

  const resolvedPath = path.resolve(projectRoot, evidencePath);
  const imported = parseSettingsMcpConfigPreflightExportText(
    fs.readFileSync(resolvedPath, 'utf8'),
    evidencePath,
  );
  return createSettingsMcpConfigPreflightEvidenceSummary(imported, preflight);
}

function writeReport(outputPath: string | undefined, report: McpConfigPreflightReport) {
  if (!outputPath) {
    return;
  }

  const resolvedPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function runMcpConfigPreflight(
  options: McpConfigPreflightOptions = {},
): McpConfigPreflightReport {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const source = readPreflightSource(options, projectRoot);
  const preflight = createSettingsMcpConfigPreflight(source.rawText);
  const report: McpConfigPreflightReport = {
    configPath: source.configPath,
    evidence: readEvidenceSummary(options.evidencePath, projectRoot, preflight),
    exists: source.exists,
    kind: 'desktop-pet-mcp-config-preflight.v1',
    preflight,
    source: source.source,
    status: preflight.status,
  };
  writeReport(options.outputPath, report);
  return report;
}

function printCliSummary(report: McpConfigPreflightReport) {
  console.log(JSON.stringify({
    checks: report.preflight.checks.length,
    evidenceMatch: report.evidence?.currentMatch,
    exists: report.exists,
    serverCount: report.preflight.serverCount,
    source: report.source,
    status: report.status,
    statusCounts: report.preflight.statusCounts,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    printCliSummary(runMcpConfigPreflight(parseMcpConfigPreflightArgs(process.argv.slice(2))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
