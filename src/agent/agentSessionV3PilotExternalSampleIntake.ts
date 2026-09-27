import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotDebugSampleCorpusExportOptions,
  type AgentSessionV3PilotDebugSampleCorpusShadowSample,
} from './agentSessionV3PilotDebugSampleCorpus';
import { type AgentSessionV3PilotShadowAgreementReportExport } from './agentSessionV3PilotShadowAgreement';
import { type AgentSessionV3PilotShadowDebugExport } from './agentSessionV3PilotShadowDebugExport';

export type AgentSessionV3PilotExternalSampleIntakeIssueSource =
  | 'agreement-report'
  | 'shadow-debug';

export type AgentSessionV3PilotExternalSampleIntakeStatus =
  | 'accepted'
  | 'empty'
  | 'partial';

export interface AgentSessionV3PilotExternalSampleIntakeAgreementReportSample {
  label?: string | null;
  report: AgentSessionV3PilotShadowAgreementReportExport | null;
}

export interface AgentSessionV3PilotExternalSampleIntakeShadowDebugSample {
  label?: string | null;
  shadow: AgentSessionV3PilotShadowDebugExport | null;
}

export type AgentSessionV3PilotExternalSampleIntakeAgreementReportSource =
  | AgentSessionV3PilotShadowAgreementReportExport
  | AgentSessionV3PilotExternalSampleIntakeAgreementReportSample
  | null;

export type AgentSessionV3PilotExternalSampleIntakeShadowDebugSource =
  | AgentSessionV3PilotShadowDebugExport
  | AgentSessionV3PilotDebugSampleCorpusShadowSample
  | AgentSessionV3PilotExternalSampleIntakeShadowDebugSample
  | null;

export interface CreateAgentSessionV3PilotExternalSampleIntakeOptions {
  agreementReports?: readonly AgentSessionV3PilotExternalSampleIntakeAgreementReportSource[] | null;
  corpusOptions?: AgentSessionV3PilotDebugSampleCorpusExportOptions;
  shadowDebugSamples?: readonly AgentSessionV3PilotExternalSampleIntakeShadowDebugSource[] | null;
}

export interface AgentSessionV3PilotExternalSampleIntakeIssue {
  index: number;
  label: string | null;
  reason: string;
  source: AgentSessionV3PilotExternalSampleIntakeIssueSource;
}

export interface AgentSessionV3PilotExternalSampleIntakeResult {
  corpus: AgentSessionV3PilotDebugSampleCorpusExport;
  issueCount: number;
  issues: AgentSessionV3PilotExternalSampleIntakeIssue[];
  kind: 'agent-session-v3-pilot-external-sample-intake';
  status: AgentSessionV3PilotExternalSampleIntakeStatus;
  summaryText: string;
  version: 1;
}

function isAgentSessionV3PilotShadowAgreementReportExport(
  value: unknown,
): value is AgentSessionV3PilotShadowAgreementReportExport {
  return Boolean(value)
    && typeof value === 'object'
    && (value as { kind?: unknown }).kind === 'agent-session-v3-pilot-shadow-agreement-report'
    && (value as { version?: unknown }).version === 1;
}

function isAgentSessionV3PilotShadowDebugExport(
  value: unknown,
): value is AgentSessionV3PilotShadowDebugExport {
  return Boolean(value)
    && typeof value === 'object'
    && (value as { kind?: unknown }).kind === 'agent-session-v3-pilot-shadow-debug'
    && (value as { version?: unknown }).version === 1;
}

function normalizeAgentSessionV3PilotExternalSampleIntakeAgreementReport(
  source: AgentSessionV3PilotExternalSampleIntakeAgreementReportSource,
) {
  if (!source) {
    return {
      invalidReason: null,
      label: null,
      report: null,
    };
  }

  if (isAgentSessionV3PilotShadowAgreementReportExport(source)) {
    return {
      invalidReason: null,
      label: null,
      report: source,
    };
  }

  if (!('report' in source)) {
    return {
      invalidReason: 'External agreement report source is not a report export or labelled report wrapper.',
      label: null,
      report: null,
    };
  }

  return {
    invalidReason: null,
    label: source.label ?? null,
    report: source.report,
  };
}

function normalizeAgentSessionV3PilotExternalSampleIntakeShadowDebugSample(
  source: AgentSessionV3PilotExternalSampleIntakeShadowDebugSource,
): {
  label: string | null;
  shadow: AgentSessionV3PilotShadowDebugExport | null;
} | null {
  if (!source) {
    return null;
  }

  if (isAgentSessionV3PilotShadowDebugExport(source)) {
    return {
      label: null,
      shadow: source,
    };
  }

  if ('shadow' in source) {
    return {
      label: source.label ?? null,
      shadow: source.shadow,
    };
  }

  return null;
}

function createAgentSessionV3PilotExternalSampleIntakeSummaryText(options: {
  corpus: AgentSessionV3PilotDebugSampleCorpusExport;
  issueCount: number;
  status: AgentSessionV3PilotExternalSampleIntakeStatus;
}) {
  return [
    `AgentSessionV3PilotExternalSampleIntake status=${options.status}`,
    `issues=${options.issueCount}`,
    `agreementSamples=${options.corpus.counts.agreementSampleCount}`,
    `shadowSamples=${options.corpus.counts.shadowDebugSampleCount}`,
    `shadowAnomalies=${options.corpus.counts.shadowAnomalySampleCount}`,
  ].join(' ');
}

function getAgentSessionV3PilotExternalSampleIntakeStatus(options: {
  acceptedSampleCount: number;
  issueCount: number;
}): AgentSessionV3PilotExternalSampleIntakeStatus {
  if (options.acceptedSampleCount === 0 && options.issueCount === 0) {
    return 'empty';
  }

  if (options.issueCount > 0) {
    return 'partial';
  }

  return 'accepted';
}

export function createAgentSessionV3PilotExternalSampleIntake(
  options: CreateAgentSessionV3PilotExternalSampleIntakeOptions,
): AgentSessionV3PilotExternalSampleIntakeResult {
  const issues: AgentSessionV3PilotExternalSampleIntakeIssue[] = [];
  let agreementReport: AgentSessionV3PilotShadowAgreementReportExport | null = null;
  const shadowDebugSamples: AgentSessionV3PilotDebugSampleCorpusShadowSample[] = [];

  for (const [index, source] of (options.agreementReports ?? []).entries()) {
    const normalized = normalizeAgentSessionV3PilotExternalSampleIntakeAgreementReport(source);
    if (normalized.invalidReason) {
      issues.push({
        index,
        label: normalized.label,
        reason: normalized.invalidReason,
        source: 'agreement-report',
      });
      continue;
    }

    if (!normalized.report) {
      continue;
    }

    if (!isAgentSessionV3PilotShadowAgreementReportExport(normalized.report)) {
      issues.push({
        index,
        label: normalized.label,
        reason: 'External agreement report is not a v3 pilot shadow agreement report export.',
        source: 'agreement-report',
      });
      continue;
    }

    if (!agreementReport) {
      agreementReport = normalized.report;
      continue;
    }

    issues.push({
      index,
      label: normalized.label,
      reason: 'Only one aggregate agreement report export can be attached to a corpus intake.',
      source: 'agreement-report',
    });
  }

  for (const [index, source] of (options.shadowDebugSamples ?? []).entries()) {
    const sample = normalizeAgentSessionV3PilotExternalSampleIntakeShadowDebugSample(source);
    if (!sample) {
      if (source) {
        issues.push({
          index,
          label: null,
          reason: 'External shadow debug source is not a shadow debug export or labelled shadow wrapper.',
          source: 'shadow-debug',
        });
      }
      continue;
    }

    if (!isAgentSessionV3PilotShadowDebugExport(sample.shadow)) {
      issues.push({
        index,
        label: sample.label,
        reason: 'External shadow debug sample is not a v3 pilot shadow debug export.',
        source: 'shadow-debug',
      });
      continue;
    }

    shadowDebugSamples.push(sample);
  }

  const corpus = createAgentSessionV3PilotDebugSampleCorpusExport({
    agreementReport,
    shadowDebugSamples,
  }, options.corpusOptions);
  const status = getAgentSessionV3PilotExternalSampleIntakeStatus({
    acceptedSampleCount: (agreementReport ? 1 : 0) + shadowDebugSamples.length,
    issueCount: issues.length,
  });

  return {
    corpus,
    issueCount: issues.length,
    issues,
    kind: 'agent-session-v3-pilot-external-sample-intake',
    status,
    summaryText: createAgentSessionV3PilotExternalSampleIntakeSummaryText({
      corpus,
      issueCount: issues.length,
      status,
    }),
    version: 1,
  };
}
