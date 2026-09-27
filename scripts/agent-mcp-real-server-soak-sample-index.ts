import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpSoakSummaryResult,
  type SettingsMcpSoakReport,
  type SettingsMcpSoakSummaryStatus,
} from '../src/components/settings/settingsMcpSoakSummary.ts';

interface SoakSampleIndexOptions {
  dir: string;
  outputPath?: string;
  prettyJson?: boolean;
}

interface SoakSampleEntry {
  fileName: string;
  filePath: string;
  reportKind: string;
  rounds: number;
  serverIds: string[];
  status: SettingsMcpSoakSummaryStatus | 'invalid';
  summaryText: string;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

export function parseMcpSoakSampleIndexArgs(args: readonly string[]): SoakSampleIndexOptions {
  const options: Partial<SoakSampleIndexOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dir') {
      options.dir = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--pretty') {
      options.prettyJson = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.dir) {
    throw new Error('Usage: npx tsx scripts/agent-mcp-real-server-soak-sample-index.ts --dir reports [--output index.json] [--pretty]');
  }

  return options as SoakSampleIndexOptions;
}

function listJsonFiles(dir: string) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith('.json'))
    .map((item) => path.join(dir, item.name))
    .sort((left, right) => left.localeCompare(right));
}

function createInvalidEntry(filePath: string, error: unknown): SoakSampleEntry {
  return {
    fileName: path.basename(filePath),
    filePath,
    reportKind: 'invalid',
    rounds: 0,
    serverIds: [],
    status: 'invalid',
    summaryText: error instanceof Error ? error.message : String(error),
  };
}

function createSampleEntry(filePath: string): SoakSampleEntry {
  try {
    const report = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SettingsMcpSoakReport;
    if (report.kind !== 'mcp-real-server-soak-report') {
      throw new Error('Not an MCP real-server soak report.');
    }

    const summary = createSettingsMcpSoakSummaryResult({ inputPath: filePath, report });
    return {
      fileName: path.basename(filePath),
      filePath,
      reportKind: String(report.kind),
      rounds: summary.totals.rounds,
      serverIds: summary.servers.map((server) => server.id).filter(Boolean),
      status: summary.status,
      summaryText: summary.summaryText,
    };
  } catch (error) {
    return createInvalidEntry(filePath, error);
  }
}

function createStatusCounts(entries: SoakSampleEntry[]) {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.status] = (counts[entry.status] || 0) + 1;
  }

  return counts;
}

function collectUniqueServerIds(entries: SoakSampleEntry[]) {
  return [...new Set(entries.flatMap((entry) => entry.serverIds))].sort((left, right) => left.localeCompare(right));
}

export function runMcpSoakSampleIndex(options: SoakSampleIndexOptions) {
  const dir = path.resolve(options.dir);
  const entries = listJsonFiles(dir).map(createSampleEntry);
  const index = {
    dir,
    entries,
    generatedAt: new Date().toISOString(),
    kind: 'mcp-real-server-soak-sample-index',
    totals: {
      files: entries.length,
      invalidFiles: entries.filter((entry) => entry.status === 'invalid').length,
      rounds: entries.reduce((sum, entry) => sum + entry.rounds, 0),
      servers: collectUniqueServerIds(entries).length,
      statusCounts: createStatusCounts(entries),
      uniqueServerIds: collectUniqueServerIds(entries),
    },
    version: 1,
  };
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(index, null, options.prettyJson ? 2 : 0)}\n`, 'utf8');
  }

  return index;
}

function runCli() {
  const result = runMcpSoakSampleIndex(parseMcpSoakSampleIndexArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result.totals));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
