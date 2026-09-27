import { type AgentSessionV3PilotCorpusReadinessThresholds } from './agentSessionV3PilotCorpusReadiness';
import {
  type AgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotDebugSampleCorpusExportOptions,
} from './agentSessionV3PilotDebugSampleCorpus';
import {
  type AgentSessionV3PilotExternalSampleFixtureBatch,
  type AgentSessionV3PilotExternalSampleFixtureSet,
} from './agentSessionV3PilotExternalSampleFixtureBatch';

export type AgentSessionV3PilotExternalSampleFixtureSetExportStatus =
  | 'empty'
  | 'exported'
  | 'partial';

export interface AgentSessionV3PilotExternalSampleFixtureSetExportCorpusSource {
  corpus: AgentSessionV3PilotDebugSampleCorpusExport | null;
  label?: string | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export type AgentSessionV3PilotExternalSampleFixtureSetExportSource =
  | AgentSessionV3PilotDebugSampleCorpusExport
  | AgentSessionV3PilotExternalSampleFixtureSetExportCorpusSource
  | null;

export interface CreateAgentSessionV3PilotExternalSampleFixtureSetExportOptions {
  corpusOptions?: AgentSessionV3PilotDebugSampleCorpusExportOptions;
  sources?: readonly AgentSessionV3PilotExternalSampleFixtureSetExportSource[] | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotExternalSampleFixtureSetExportIssue {
  index: number;
  label: string | null;
  reason: string;
}

export interface AgentSessionV3PilotExternalSampleFixtureSetExportResult {
  batchCount: number;
  fixtureSet: AgentSessionV3PilotExternalSampleFixtureSet;
  issueCount: number;
  issues: AgentSessionV3PilotExternalSampleFixtureSetExportIssue[];
  kind: 'agent-session-v3-pilot-external-sample-fixture-set-export';
  sourceCount: number;
  status: AgentSessionV3PilotExternalSampleFixtureSetExportStatus;
  summaryText: string;
  version: 1;
}

interface NormalizedAgentSessionV3PilotExternalSampleFixtureSetExportSource {
  corpus: AgentSessionV3PilotDebugSampleCorpusExport | null;
  invalidReason: string | null;
  label: string | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isAgentSessionV3PilotDebugSampleCorpusExport(
  value: unknown,
): value is AgentSessionV3PilotDebugSampleCorpusExport {
  return isRecord(value)
    && value.kind === 'agent-session-v3-pilot-debug-sample-corpus'
    && value.version === 1;
}

function getAgentSessionV3PilotExternalSampleFixtureSetExportLabel(
  value: unknown,
) {
  return typeof value === 'string' && value.trim()
    ? value
    : null;
}

function normalizeAgentSessionV3PilotExternalSampleFixtureSetExportSource(
  source: AgentSessionV3PilotExternalSampleFixtureSetExportSource,
): NormalizedAgentSessionV3PilotExternalSampleFixtureSetExportSource {
  if (!source) {
    return {
      corpus: null,
      invalidReason: null,
      label: null,
    };
  }

  if (isAgentSessionV3PilotDebugSampleCorpusExport(source)) {
    return {
      corpus: source,
      invalidReason: null,
      label: null,
    };
  }

  if (!isRecord(source) || !('corpus' in source)) {
    return {
      corpus: null,
      invalidReason: 'External sample fixture source is not a debug sample corpus export or labelled corpus wrapper.',
      label: null,
    };
  }

  const label = getAgentSessionV3PilotExternalSampleFixtureSetExportLabel(source.label);
  const corpus = source.corpus;

  if (!corpus) {
    return {
      corpus: null,
      invalidReason: null,
      label,
      thresholds: source.thresholds as AgentSessionV3PilotCorpusReadinessThresholds | undefined,
    };
  }

  if (!isAgentSessionV3PilotDebugSampleCorpusExport(corpus)) {
    return {
      corpus: null,
      invalidReason: 'External sample fixture corpus is not a v3 pilot debug sample corpus export.',
      label,
      thresholds: source.thresholds as AgentSessionV3PilotCorpusReadinessThresholds | undefined,
    };
  }

  return {
    corpus,
    invalidReason: null,
    label,
    thresholds: source.thresholds as AgentSessionV3PilotCorpusReadinessThresholds | undefined,
  };
}

function createAgentSessionV3PilotExternalSampleFixtureBatchFromCorpus(
  source: NormalizedAgentSessionV3PilotExternalSampleFixtureSetExportSource,
): AgentSessionV3PilotExternalSampleFixtureBatch {
  const corpus = source.corpus;
  return {
    agreementReports: [{
      label: source.label,
      report: corpus?.agreementReport ?? null,
    }],
    label: source.label,
    shadowDebugSamples: (corpus?.shadowDebugSamples ?? []).map((sample) => ({
      label: sample.label ?? source.label,
      shadow: sample.shadow,
    })),
    thresholds: source.thresholds,
  };
}

function getAgentSessionV3PilotExternalSampleFixtureSetExportStatus(options: {
  batchCount: number;
  issueCount: number;
}): AgentSessionV3PilotExternalSampleFixtureSetExportStatus {
  if (options.issueCount > 0) {
    return 'partial';
  }

  if (options.batchCount === 0) {
    return 'empty';
  }

  return 'exported';
}

function createAgentSessionV3PilotExternalSampleFixtureSetExportSummaryText(options: {
  batchCount: number;
  issueCount: number;
  sourceCount: number;
  status: AgentSessionV3PilotExternalSampleFixtureSetExportStatus;
}) {
  return [
    `AgentSessionV3PilotExternalSampleFixtureSetExport status=${options.status}`,
    `sources=${options.sourceCount}`,
    `batches=${options.batchCount}`,
    `issues=${options.issueCount}`,
  ].join(' ');
}

export function createAgentSessionV3PilotExternalSampleFixtureSetExport(
  options: CreateAgentSessionV3PilotExternalSampleFixtureSetExportOptions = {},
): AgentSessionV3PilotExternalSampleFixtureSetExportResult {
  const sources = options.sources ?? [];
  const batches: AgentSessionV3PilotExternalSampleFixtureBatch[] = [];
  const issues: AgentSessionV3PilotExternalSampleFixtureSetExportIssue[] = [];

  for (const [index, source] of sources.entries()) {
    const normalized = normalizeAgentSessionV3PilotExternalSampleFixtureSetExportSource(source);
    if (normalized.invalidReason) {
      issues.push({
        index,
        label: normalized.label,
        reason: normalized.invalidReason,
      });
      continue;
    }

    if (!normalized.corpus) {
      continue;
    }

    batches.push(createAgentSessionV3PilotExternalSampleFixtureBatchFromCorpus(normalized));
  }

  const status = getAgentSessionV3PilotExternalSampleFixtureSetExportStatus({
    batchCount: batches.length,
    issueCount: issues.length,
  });
  const fixtureSet: AgentSessionV3PilotExternalSampleFixtureSet = {
    batches,
    corpusOptions: options.corpusOptions,
    thresholds: options.thresholds,
  };

  return {
    batchCount: batches.length,
    fixtureSet,
    issueCount: issues.length,
    issues,
    kind: 'agent-session-v3-pilot-external-sample-fixture-set-export',
    sourceCount: sources.length,
    status,
    summaryText: createAgentSessionV3PilotExternalSampleFixtureSetExportSummaryText({
      batchCount: batches.length,
      issueCount: issues.length,
      sourceCount: sources.length,
      status,
    }),
    version: 1,
  };
}

export function stringifyAgentSessionV3PilotExternalSampleFixtureSet(
  fixtureSet: AgentSessionV3PilotExternalSampleFixtureSet,
  options: { pretty?: boolean } = {},
) {
  return JSON.stringify(fixtureSet, null, options.pretty ? 2 : 0);
}
