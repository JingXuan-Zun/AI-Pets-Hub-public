import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotExternalSampleFixtureBatch,
  type AgentSessionV3PilotExternalSampleFixtureBatchResult,
  type AgentSessionV3PilotExternalSampleFixtureSet,
} from '../src/agent/legacy/index.ts';

export interface RunAgentSessionV3PilotExternalSampleFixtureBatchLoaderOptions {
  fixturePath: string;
  includeJsonText?: boolean;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotExternalSampleFixtureBatchLoaderResult {
  fixturePath: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-external-sample-fixture-batch-loader';
  result: AgentSessionV3PilotExternalSampleFixtureBatchResult;
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotExternalSampleFixtureBatchLoaderArgs(
  args: readonly string[],
) {
  let fixturePath: string | null = null;
  let includeJsonText = false;
  let prettyJson = false;

  for (const arg of args) {
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (!fixturePath) {
      fixturePath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!fixturePath) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-external-sample-fixture-batch-loader.ts <fixture.json> [--json] [--pretty]');
  }

  return {
    fixturePath,
    includeJsonText,
    prettyJson,
  };
}

function createAgentSessionV3PilotExternalSampleFixtureBatchLoaderJsonText(options: {
  prettyJson?: boolean;
  result: AgentSessionV3PilotExternalSampleFixtureBatchResult;
}) {
  return JSON.stringify(options.result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotExternalSampleFixtureBatchLoader(
  options: RunAgentSessionV3PilotExternalSampleFixtureBatchLoaderOptions,
): Promise<AgentSessionV3PilotExternalSampleFixtureBatchLoaderResult> {
  const fixtureText = await readFile(options.fixturePath, 'utf8');
  const fixture = JSON.parse(fixtureText) as AgentSessionV3PilotExternalSampleFixtureSet;
  const result = createAgentSessionV3PilotExternalSampleFixtureBatch(fixture);
  return {
    fixturePath: options.fixturePath,
    jsonText: options.includeJsonText
      ? createAgentSessionV3PilotExternalSampleFixtureBatchLoaderJsonText({
        prettyJson: options.prettyJson,
        result,
      })
      : null,
    kind: 'agent-session-v3-pilot-external-sample-fixture-batch-loader',
    result,
    summaryText: result.summaryText,
    version: 1,
  };
}

async function runAgentSessionV3PilotExternalSampleFixtureBatchLoaderCli() {
  const options = parseAgentSessionV3PilotExternalSampleFixtureBatchLoaderArgs(process.argv.slice(2));
  const loaded = await runAgentSessionV3PilotExternalSampleFixtureBatchLoader(options);
  console.log(loaded.summaryText);
  if (loaded.jsonText) {
    console.log(loaded.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotExternalSampleFixtureBatchLoaderCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
