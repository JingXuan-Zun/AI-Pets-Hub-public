import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchFinalGapReport,
  type AgentSessionV3PilotRealCorpusBatchFinalGapItem,
  type AgentSessionV3PilotRealCorpusBatchFinalGapPriority,
  type AgentSessionV3PilotRealCorpusBatchFinalGapReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts';
import {
  AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS,
} from './agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts';

export type AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportStatus =
  | 'needs-intake-filling'
  | 'no-final-gaps';

export interface AgentSessionV3PilotRealCorpusBatchIntakeFillingSampleNoteField {
  id: string;
  label: string;
  placeholder: string;
  reason: string;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeFillingItem {
  boundary: string;
  gapCount: number;
  gapKind: AgentSessionV3PilotRealCorpusBatchFinalGapItem['gapKind'];
  indexFields: string[];
  manualEvidence: string;
  manifestFields: string[];
  priority: AgentSessionV3PilotRealCorpusBatchFinalGapPriority;
  sampleNoteFields: AgentSessionV3PilotRealCorpusBatchIntakeFillingSampleNoteField[];
  sourceReports: string[];
  title: string;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportResult {
  finalGapCount: number;
  finalGapSummaryText: string;
  fillingItemCount: number;
  fillingItems: AgentSessionV3PilotRealCorpusBatchIntakeFillingItem[];
  followUpReportPaths: string[];
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report';
  priorityCounts: Record<AgentSessionV3PilotRealCorpusBatchFinalGapPriority, number>;
  readyForProductionRuntime: false;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportStatus;
  summaryText: string;
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

type SampleNoteFieldId =
  typeof AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS[number]['id'];

type GapKind = AgentSessionV3PilotRealCorpusBatchFinalGapItem['gapKind'];

interface SampleNoteFieldSpec {
  id: SampleNoteFieldId;
  reason: string;
}

interface FillingSpec {
  indexFields: string[];
  manifestFields: string[];
  sampleNoteFields: SampleNoteFieldSpec[];
}

const SAMPLE_NOTE_FIELD_BY_ID = new Map(
  AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS
    .map((field) => [field.id, field]),
);

const FOLLOW_UP_REPORT_PATHS = [
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
];

const FILLING_SPECS: Record<GapKind, FillingSpec> = {
  'broader-real-corpus': {
    indexFields: [
      'batches[].label',
      'batches[].sourceKind',
      'batches[].notes',
    ],
    manifestFields: [
      'sources[].label',
      'sources[].path',
    ],
    sampleNoteFields: [
      {
        id: 'scenario-family',
        reason: 'Shows whether the reviewed corpus spans more than one task family.',
      },
      {
        id: 'evidence-quality',
        reason: 'Captures whether the broader sample is credible enough for manual interpretation.',
      },
      {
        id: 'batch-proves',
        reason: 'States the coverage scope that this batch actually supports.',
      },
      {
        id: 'batch-limitations',
        reason: 'Keeps narrow or biased coverage visible before runtime authority is discussed.',
      },
      {
        id: 'follow-up-samples',
        reason: 'Records the next sample families still needed after review.',
      },
    ],
  },
  'manifest-distribution': {
    indexFields: [
      'batches[].label',
      'batches[].sourceKind',
      'batches[].manifestPath',
      'batches[].notes',
    ],
    manifestFields: [
      'sources[].label',
      'sources[].path',
    ],
    sampleNoteFields: [
      {
        id: 'scenario-family',
        reason: 'Connects manifest distribution evidence to scenario coverage.',
      },
      {
        id: 'manifest-source-count',
        reason: 'Records how many manifest sources contribute to the distribution.',
      },
      {
        id: 'index-manifest-count',
        reason: 'Records how many indexed manifests are being compared.',
      },
      {
        id: 'readiness-counts',
        reason: 'Shows whether distribution gaps cluster around readiness states.',
      },
      {
        id: 'batch-limitations',
        reason: 'Keeps distribution blind spots explicit.',
      },
    ],
  },
  'real-exported-corpus': {
    indexFields: [
      'batches[].label',
      'batches[].sourceKind',
      'batches[].manifestPath',
      'batches[].generatedAt',
    ],
    manifestFields: [
      'sources[].label',
      'sources[].path',
    ],
    sampleNoteFields: [
      {
        id: 'export-source',
        reason: 'Identifies where the exported corpus came from without collecting new samples.',
      },
      {
        id: 'sample-source',
        reason: 'Distinguishes real exported evidence from rehearsal or unknown-source samples.',
      },
      {
        id: 'sample-source-status',
        reason: 'Records whether the source is verified enough for manual review.',
      },
      {
        id: 'corpus-paths',
        reason: 'Points reviewers to the already exported corpus files.',
      },
      {
        id: 'sample-count',
        reason: 'Gives the reviewer the size of the real exported batch.',
      },
      {
        id: 'validator-command',
        reason: 'Records the report-only validator command used by the caller.',
      },
      {
        id: 'validator-status',
        reason: 'Shows whether machine-readable intake checks are blocked, mixed, or ready for review.',
      },
      {
        id: 'manifest-source-count',
        reason: 'Links the real corpus files to manifest coverage.',
      },
      {
        id: 'p0-target-status-command',
        reason: 'Records the caller-owned P0 status check for the intake directory.',
      },
      {
        id: 'p0-real-exported-signal',
        reason: 'Captures the P0 signal for the real exported corpus gap.',
      },
      {
        id: 'batch-proves',
        reason: 'States what this real exported batch can legitimately support.',
      },
    ],
  },
  'real-exported-fixture': {
    indexFields: [
      'batches[].label',
      'batches[].sourceKind',
      'batches[].manifestPath',
      'batches[].notes',
    ],
    manifestFields: [
      'sources[].label',
      'sources[].path',
    ],
    sampleNoteFields: [
      {
        id: 'sample-source',
        reason: 'Confirms fixture candidates came from reviewed exported evidence.',
      },
      {
        id: 'corpus-paths',
        reason: 'Identifies the reviewed exported files that may become fixture candidates.',
      },
      {
        id: 'validator-status',
        reason: 'Keeps blocker or mixed validation states visible before fixture selection.',
      },
      {
        id: 'batch-proves',
        reason: 'Explains why the candidate is representative enough to preserve.',
      },
      {
        id: 'follow-up-samples',
        reason: 'Records fixture coverage still missing after this candidate set.',
      },
    ],
  },
  'real-production-like-sample': {
    indexFields: [
      'batches[].label',
      'batches[].sourceKind',
      'batches[].manifestPath',
      'batches[].notes',
    ],
    manifestFields: [
      'sources[].label',
      'sources[].path',
    ],
    sampleNoteFields: [
      {
        id: 'source-environment',
        reason: 'Describes the machine, app mode, or branch that makes the sample production-like.',
      },
      {
        id: 'scenario-family',
        reason: 'Connects the sample to a production-like task family.',
      },
      {
        id: 'export-source',
        reason: 'Identifies how the production-like sample was exported.',
      },
      {
        id: 'sample-source',
        reason: 'Separates production-like evidence from rehearsal or unknown-source samples.',
      },
      {
        id: 'sample-source-status',
        reason: 'Records whether the source claim is reviewable.',
      },
      {
        id: 'sample-count',
        reason: 'Shows how much production-like evidence is present.',
      },
      {
        id: 'validator-status',
        reason: 'Shows whether the intake can be interpreted manually.',
      },
      {
        id: 'p0-target-status-command',
        reason: 'Records the caller-owned P0 status check for the production-like intake.',
      },
      {
        id: 'p0-production-like-signal',
        reason: 'Captures the P0 signal for the production-like sample gap.',
      },
      {
        id: 'evidence-quality',
        reason: 'Captures reviewer confidence in the production-like evidence.',
      },
      {
        id: 'batch-proves',
        reason: 'States what production-like behavior the batch supports.',
      },
      {
        id: 'batch-limitations',
        reason: 'Keeps remaining production-like blind spots visible.',
      },
    ],
  },
  'real-threshold-profile': {
    indexFields: [
      'batches[].label',
      'batches[].sourceKind',
      'batches[].notes',
    ],
    manifestFields: [
      'sources[].label',
      'sources[].path',
    ],
    sampleNoteFields: [
      {
        id: 'validator-status',
        reason: 'Shows whether threshold comparison is based on interpretable intake evidence.',
      },
      {
        id: 'readiness-counts',
        reason: 'Records baseline readiness distribution before comparing profiles.',
      },
      {
        id: 'threshold-comparison',
        reason: 'Captures whether threshold profile comparison is needed and why.',
      },
      {
        id: 'evidence-quality',
        reason: 'Keeps threshold interpretation tied to evidence quality.',
      },
      {
        id: 'threshold-action',
        reason: 'Records the manual threshold follow-up without choosing a threshold.',
      },
    ],
  },
};

function parseArgs(
  args: readonly string[],
): CreateAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportOptions {
  let includeJsonText = false;
  let prettyJson = false;

  for (const arg of args) {
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return {
    includeJsonText,
    prettyJson,
  };
}

function createSampleNoteFields(
  specs: readonly SampleNoteFieldSpec[],
): AgentSessionV3PilotRealCorpusBatchIntakeFillingSampleNoteField[] {
  return specs.map((spec) => {
    const field = SAMPLE_NOTE_FIELD_BY_ID.get(spec.id);

    if (!field) {
      throw new Error(`Unknown real corpus batch sample note field: ${spec.id}`);
    }

    return {
      id: field.id,
      label: field.label,
      placeholder: field.placeholder,
      reason: spec.reason,
    };
  });
}

function createFillingItems(
  finalGaps: readonly AgentSessionV3PilotRealCorpusBatchFinalGapItem[],
): AgentSessionV3PilotRealCorpusBatchIntakeFillingItem[] {
  return finalGaps.map((gap) => {
    const spec = FILLING_SPECS[gap.gapKind];

    return {
      boundary: gap.boundary,
      gapCount: gap.gapCount,
      gapKind: gap.gapKind,
      indexFields: spec.indexFields,
      manualEvidence: gap.manualEvidence,
      manifestFields: spec.manifestFields,
      priority: gap.priority,
      sampleNoteFields: createSampleNoteFields(spec.sampleNoteFields),
      sourceReports: [
        'scripts/agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
        ...gap.sourceReports,
        'scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
        'scripts/agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts',
        ...FOLLOW_UP_REPORT_PATHS,
      ],
      title: gap.title,
    };
  });
}

function createStatus(
  fillingItemCount: number,
): AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportStatus {
  return fillingItemCount > 0 ? 'needs-intake-filling' : 'no-final-gaps';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportResult,
    | 'fillingItemCount'
    | 'finalGapCount'
    | 'priorityCounts'
    | 'readyForProductionRuntime'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport status=${result.status}`,
    `fillingItems=${result.fillingItemCount}`,
    `finalGaps=${result.finalGapCount}`,
    `P0=${result.priorityCounts.P0}`,
    `P1=${result.priorityCounts.P1}`,
    `P2=${result.priorityCounts.P2}`,
    `unprioritized=${result.priorityCounts.unprioritized}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportResult,
    | 'fillingItems'
    | 'finalGapSummaryText'
    | 'followUpReportPaths'
    | 'guardrail'
    | 'priorityCounts'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `finalGapSummary=${result.finalGapSummaryText}`,
    'priorityCounts:',
    ...Object.entries(result.priorityCounts).map(([priority, count]) => `- priority=${priority} fillingItems=${count}`),
    result.followUpReportPaths.length ? 'followUpReports:' : 'followUpReports: none',
    ...result.followUpReportPaths.map((reportPath) => `- ${reportPath}`),
    result.fillingItems.length ? 'manualIntakeFillingItems:' : 'manualIntakeFillingItems: none',
    ...result.fillingItems.map((item) => [
      `- priority=${item.priority}`,
      `gapKind=${item.gapKind}`,
      `gapCount=${item.gapCount}`,
      `title=${item.title}`,
      `sampleNoteFields=${item.sampleNoteFields.map((field) => field.id).join(',')}`,
      `manifestFields=${item.manifestFields.join(',')}`,
      `indexFields=${item.indexFields.join(',')}`,
      `manualEvidence=${item.manualEvidence}`,
      `sourceReports=${item.sourceReports.join(',')}`,
      `boundary=${item.boundary}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport(
  options: CreateAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportOptions = {},
): AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const finalGapReport: AgentSessionV3PilotRealCorpusBatchFinalGapReportResult =
    createAgentSessionV3PilotRealCorpusBatchFinalGapReport({
      projectRoot,
    });
  const fillingItems = createFillingItems(finalGapReport.finalGaps);
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportResult = {
    finalGapCount: finalGapReport.finalGapCount,
    finalGapSummaryText: finalGapReport.summaryText,
    fillingItemCount: fillingItems.length,
    fillingItems,
    followUpReportPaths: FOLLOW_UP_REPORT_PATHS,
    guardrail: 'caller-owned intake filling support report only; does not discover directories, create intake directories, collect samples, auto-fill files, write manifests, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report',
    priorityCounts: finalGapReport.priorityCounts,
    readyForProductionRuntime: false,
    reportText: '',
    status: createStatus(fillingItems.length),
    summaryText: '',
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutJson);
  const resultWithReport = {
    ...resultWithoutJson,
    reportText: createReportText({
      ...resultWithoutJson,
      summaryText,
    }),
    summaryText,
  };

  return {
    ...resultWithReport,
    jsonText: options.includeJsonText
      ? createJsonText(resultWithReport, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

function runAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReportCli();
}
