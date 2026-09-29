import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpPackagedProductionRunPlan,
  parseSettingsMcpPackagedProductionLatestBuildInfo,
} from '../src/components/settings/settingsMcpPackagedProductionRunPlan.ts';

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

function usage() {
  return [
    'Usage: npx tsx scripts/agent-mcp-packaged-production-run-plan.ts',
    '--ready-server filesystem --ready-server memory',
    '[--latest-build-info release/LATEST_BUILD.txt] [--log-dir tmp/mcp-packaged-production-run]',
    '[--mcp-config .desktop-pet-mcp.json] [--output report.json] [--pretty]',
  ].join(' ');
}

const PACKAGED_PRODUCTION_RUNTIME_CONTRACT_FILES = [
  'electron/main.cjs',
  'electron/mcpPackagedDiagnosticArgs.cjs',
  'electron/mcpPackagedReadOnlyCallProbe.cjs',
];

function isPackagedRuntimeContractCurrent(generatedAt: string | undefined) {
  const generatedAtMs = Date.parse(generatedAt || '');
  if (!Number.isFinite(generatedAtMs)) {
    return false;
  }
  return PACKAGED_PRODUCTION_RUNTIME_CONTRACT_FILES.every((filePath) => (
    fs.statSync(path.resolve(filePath)).mtimeMs <= generatedAtMs
  ));
}

export function parseMcpPackagedProductionRunPlanArgs(args: readonly string[]) {
  const readyServerIds: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--ready-server') {
      readyServerIds.push(readArgValue(args, index, arg));
      index += 1;
    } else if (arg === '--pretty') {
      options.pretty = true;
    } else if (
      arg === '--latest-build-info'
      || arg === '--log-dir'
      || arg === '--output'
      || arg === '--executable'
      || arg === '--mcp-config'
    ) {
      options[arg.slice(2)] = readArgValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`${usage()} Unexpected argument: ${arg}`);
    }
  }

  return { options, readyServerIds };
}

export function runMcpPackagedProductionRunPlan(args: readonly string[]) {
  const { options, readyServerIds } = parseMcpPackagedProductionRunPlanArgs(args);
  const productionRunId = `mcp-packaged-production-${Date.now()}`;
  const logDir = options['log-dir']
    ? path.resolve(String(options['log-dir']))
    : path.resolve('tmp/mcp-packaged-production-run', productionRunId);
  const latestBuildInfoPath = String(options['latest-build-info'] || 'release/LATEST_BUILD.txt');
  const latestBuildInfo = parseSettingsMcpPackagedProductionLatestBuildInfo(
    fs.readFileSync(path.resolve(latestBuildInfoPath), 'utf8'),
  );
  return createSettingsMcpPackagedProductionRunPlan({
    executablePath: options.executable ? String(options.executable) : undefined,
    executablePathExists: fs.existsSync,
    latestBuildInfo,
    logDir,
    mcpConfigPath: path.resolve(String(options['mcp-config'] || '.desktop-pet-mcp.json')),
    outputPath: path.resolve(String(options.output || path.join(logDir, 'report.json'))),
    packagedRuntimeContractReady: isPackagedRuntimeContractCurrent(latestBuildInfo.generatedAt),
    productionRunId,
    readyServerIds,
  });
}

function runCli() {
  const { options } = parseMcpPackagedProductionRunPlanArgs(process.argv.slice(2));
  const plan = runMcpPackagedProductionRunPlan(process.argv.slice(2));
  console.log(JSON.stringify(plan, null, options.pretty ? 2 : 0));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
