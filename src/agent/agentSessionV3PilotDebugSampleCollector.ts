import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotDebugSampleCorpusExportOptions,
  type AgentSessionV3PilotDebugSampleCorpusShadowSample,
} from './agentSessionV3PilotDebugSampleCorpus';
import { type AgentSessionV3PilotShadowAgreementReportExport } from './agentSessionV3PilotShadowAgreement';
import { type AgentSessionV3PilotShadowDebugExport } from './agentSessionV3PilotShadowDebugExport';

export type AgentSessionV3PilotDebugSampleCollectorStatus =
  | 'collected'
  | 'failed'
  | 'partial';

export interface AgentSessionV3PilotDebugSampleCollectorAgreementReportProvider {
  collect: () => AgentSessionV3PilotShadowAgreementReportExport
    | null
    | Promise<AgentSessionV3PilotShadowAgreementReportExport | null>;
}

export interface AgentSessionV3PilotDebugSampleCollectorShadowSampleProvider {
  collect: () => AgentSessionV3PilotShadowDebugExport
    | AgentSessionV3PilotDebugSampleCorpusShadowSample
    | null
    | Promise<AgentSessionV3PilotShadowDebugExport | AgentSessionV3PilotDebugSampleCorpusShadowSample | null>;
  label?: string | null;
}

export type AgentSessionV3PilotDebugSampleCollectorAgreementReportSource =
  | AgentSessionV3PilotShadowAgreementReportExport
  | AgentSessionV3PilotDebugSampleCollectorAgreementReportProvider
  | null;

export type AgentSessionV3PilotDebugSampleCollectorShadowSampleSource =
  | AgentSessionV3PilotShadowDebugExport
  | AgentSessionV3PilotDebugSampleCorpusShadowSample
  | AgentSessionV3PilotDebugSampleCollectorShadowSampleProvider
  | null;

export interface AgentSessionV3PilotDebugSampleCollectorIssue {
  errorText: string;
  index: number | null;
  label: string | null;
  source: 'agreement-report' | 'shadow-debug';
}

export interface CollectAgentSessionV3PilotDebugSampleCorpusOptions {
  agreementReport?: AgentSessionV3PilotDebugSampleCollectorAgreementReportSource;
  corpusOptions?: AgentSessionV3PilotDebugSampleCorpusExportOptions;
  shadowDebugSamples?: readonly AgentSessionV3PilotDebugSampleCollectorShadowSampleSource[] | null;
}

export interface AgentSessionV3PilotDebugSampleCollectionResult {
  corpus: AgentSessionV3PilotDebugSampleCorpusExport;
  issues: AgentSessionV3PilotDebugSampleCollectorIssue[];
  status: AgentSessionV3PilotDebugSampleCollectorStatus;
}

function getAgentSessionV3PilotDebugSampleCollectorErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAgentSessionV3PilotDebugSampleCollectorAgreementReportProvider(
  source: AgentSessionV3PilotDebugSampleCollectorAgreementReportSource,
): source is AgentSessionV3PilotDebugSampleCollectorAgreementReportProvider {
  return Boolean(source)
    && typeof source === 'object'
    && 'collect' in source;
}

function isAgentSessionV3PilotDebugSampleCollectorShadowSampleProvider(
  source: AgentSessionV3PilotDebugSampleCollectorShadowSampleSource,
): source is AgentSessionV3PilotDebugSampleCollectorShadowSampleProvider {
  return Boolean(source)
    && typeof source === 'object'
    && 'collect' in source;
}

function normalizeAgentSessionV3PilotDebugSampleCollectorShadowSample(
  sample: AgentSessionV3PilotShadowDebugExport | AgentSessionV3PilotDebugSampleCorpusShadowSample,
  label?: string | null,
): AgentSessionV3PilotDebugSampleCorpusShadowSample {
  return 'shadow' in sample
    ? {
      label: sample.label ?? label ?? null,
      shadow: sample.shadow,
    }
    : {
      label: label ?? null,
      shadow: sample,
    };
}

function getAgentSessionV3PilotDebugSampleCollectionStatus(options: {
  collectedSampleCount: number;
  issueCount: number;
}): AgentSessionV3PilotDebugSampleCollectorStatus {
  if (options.issueCount === 0) {
    return 'collected';
  }

  if (options.collectedSampleCount > 0) {
    return 'partial';
  }

  return 'failed';
}

export async function collectAgentSessionV3PilotDebugSampleCorpus(
  options: CollectAgentSessionV3PilotDebugSampleCorpusOptions,
): Promise<AgentSessionV3PilotDebugSampleCollectionResult> {
  const issues: AgentSessionV3PilotDebugSampleCollectorIssue[] = [];
  const shadowDebugSamples: AgentSessionV3PilotDebugSampleCorpusShadowSample[] = [];
  let agreementReport: AgentSessionV3PilotShadowAgreementReportExport | null = null;

  if (options.agreementReport) {
    try {
      agreementReport = isAgentSessionV3PilotDebugSampleCollectorAgreementReportProvider(options.agreementReport)
        ? await options.agreementReport.collect()
        : options.agreementReport;
    } catch (error) {
      issues.push({
        errorText: getAgentSessionV3PilotDebugSampleCollectorErrorText(error),
        index: null,
        label: null,
        source: 'agreement-report',
      });
    }
  }

  for (const [index, source] of (options.shadowDebugSamples ?? []).entries()) {
    if (!source) {
      continue;
    }

    try {
      const sample = isAgentSessionV3PilotDebugSampleCollectorShadowSampleProvider(source)
        ? await source.collect()
        : source;
      if (!sample) {
        continue;
      }

      shadowDebugSamples.push(normalizeAgentSessionV3PilotDebugSampleCollectorShadowSample(
        sample,
        isAgentSessionV3PilotDebugSampleCollectorShadowSampleProvider(source) ? source.label : null,
      ));
    } catch (error) {
      issues.push({
        errorText: getAgentSessionV3PilotDebugSampleCollectorErrorText(error),
        index,
        label: isAgentSessionV3PilotDebugSampleCollectorShadowSampleProvider(source)
          ? source.label ?? null
          : null,
        source: 'shadow-debug',
      });
    }
  }

  const corpus = createAgentSessionV3PilotDebugSampleCorpusExport({
    agreementReport,
    shadowDebugSamples,
  }, options.corpusOptions);
  const collectedSampleCount = (agreementReport ? 1 : 0) + shadowDebugSamples.length;

  return {
    corpus,
    issues,
    status: getAgentSessionV3PilotDebugSampleCollectionStatus({
      collectedSampleCount,
      issueCount: issues.length,
    }),
  };
}
