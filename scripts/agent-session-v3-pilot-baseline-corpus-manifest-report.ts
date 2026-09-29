import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotExplicitDebugCorpusExporter,
  type AgentSessionV3PilotExplicitDebugCorpusExporterResult,
} from './agent-session-v3-pilot-explicit-debug-corpus-exporter.ts';
import {
  runAgentSessionV3PilotExternalSampleCorpusManifestLoader,
  type AgentSessionV3PilotExternalSampleCorpusManifest,
  type AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';
import { runAgentSessionV3PilotExternalSampleCorpusManifestTemplate } from './agent-session-v3-pilot-external-sample-corpus-manifest-template.ts';

export interface RunAgentSessionV3PilotBaselineCorpusManifestReportOptions {
  includeJsonText?: boolean;
  maxShadowDebugSamples?: number;
  outDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotBaselineCorpusManifestReportResult {
  corpusExport: AgentSessionV3PilotExplicitDebugCorpusExporterResult;
  corpusPath: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-baseline-corpus-manifest-report';
  manifestLoader: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult;
  manifestPath: string;
  reportText: string | null;
  scenarioCount: number;
  status: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult['status'];
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotBaselineCorpusManifestReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotBaselineCorpusManifestReportOptions {
  let includeJsonText = false;
  let maxShadowDebugSamples: number | undefined;
  let outDir: string | null = null;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--max-shadow') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing sample count after --max-shadow.');
      }
      maxShadowDebugSamples = Number(nextArg);
      index += 1;
    } else if (arg === '--out-dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing output directory after --out-dir.');
      }
      outDir = nextArg;
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!outDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-baseline-corpus-manifest-report.ts --out-dir output-dir [--max-shadow count] [--json] [--pretty]');
  }

  return {
    includeJsonText,
    maxShadowDebugSamples,
    outDir,
    prettyJson,
  };
}

function createAgentSessionV3PilotBaselineCorpusManifestReportSummaryText(options: {
  corpusPath: string;
  manifestPath: string;
  result: AgentSessionV3PilotBaselineCorpusManifestReportResult;
}) {
  return [
    `AgentSessionV3PilotBaselineCorpusManifestReport status=${options.result.status}`,
    `scenarios=${options.result.scenarioCount}`,
    `corpusPath=${options.corpusPath}`,
    `manifestPath=${options.manifestPath}`,
    `profiles=${options.result.manifestLoader.profileComparison.profileCount}`,
  ].join(' ');
}

function createAgentSessionV3PilotBaselineCorpusManifestReportJsonText(
  result: AgentSessionV3PilotBaselineCorpusManifestReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotBaselineCorpusManifestReport(
  options: RunAgentSessionV3PilotBaselineCorpusManifestReportOptions,
): Promise<AgentSessionV3PilotBaselineCorpusManifestReportResult> {
  await mkdir(options.outDir, {
    recursive: true,
  });

  const corpusPath = path.join(options.outDir, 'explicit-debug-corpus.json');
  const manifestPath = path.join(options.outDir, 'explicit-debug-corpus-manifest.json');
  const corpusExport = await runAgentSessionV3PilotExplicitDebugCorpusExporter({
    maxShadowDebugSamples: options.maxShadowDebugSamples,
    outPath: corpusPath,
    prettyJson: options.prettyJson,
  });
  const template = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate({
    outPath: manifestPath,
    prettyJson: options.prettyJson,
  });
  const manifest: AgentSessionV3PilotExternalSampleCorpusManifest = {
    ...template.manifest,
    sources: [
      {
        label: 'explicit-debug-v2-scenarios',
        path: path.basename(corpusPath),
      },
    ],
  };

  await writeFile(
    manifestPath,
    JSON.stringify(manifest, null, options.prettyJson ? 2 : 0),
    'utf8',
  );

  const manifestLoader = await runAgentSessionV3PilotExternalSampleCorpusManifestLoader({
    includeReportText: true,
    manifestPath,
    prettyJson: options.prettyJson,
  });
  const resultWithoutJson: AgentSessionV3PilotBaselineCorpusManifestReportResult = {
    corpusExport,
    corpusPath,
    jsonText: null,
    kind: 'agent-session-v3-pilot-baseline-corpus-manifest-report',
    manifestLoader,
    manifestPath,
    reportText: manifestLoader.reportText,
    scenarioCount: corpusExport.scenarioCount,
    status: manifestLoader.status,
    summaryText: '',
    version: 1,
  };
  const summaryText = createAgentSessionV3PilotBaselineCorpusManifestReportSummaryText({
    corpusPath,
    manifestPath,
    result: resultWithoutJson,
  });
  const resultWithSummary = {
    ...resultWithoutJson,
    summaryText,
  };

  return {
    ...resultWithSummary,
    jsonText: options.includeJsonText
      ? createAgentSessionV3PilotBaselineCorpusManifestReportJsonText(resultWithSummary, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

async function runAgentSessionV3PilotBaselineCorpusManifestReportCli() {
  const options = parseAgentSessionV3PilotBaselineCorpusManifestReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotBaselineCorpusManifestReport(options);
  console.log(result.summaryText);
  if (result.reportText) {
    console.log(result.reportText);
  }
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotBaselineCorpusManifestReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
