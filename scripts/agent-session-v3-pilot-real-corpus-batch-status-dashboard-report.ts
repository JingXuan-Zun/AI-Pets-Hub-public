import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';

export type AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind =
  | 'broader-real-corpus'
  | 'manifest-distribution'
  | 'real-exported-corpus'
  | 'real-exported-fixture'
  | 'real-production-like-sample'
  | 'real-threshold-profile';

export type AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource =
  | 'explicit-marker'
  | 'legacy-wording';

export interface AgentSessionV3PilotRealCorpusBatchStatusDashboardGap {
  kind: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind;
  line: string;
  source: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource;
}

export interface AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult {
  gapCount: number;
  gapCounts: Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind, number>;
  gapSourceCounts: Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource, number>;
  gaps: AgentSessionV3PilotRealCorpusBatchStatusDashboardGap[];
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report';
  readyForProductionRuntime: false;
  reportText: string;
  smokeGroupCounts: Record<string, number>;
  smokeIndexEntryCount: number;
  smokeIndexMissingCount: number;
  smokeIndexUnindexedCount: number;
  summaryText: string;
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchStatusDashboardReportOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

const GAP_KINDS: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind[] = [
  'broader-real-corpus',
  'manifest-distribution',
  'real-exported-corpus',
  'real-exported-fixture',
  'real-production-like-sample',
  'real-threshold-profile',
];
const GAP_KIND_SET = new Set<string>(GAP_KINDS);

function createZeroGapCounts() {
  return Object.fromEntries(GAP_KINDS.map((kind) => [kind, 0])) as Record<
    AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind,
    number
  >;
}

function isGapKind(value: string): value is AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind {
  return GAP_KIND_SET.has(value);
}

function classifyExplicitGapMarker(line: string): AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind | null {
  const marker = line.match(/(?:gap-kind|real-corpus-gap)\s*[:=]\s*([a-z0-9-]+)/u);
  const markerValue = marker?.[1];

  if (markerValue && isGapKind(markerValue)) {
    return markerValue;
  }

  return null;
}

function classifyLegacyGapWording(line: string): AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind | null {
  if (/real production-like sample batches are still needed/u.test(line)) {
    return 'real-production-like-sample';
  }
  if (/Real exported fixture batches are still needed|Real exported fixture sample batches are still needed/u.test(line)) {
    return 'real-exported-fixture';
  }
  if (/Real exported corpus batches are still needed/u.test(line)) {
    return 'real-exported-corpus';
  }
  if (/Broader real exported corpus batches are still needed|Broader real corpus batches are still needed/u.test(line)) {
    return 'broader-real-corpus';
  }
  if (/Real manifest distributions are still needed|Real manifest batches are still needed/u.test(line)) {
    return 'manifest-distribution';
  }
  if (/real threshold profile batches are still needed/u.test(line)) {
    return 'real-threshold-profile';
  }

  return null;
}

function classifyGapWithSource(
  line: string,
): AgentSessionV3PilotRealCorpusBatchStatusDashboardGap | null {
  const explicitKind = classifyExplicitGapMarker(line);

  if (explicitKind) {
    return {
      kind: explicitKind,
      line,
      source: 'explicit-marker',
    };
  }

  const legacyKind = classifyLegacyGapWording(line);

  if (legacyKind) {
    return {
      kind: legacyKind,
      line,
      source: 'legacy-wording',
    };
  }

  return null;
}

export function classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
  line: string,
): AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind | null {
  return classifyGapWithSource(line)?.kind ?? null;
}

export function collectAgentSessionV3PilotRealCorpusBatchStatusDashboardGaps(checklistText: string) {
  const gaps: AgentSessionV3PilotRealCorpusBatchStatusDashboardGap[] = [];

  for (const rawLine of checklistText.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line.startsWith('- ')) {
      continue;
    }

    const gap = classifyGapWithSource(line);
    if (gap) {
      gaps.push(gap);
    }
  }

  return gaps;
}

function createGapCounts(gaps: readonly AgentSessionV3PilotRealCorpusBatchStatusDashboardGap[]) {
  const gapCounts = createZeroGapCounts();

  for (const gap of gaps) {
    gapCounts[gap.kind] += 1;
  }

  return gapCounts;
}

function createGapSourceCounts(gaps: readonly AgentSessionV3PilotRealCorpusBatchStatusDashboardGap[]) {
  const gapSourceCounts: Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource, number> = {
    'explicit-marker': 0,
    'legacy-wording': 0,
  };

  for (const gap of gaps) {
    gapSourceCounts[gap.source] += 1;
  }

  return gapSourceCounts;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
    | 'gapCount'
    | 'gapSourceCounts'
    | 'readyForProductionRuntime'
    | 'smokeIndexEntryCount'
    | 'smokeIndexMissingCount'
    | 'smokeIndexUnindexedCount'
  >,
) {
  return [
    'AgentSessionV3PilotRealCorpusBatchStatusDashboard',
    `smokes=${result.smokeIndexEntryCount}`,
    `missingIndexedSmokes=${result.smokeIndexMissingCount}`,
    `unindexedSmokes=${result.smokeIndexUnindexedCount}`,
    `realSampleGaps=${result.gapCount}`,
    `explicitMarkerGaps=${result.gapSourceCounts['explicit-marker']}`,
    `legacyWordingGaps=${result.gapSourceCounts['legacy-wording']}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
    | 'gapCounts'
    | 'gapSourceCounts'
    | 'gaps'
    | 'guardrail'
    | 'smokeGroupCounts'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    'smokeGroups:',
    ...Object.entries(result.smokeGroupCounts).map(([group, count]) => `- group=${group} count=${count}`),
    'realSampleGapCounts:',
    ...Object.entries(result.gapCounts).map(([kind, count]) => `- kind=${kind} count=${count}`),
    'realSampleGapSources:',
    ...Object.entries(result.gapSourceCounts).map(([source, count]) => `- source=${source} count=${count}`),
    result.gaps.length ? 'realSampleGaps:' : 'realSampleGaps: none',
    ...result.gaps.map((gap) => `- kind=${gap.kind} source=${gap.source} ${gap.line}`),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport(
  options: CreateAgentSessionV3PilotRealCorpusBatchStatusDashboardReportOptions = {},
): AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const checklistPath = path.join(projectRoot, 'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md');
  const checklistText = readFileSync(checklistPath, 'utf8');
  const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
    projectRoot,
  });
  const gaps = collectAgentSessionV3PilotRealCorpusBatchStatusDashboardGaps(checklistText);
  const gapCounts = createGapCounts(gaps);
  const gapSourceCounts = createGapSourceCounts(gaps);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult = {
    gapCount: gaps.length,
    gapCounts,
    gapSourceCounts,
    gaps,
    guardrail: 'caller-owned status dashboard only; does not run smoke tests, collect samples, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, or grant runtime authority.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report',
    readyForProductionRuntime: false,
    reportText: '',
    smokeGroupCounts: smokeIndex.groupCounts,
    smokeIndexEntryCount: smokeIndex.entryCount,
    smokeIndexMissingCount: smokeIndex.missingCount,
    smokeIndexUnindexedCount: smokeIndex.unindexedCount,
    summaryText: '',
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutText);

  const resultWithReport = {
    ...resultWithoutText,
    reportText: createReportText({
      ...resultWithoutText,
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

function runAgentSessionV3PilotRealCorpusBatchStatusDashboardReportCli() {
  const args = process.argv.slice(2);
  const includeJsonText = args.includes('--json') || args.includes('--pretty');
  const prettyJson = args.includes('--pretty');
  const result = createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport({
    includeJsonText,
    prettyJson,
  });
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchStatusDashboardReportCli();
}
