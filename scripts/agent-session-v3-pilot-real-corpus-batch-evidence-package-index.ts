import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAgentSessionV3PilotRealCorpusBatchCloseoutAudit } from './agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup } from './agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts';

export type AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexStatus =
  | 'attention-needed'
  | 'indexed';

export type AgentSessionV3PilotRealCorpusBatchEvidencePackageEntryKind =
  | 'coverage-guard'
  | 'handoff-report'
  | 'manual-gap-report'
  | 'project-doc';

export interface AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexEntry {
  boundary: string;
  kind: AgentSessionV3PilotRealCorpusBatchEvidencePackageEntryKind;
  present: boolean;
  relativePath: string;
  role: string;
}

export interface AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusLink {
  missingSignals: string[];
  status: 'attention-needed' | 'linked';
}

export interface AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult {
  closeoutStatus: string;
  closeoutSummaryText: string;
  entries: AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexEntry[];
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-evidence-package-index';
  missingEvidenceStatus: string;
  missingEvidenceSummaryText: string;
  missingPackageEntryCount: number;
  missingPackageEntryPaths: string[];
  packageEntryCount: number;
  p0IntakeTargetStatusLink: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusLink;
  readyForProductionRuntime: false;
  realSampleGapCount: number;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexStatus;
  summaryText: string;
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchEvidencePackageIndexOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

const PACKAGE_ENTRY_DEFINITIONS: Omit<AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexEntry, 'present'>[] = [
  {
    boundary: 'architecture and coverage plan only; no runtime authority.',
    kind: 'project-doc',
    relativePath: 'PROJECT_AGENT_V3_PILOT_PLAN.md',
    role: 'v3 pilot architecture and evidence coverage plan',
  },
  {
    boundary: 'readiness evidence checklist only; no readiness override.',
    kind: 'project-doc',
    relativePath: 'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
    role: 'runtime-wiring precondition and remaining evidence checklist',
  },
  {
    boundary: 'manual runbook only; no fixed runtime workflow.',
    kind: 'project-doc',
    relativePath: 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
    role: 'caller-owned real corpus batch manual review runbook',
  },
  {
    boundary: 'status summary only; no execution authority.',
    kind: 'project-doc',
    relativePath: 'PROJECT_AGENT_V2_STATUS.md',
    role: 'current progress and next-step status page',
  },
  {
    boundary: 'coverage drift audit only; does not run smoke tests.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts',
    role: 'smoke index, docs, dashboard, and CLI JSON coverage drift report',
  },
  {
    boundary: 'dashboard report only; no sample collection.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
    role: 'smoke coverage and remaining real-sample gap dashboard',
  },
  {
    boundary: 'manual priority report only; not runtime action order.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
    role: 'P0/P1/P2 manual evidence priority checklist',
  },
  {
    boundary: 'missing evidence rollup only; no sample collection.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
    role: 'dashboard gap, marker-source, and manual priority missing-evidence rollup',
  },
  {
    boundary: 'final manual gap report only; no runtime action order.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
    role: 'P0/P1/P2 final manual real evidence gap report',
  },
  {
    boundary: 'manual intake filling support report only; no intake creation, auto-fill, or runtime action order.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
    role: 'manual sample-note, manifest, and index field filling support over final gap evidence',
  },
  {
    boundary: 'manual intake field completeness audit only; explicit caller-owned intake dirs only.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
    role: 'manual sample-note, manifest, and index field completeness audit over caller-provided intake directories',
  },
  {
    boundary: 'manual intake readiness gate report only; explicit caller-owned intake dirs only; no runtime blocking.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
    role: 'manual intake readiness gate over validator, field completeness, P0 target, and runbook evidence',
  },
  {
    boundary: 'next evidence target report only; no sample collection or runtime action order.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
    role: 'package-health and missing-evidence based next manual evidence target report',
  },
  {
    boundary: 'P0 intake target status report only; no sample discovery or runtime action order.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
    role: 'P0 manual evidence target status over caller-provided real corpus batch intake directories',
  },
  {
    boundary: 'P0 real evidence closeout report only; no sample discovery or runtime action order.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
    role: 'P0 real evidence closeout over package health, next evidence target, P0 intake status, and readiness rollup',
  },
  {
    boundary: 'runbook completion report only; explicit caller-owned intake dirs only.',
    kind: 'manual-gap-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
    role: 'manual runbook completion criteria over caller-provided real corpus batch intake directories',
  },
  {
    boundary: 'handoff bundle generator only; no production readiness proof.',
    kind: 'handoff-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
    role: 'caller-owned interpreted evidence handoff bundle',
  },
  {
    boundary: 'handoff artifact integrity report only.',
    kind: 'handoff-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
    role: 'generated handoff artifact path and JSON kind/status integrity report',
  },
  {
    boundary: 'handoff sample-source declaration report only.',
    kind: 'handoff-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
    role: 'handoff README, manifest, and index sample-source consistency report',
  },
  {
    boundary: 'reviewer packet summary only; not production readiness.',
    kind: 'handoff-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
    role: 'artifact, sample-source, review-summary, and readiness-rollup reviewer packet summary',
  },
  {
    boundary: 'handoff source preflight rollup only; no runtime action order.',
    kind: 'handoff-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
    role: 'multi-case intake/handoff source declaration rollup',
  },
  {
    boundary: 'handoff phase-coverage consistency audit only; no readiness change or runtime authority.',
    kind: 'handoff-report',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts',
    role: 'bundle, artifact integrity, reviewer packet, and source-preflight rollup phase-coverage consistency audit',
  },
  {
    boundary: 'smoke coverage index only; does not execute smokes.',
    kind: 'coverage-guard',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-smoke-index.ts',
    role: 'real corpus batch smoke coverage index',
  },
  {
    boundary: 'readiness snapshot consistency smoke only; does not execute smokes.',
    kind: 'coverage-guard',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke.ts',
    role: 'current closeout/readiness snapshot consistency guard',
  },
  {
    boundary: 'next-step consistency smoke only; does not execute smokes.',
    kind: 'coverage-guard',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-next-step-consistency-smoke.ts',
    role: 'status, runbook, readiness, and package next-step consistency guard',
  },
  {
    boundary: 'intake field requirements consistency smoke only; does not execute smokes.',
    kind: 'coverage-guard',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke.ts',
    role: 'filling support, field completeness audit, intake template, and runbook field requirements consistency guard',
  },
  {
    boundary: 'CLI JSON contract mapping guard only.',
    kind: 'coverage-guard',
    relativePath: 'scripts/agent-session-v3-pilot-cli-json-contract-coverage-audit-smoke.ts',
    role: 'machine-readable CLI JSON contract coverage audit',
  },
  {
    boundary: 'evidence package catalog only; no runtime authority.',
    kind: 'coverage-guard',
    relativePath: 'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts',
    role: 'this evidence package index report',
  },
];

function createStatus(options: {
  missingPackageEntryCount: number;
  p0IntakeTargetStatusLink: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusLink;
}): AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexStatus {
  return options.missingPackageEntryCount > 0 || options.p0IntakeTargetStatusLink.status === 'attention-needed'
    ? 'attention-needed'
    : 'indexed';
}

function hasInOrder(text: string, first: string, second: string) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);

  return firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex;
}

function createP0IntakeTargetStatusLink(options: {
  entries: readonly AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexEntry[];
  planText: string;
  readinessText: string;
  runbookText: string;
}) {
  const missingSignals: string[] = [];

  if (!options.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts' && entry.present)) {
    missingSignals.push('package-entry:p0-intake-target-status-report');
  }
  if (!options.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts' && entry.present)) {
    missingSignals.push('package-entry:next-evidence-target-report');
  }
  if (!options.entries.some((entry) => entry.relativePath === 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md' && entry.present)) {
    missingSignals.push('package-entry:real-corpus-batch-runbook');
  }
  if (!hasInOrder(
    options.runbookText,
    'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
    'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
  )) {
    missingSignals.push('runbook-order:next-target-before-p0-status');
  }
  if (!hasInOrder(
    options.runbookText,
    'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
    'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
  )) {
    missingSignals.push('runbook-order:p0-status-before-gap-priorities');
  }
  if (!options.runbookText.includes('Always pass each directory with `--dir`; this report does not discover directories')) {
    missingSignals.push('runbook-boundary:explicit-dir-no-discovery');
  }
  if (!options.runbookText.includes('AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport status=<no-intake-dirs|blocked|review-needed|ready-for-manual-review>')) {
    missingSignals.push('runbook-contract:p0-status-summary-shape');
  }
  if (!options.planText.includes('P0 status summary shape')) {
    missingSignals.push('plan-coverage:p0-status-summary-shape');
  }
  if (!options.readinessText.includes('explicit P0 intake target status reading with caller-provided `--dir`')) {
    missingSignals.push('readiness-coverage:explicit-p0-status-dir-boundary');
  }

  return {
    missingSignals,
    status: missingSignals.length > 0 ? 'attention-needed' : 'linked',
  } satisfies AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusLink;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult,
    | 'closeoutStatus'
    | 'missingEvidenceStatus'
    | 'missingPackageEntryCount'
    | 'packageEntryCount'
    | 'p0IntakeTargetStatusLink'
    | 'readyForProductionRuntime'
    | 'realSampleGapCount'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchEvidencePackageIndex status=${result.status}`,
    `entries=${result.packageEntryCount}`,
    `missingEntries=${result.missingPackageEntryCount}`,
    `closeout=${result.closeoutStatus}`,
    `missingEvidence=${result.missingEvidenceStatus}`,
    `realSampleGaps=${result.realSampleGapCount}`,
    `p0IntakeTargetStatusLink=${result.p0IntakeTargetStatusLink.status}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult,
    | 'closeoutSummaryText'
    | 'entries'
    | 'guardrail'
    | 'missingEvidenceSummaryText'
    | 'missingPackageEntryPaths'
    | 'p0IntakeTargetStatusLink'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `closeoutSummary=${result.closeoutSummaryText}`,
    `missingEvidenceSummary=${result.missingEvidenceSummaryText}`,
    result.missingPackageEntryPaths.length ? 'missingPackageEntries:' : 'missingPackageEntries: none',
    ...result.missingPackageEntryPaths.map((entryPath) => `- ${entryPath}`),
    result.p0IntakeTargetStatusLink.missingSignals.length
      ? `p0IntakeTargetStatusLink status=${result.p0IntakeTargetStatusLink.status}`
      : `p0IntakeTargetStatusLink status=${result.p0IntakeTargetStatusLink.status} missingSignals=none`,
    ...result.p0IntakeTargetStatusLink.missingSignals.map((signal) => `- ${signal}`),
    'evidencePackageEntries:',
    ...result.entries.map((entry) => [
      `- kind=${entry.kind}`,
      `present=${entry.present ? 'yes' : 'no'}`,
      `path=${entry.relativePath}`,
      `role=${entry.role}`,
      `boundary=${entry.boundary}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex(
  options: CreateAgentSessionV3PilotRealCorpusBatchEvidencePackageIndexOptions = {},
): AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const closeoutAudit = createAgentSessionV3PilotRealCorpusBatchCloseoutAudit({
    projectRoot,
  });
  const missingEvidence = createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup({
    projectRoot,
  });
  const entries = PACKAGE_ENTRY_DEFINITIONS.map((entry) => ({
    ...entry,
    present: existsSync(path.join(projectRoot, entry.relativePath)),
  }));
  const runbookText = readFileSync(path.join(projectRoot, 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md'), 'utf8');
  const planText = readFileSync(path.join(projectRoot, 'PROJECT_AGENT_V3_PILOT_PLAN.md'), 'utf8');
  const readinessText = readFileSync(path.join(projectRoot, 'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md'), 'utf8');
  const p0IntakeTargetStatusLink = createP0IntakeTargetStatusLink({
    entries,
    planText,
    readinessText,
    runbookText,
  });
  const missingPackageEntryPaths = entries
    .filter((entry) => !entry.present)
    .map((entry) => entry.relativePath);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult = {
    closeoutStatus: closeoutAudit.status,
    closeoutSummaryText: closeoutAudit.summaryText,
    entries,
    guardrail: 'caller-owned evidence package index only; does not run smoke tests, collect samples, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-evidence-package-index',
    missingEvidenceStatus: missingEvidence.missingEvidenceStatus,
    missingEvidenceSummaryText: missingEvidence.summaryText,
    missingPackageEntryCount: missingPackageEntryPaths.length,
    missingPackageEntryPaths,
    packageEntryCount: entries.length,
    p0IntakeTargetStatusLink,
    readyForProductionRuntime: false,
    realSampleGapCount: missingEvidence.dashboardGapCount,
    reportText: '',
    status: createStatus({
      missingPackageEntryCount: missingPackageEntryPaths.length,
      p0IntakeTargetStatusLink,
    }),
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

function runAgentSessionV3PilotRealCorpusBatchEvidencePackageIndexCli() {
  const args = process.argv.slice(2);
  const includeJsonText = args.includes('--json') || args.includes('--pretty');
  const prettyJson = args.includes('--pretty');
  const result = createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex({
    includeJsonText,
    prettyJson,
  });
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchEvidencePackageIndexCli();
}
