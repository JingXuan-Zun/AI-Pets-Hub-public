import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotExternalSampleFixtureSetExport,
  stringifyAgentSessionV3PilotExternalSampleFixtureSet,
  type AgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotExternalSampleFixtureSetExportResult,
} from '../src/agent/legacy/index.ts';

export interface RunAgentSessionV3PilotExternalSampleFixtureSetExporterOptions {
  corpusPaths: readonly string[];
  includeJsonText?: boolean;
  outPath?: string | null;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotExternalSampleFixtureSetExporterResult {
  corpusPaths: string[];
  fixturePath: string | null;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-external-sample-fixture-set-exporter';
  result: AgentSessionV3PilotExternalSampleFixtureSetExportResult;
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotExternalSampleFixtureSetExporterArgs(
  args: readonly string[],
): RunAgentSessionV3PilotExternalSampleFixtureSetExporterOptions {
  const corpusPaths: string[] = [];
  let includeJsonText = false;
  let outPath: string | null = null;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--out') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing fixture output path after --out.');
      }
      outPath = nextArg;
      index += 1;
    } else {
      corpusPaths.push(arg);
    }
  }

  if (!corpusPaths.length) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-external-sample-fixture-set-exporter.ts <corpus.json> [more-corpus.json ...] [--out fixture.json] [--json] [--pretty]');
  }

  return {
    corpusPaths,
    includeJsonText,
    outPath,
    prettyJson,
  };
}

async function readAgentSessionV3PilotExternalSampleFixtureSetExporterCorpusSource(
  corpusPath: string,
) {
  const corpusText = await readFile(corpusPath, 'utf8');
  return {
    corpus: JSON.parse(corpusText) as AgentSessionV3PilotDebugSampleCorpusExport,
    label: path.basename(corpusPath),
  };
}

export async function runAgentSessionV3PilotExternalSampleFixtureSetExporter(
  options: RunAgentSessionV3PilotExternalSampleFixtureSetExporterOptions,
): Promise<AgentSessionV3PilotExternalSampleFixtureSetExporterResult> {
  const sources = await Promise.all(
    options.corpusPaths.map(readAgentSessionV3PilotExternalSampleFixtureSetExporterCorpusSource),
  );
  const result = createAgentSessionV3PilotExternalSampleFixtureSetExport({
    sources,
  });
  const outputJsonText = options.includeJsonText || options.outPath
    ? stringifyAgentSessionV3PilotExternalSampleFixtureSet(result.fixtureSet, {
      pretty: options.prettyJson,
    })
    : null;

  if (options.outPath && outputJsonText) {
    await writeFile(options.outPath, outputJsonText, 'utf8');
  }

  return {
    corpusPaths: [...options.corpusPaths],
    fixturePath: options.outPath ?? null,
    jsonText: options.includeJsonText ? outputJsonText : null,
    kind: 'agent-session-v3-pilot-external-sample-fixture-set-exporter',
    result,
    summaryText: result.summaryText,
    version: 1,
  };
}

async function runAgentSessionV3PilotExternalSampleFixtureSetExporterCli() {
  const options = parseAgentSessionV3PilotExternalSampleFixtureSetExporterArgs(process.argv.slice(2));
  const exported = await runAgentSessionV3PilotExternalSampleFixtureSetExporter(options);
  console.log(exported.summaryText);
  if (exported.fixturePath) {
    console.log(`fixturePath=${exported.fixturePath}`);
  }
  if (exported.jsonText) {
    console.log(exported.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotExternalSampleFixtureSetExporterCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
