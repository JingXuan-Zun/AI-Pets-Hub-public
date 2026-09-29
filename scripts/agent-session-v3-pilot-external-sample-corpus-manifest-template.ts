import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { type AgentSessionV3PilotExternalSampleCorpusManifest } from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';

export interface RunAgentSessionV3PilotExternalSampleCorpusManifestTemplateOptions {
  includeJsonText?: boolean;
  outPath?: string | null;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotExternalSampleCorpusManifestTemplateResult {
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-external-sample-corpus-manifest-template';
  manifest: AgentSessionV3PilotExternalSampleCorpusManifest;
  manifestPath: string | null;
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotExternalSampleCorpusManifestTemplateArgs(
  args: readonly string[],
): RunAgentSessionV3PilotExternalSampleCorpusManifestTemplateOptions {
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
        throw new Error('Missing manifest output path after --out.');
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

function createAgentSessionV3PilotExternalSampleCorpusManifestTemplate(): AgentSessionV3PilotExternalSampleCorpusManifest {
  return {
    corpusOptions: {
      maxShadowDebugSamples: 20,
    },
    sources: [
      {
        label: 'replace-with-batch-label',
        path: './replace-with-debug-corpus.json',
      },
    ],
    thresholdProfiles: [
      {
        label: 'strict',
        thresholds: {
          allowInconclusiveBudgetStops: true,
          maxCollectorIssues: 0,
          maxInconclusive: 0,
          maxMismatches: 0,
          maxUnavailable: 0,
          minAgreementSamples: 1,
          minShadowSamples: 1,
          requireNoDisabledShadowSamples: true,
          requireNoInvalidTransitions: true,
          requireNoRunnerFailures: true,
          requireNoShadowOmissions: true,
          requireNoTransitionLimits: true,
        },
      },
      {
        label: 'relaxed-budget-and-step-limit',
        thresholds: {
          allowInconclusiveBudgetStops: true,
          maxCollectorIssues: 0,
          maxInconclusive: 0,
          maxMismatches: 0,
          maxUnavailable: 0,
          minAgreementSamples: 1,
          minShadowSamples: 1,
        },
      },
      {
        label: 'relaxed-single-mismatch',
        thresholds: {
          allowInconclusiveBudgetStops: true,
          maxCollectorIssues: 0,
          maxInconclusive: 0,
          maxMismatches: 1,
          maxUnavailable: 0,
          minAgreementSamples: 1,
          minShadowSamples: 1,
        },
      },
    ],
    thresholds: {
      allowInconclusiveBudgetStops: true,
      maxCollectorIssues: 0,
      maxInconclusive: 0,
      maxMismatches: 0,
      maxUnavailable: 0,
      minAgreementSamples: 1,
      minShadowSamples: 1,
    },
    useBatchThresholdOverrides: false,
  };
}

function stringifyAgentSessionV3PilotExternalSampleCorpusManifestTemplate(
  manifest: AgentSessionV3PilotExternalSampleCorpusManifest,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(manifest, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotExternalSampleCorpusManifestTemplate(
  options: RunAgentSessionV3PilotExternalSampleCorpusManifestTemplateOptions = {},
): Promise<AgentSessionV3PilotExternalSampleCorpusManifestTemplateResult> {
  const manifest = createAgentSessionV3PilotExternalSampleCorpusManifestTemplate();
  const outputJsonText = options.includeJsonText || options.outPath
    ? stringifyAgentSessionV3PilotExternalSampleCorpusManifestTemplate(manifest, {
      prettyJson: options.prettyJson,
    })
    : null;

  if (options.outPath && outputJsonText) {
    await writeFile(options.outPath, outputJsonText, 'utf8');
  }

  const summaryText = [
    'AgentSessionV3PilotExternalSampleCorpusManifestTemplate',
    `sources=${manifest.sources?.length ?? 0}`,
    `profiles=${manifest.thresholdProfiles?.length ?? 0}`,
  ].join(' ');

  return {
    jsonText: options.includeJsonText ? outputJsonText : null,
    kind: 'agent-session-v3-pilot-external-sample-corpus-manifest-template',
    manifest,
    manifestPath: options.outPath ?? null,
    summaryText,
    version: 1,
  };
}

async function runAgentSessionV3PilotExternalSampleCorpusManifestTemplateCli() {
  const options = parseAgentSessionV3PilotExternalSampleCorpusManifestTemplateArgs(process.argv.slice(2));
  const template = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate(options);
  console.log(template.summaryText);
  if (template.manifestPath) {
    console.log(`manifestPath=${template.manifestPath}`);
  }
  if (template.jsonText) {
    console.log(template.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotExternalSampleCorpusManifestTemplateCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
