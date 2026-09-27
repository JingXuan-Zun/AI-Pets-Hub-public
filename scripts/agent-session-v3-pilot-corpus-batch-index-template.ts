import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { type AgentSessionV3PilotCorpusBatchIndex } from './agent-session-v3-pilot-corpus-batch-index-report.ts';

export interface RunAgentSessionV3PilotCorpusBatchIndexTemplateOptions {
  includeJsonText?: boolean;
  outPath?: string | null;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotCorpusBatchIndexTemplateResult {
  index: AgentSessionV3PilotCorpusBatchIndex;
  indexPath: string | null;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-corpus-batch-index-template';
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotCorpusBatchIndexTemplateArgs(
  args: readonly string[],
): RunAgentSessionV3PilotCorpusBatchIndexTemplateOptions {
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
        throw new Error('Missing index output path after --out.');
      }
      outPath = nextArg;
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return {
    includeJsonText,
    outPath,
    prettyJson,
  };
}

function createAgentSessionV3PilotCorpusBatchIndexTemplate(): AgentSessionV3PilotCorpusBatchIndex {
  return {
    batches: [
      {
        generatedAt: 'replace-with-iso-generated-at',
        label: 'replace-with-baseline-label',
        manifestPath: './replace-with-baseline-manifest.json',
        notes: 'replace with baseline corpus notes',
        sourceKind: 'baseline',
      },
      {
        generatedAt: 'replace-with-iso-generated-at',
        label: 'replace-with-manual-label',
        manifestPath: './replace-with-manual-manifest.json',
        notes: 'replace with manual or production-like corpus notes',
        sourceKind: 'manual',
      },
    ],
    version: 1,
  };
}

function stringifyAgentSessionV3PilotCorpusBatchIndexTemplate(
  index: AgentSessionV3PilotCorpusBatchIndex,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(index, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotCorpusBatchIndexTemplate(
  options: RunAgentSessionV3PilotCorpusBatchIndexTemplateOptions = {},
): Promise<AgentSessionV3PilotCorpusBatchIndexTemplateResult> {
  const index = createAgentSessionV3PilotCorpusBatchIndexTemplate();
  const outputJsonText = options.includeJsonText || options.outPath
    ? stringifyAgentSessionV3PilotCorpusBatchIndexTemplate(index, {
      prettyJson: options.prettyJson,
    })
    : null;

  if (options.outPath && outputJsonText) {
    await writeFile(options.outPath, outputJsonText, 'utf8');
  }

  const summaryText = [
    'AgentSessionV3PilotCorpusBatchIndexTemplate',
    `batches=${index.batches?.length ?? 0}`,
  ].join(' ');

  return {
    index,
    indexPath: options.outPath ?? null,
    jsonText: options.includeJsonText ? outputJsonText : null,
    kind: 'agent-session-v3-pilot-corpus-batch-index-template',
    summaryText,
    version: 1,
  };
}

async function runAgentSessionV3PilotCorpusBatchIndexTemplateCli() {
  const options = parseAgentSessionV3PilotCorpusBatchIndexTemplateArgs(process.argv.slice(2));
  const template = await runAgentSessionV3PilotCorpusBatchIndexTemplate(options);
  console.log(template.summaryText);
  if (template.indexPath) {
    console.log(`indexPath=${template.indexPath}`);
  }
  if (template.jsonText) {
    console.log(template.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotCorpusBatchIndexTemplateCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
