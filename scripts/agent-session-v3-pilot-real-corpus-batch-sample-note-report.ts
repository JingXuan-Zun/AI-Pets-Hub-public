import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type AgentSessionV3PilotRealCorpusBatchSampleNoteStatus =
  | 'complete'
  | 'missing'
  | 'open-items';

export interface AgentSessionV3PilotRealCorpusBatchSampleNoteOpenItemCheck {
  id: string;
  label: string;
  placeholder: string;
}

export interface AgentSessionV3PilotRealCorpusBatchSampleNoteOpenItem {
  id: string;
  label: string;
  placeholder: string;
}

export interface RunAgentSessionV3PilotRealCorpusBatchSampleNoteReportOptions {
  includeJsonText?: boolean;
  notePath: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult {
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-sample-note-report';
  notePath: string;
  notePresent: boolean;
  openItemCount: number;
  openItems: AgentSessionV3PilotRealCorpusBatchSampleNoteOpenItem[];
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchSampleNoteStatus;
  summaryText: string;
  version: 1;
}

export const AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS: readonly AgentSessionV3PilotRealCorpusBatchSampleNoteOpenItemCheck[] = [
  {
    id: 'batch-label',
    label: 'Batch label',
    placeholder: 'replace-with-real-batch-label',
  },
  {
    id: 'export-date',
    label: 'Export date',
    placeholder: 'replace-with-export-date',
  },
  {
    id: 'source-environment',
    label: 'Source environment',
    placeholder: 'replace-with-machine-app-mode-or-branch',
  },
  {
    id: 'scenario-family',
    label: 'Scenario family',
    placeholder: 'replace-with-scenario-family',
  },
  {
    id: 'export-source',
    label: 'Export command or source',
    placeholder: 'replace-with-export-command-or-manual-source',
  },
  {
    id: 'sample-source',
    label: 'Sample source',
    placeholder: 'replace-with-sample-source-real-exported-rehearsal-or-unknown',
  },
  {
    id: 'sample-source-status',
    label: 'Sample source status',
    placeholder: 'replace-with-sample-source-status',
  },
  {
    id: 'corpus-paths',
    label: 'Corpus file paths',
    placeholder: 'replace-with-corpus-json-paths',
  },
  {
    id: 'sample-count',
    label: 'Approximate sample count',
    placeholder: 'replace-with-sample-count',
  },
  {
    id: 'validator-command',
    label: 'Validator command intake directory',
    placeholder: 'replace-with-intake-dir',
  },
  {
    id: 'validator-status',
    label: 'Validator status',
    placeholder: 'replace-with-ready-mixed-not-ready-empty-or-missing',
  },
  {
    id: 'manifest-source-count',
    label: 'Manifest sources',
    placeholder: 'replace-with-manifestSources',
  },
  {
    id: 'index-manifest-count',
    label: 'Index manifests',
    placeholder: 'replace-with-indexManifests',
  },
  {
    id: 'readiness-counts',
    label: 'Readiness counts',
    placeholder: 'ready=replace mixed=replace notReady=replace empty=replace',
  },
  {
    id: 'p0-target-status-command',
    label: 'P0 target status command intake directory',
    placeholder: 'replace-with-p0-intake-dir',
  },
  {
    id: 'p0-production-like-signal',
    label: 'P0 production-like target signal',
    placeholder: 'replace-with-real-production-like-sample-signal',
  },
  {
    id: 'p0-real-exported-signal',
    label: 'P0 real exported target signal',
    placeholder: 'replace-with-real-exported-corpus-signal',
  },
  {
    id: 'threshold-comparison',
    label: 'Threshold profile comparison needed',
    placeholder: 'yes/no and why',
  },
  {
    id: 'evidence-quality',
    label: 'Evidence quality',
    placeholder: 'replace-with-short-assessment',
  },
  {
    id: 'batch-proves',
    label: 'What this batch proves',
    placeholder: 'replace-with-scope',
  },
  {
    id: 'batch-limitations',
    label: 'What this batch does not prove',
    placeholder: 'replace-with-limitations',
  },
  {
    id: 'follow-up-samples',
    label: 'Follow-up samples needed',
    placeholder: 'replace-with-next-samples',
  },
  {
    id: 'threshold-action',
    label: 'Threshold action',
    placeholder: 'keep-current / compare-profiles / propose-manual-review',
  },
];

function parseAgentSessionV3PilotRealCorpusBatchSampleNoteReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchSampleNoteReportOptions {
  let includeJsonText = false;
  let notePath: string | null = null;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--path') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing sample note path after --path.');
      }
      notePath = nextArg;
      index += 1;
    } else if (!notePath) {
      notePath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!notePath) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts --path sample-note-template.md [--json] [--pretty]');
  }

  return {
    includeJsonText,
    notePath,
    prettyJson,
  };
}

function getErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

function createAgentSessionV3PilotRealCorpusBatchSampleNoteSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult,
    'notePresent' | 'openItemCount' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchSampleNoteReport status=${result.status}`,
    `notePresent=${result.notePresent ? 'yes' : 'no'}`,
    `openItems=${result.openItemCount}`,
  ].join(' ');
}

function createAgentSessionV3PilotRealCorpusBatchSampleNoteReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult,
    'notePath' | 'openItems' | 'summaryText'
  >,
) {
  const openItemLines = result.openItems.length
    ? [
      'sampleNoteOpenItems:',
      ...result.openItems.map((item) => `- ${item.id}: ${item.label} still contains ${item.placeholder}`),
    ]
    : ['sampleNoteOpenItems: none'];

  return [
    result.summaryText,
    `sampleNotePath: ${result.notePath}`,
    ...openItemLines,
  ].join('\n');
}

function createAgentSessionV3PilotRealCorpusBatchSampleNoteJsonText(
  result: AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchSampleNoteReportFromText(options: {
  includeJsonText?: boolean;
  notePath: string;
  noteText: string;
  prettyJson?: boolean;
}): AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult {
  const notePath = path.resolve(options.notePath);
  const openItems = AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS
    .filter((check) => options.noteText.includes(check.placeholder))
    .map((check) => ({
      id: check.id,
      label: check.label,
      placeholder: check.placeholder,
    }));
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult = {
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-sample-note-report',
    notePath,
    notePresent: true,
    openItemCount: openItems.length,
    openItems,
    reportText: '',
    status: openItems.length > 0 ? 'open-items' : 'complete',
    summaryText: '',
    version: 1,
  };
  const summaryText = createAgentSessionV3PilotRealCorpusBatchSampleNoteSummaryText(resultWithoutJson);
  const resultWithReport = {
    ...resultWithoutJson,
    reportText: createAgentSessionV3PilotRealCorpusBatchSampleNoteReportText({
      ...resultWithoutJson,
      summaryText,
    }),
    summaryText,
  };

  return {
    ...resultWithReport,
    jsonText: options.includeJsonText
      ? createAgentSessionV3PilotRealCorpusBatchSampleNoteJsonText(resultWithReport, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

function createAgentSessionV3PilotRealCorpusBatchMissingSampleNoteReport(options: {
  includeJsonText?: boolean;
  notePath: string;
  prettyJson?: boolean;
}): AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult {
  const notePath = path.resolve(options.notePath);
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult = {
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-sample-note-report',
    notePath,
    notePresent: false,
    openItemCount: 0,
    openItems: [],
    reportText: '',
    status: 'missing',
    summaryText: '',
    version: 1,
  };
  const summaryText = createAgentSessionV3PilotRealCorpusBatchSampleNoteSummaryText(resultWithoutJson);
  const resultWithReport = {
    ...resultWithoutJson,
    reportText: createAgentSessionV3PilotRealCorpusBatchSampleNoteReportText({
      ...resultWithoutJson,
      summaryText,
    }),
    summaryText,
  };

  return {
    ...resultWithReport,
    jsonText: options.includeJsonText
      ? createAgentSessionV3PilotRealCorpusBatchSampleNoteJsonText(resultWithReport, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

export async function runAgentSessionV3PilotRealCorpusBatchSampleNoteReport(
  options: RunAgentSessionV3PilotRealCorpusBatchSampleNoteReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult> {
  const notePath = path.resolve(options.notePath);

  try {
    const noteText = await readFile(notePath, 'utf8');

    return createAgentSessionV3PilotRealCorpusBatchSampleNoteReportFromText({
      includeJsonText: options.includeJsonText,
      notePath,
      noteText,
      prettyJson: options.prettyJson,
    });
  } catch (error: unknown) {
    if (getErrorCode(error) !== 'ENOENT') {
      throw error;
    }

    return createAgentSessionV3PilotRealCorpusBatchMissingSampleNoteReport({
      includeJsonText: options.includeJsonText,
      notePath,
      prettyJson: options.prettyJson,
    });
  }
}

async function runAgentSessionV3PilotRealCorpusBatchSampleNoteReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchSampleNoteReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchSampleNoteReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchSampleNoteReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
