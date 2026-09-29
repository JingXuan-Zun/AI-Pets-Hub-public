import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit,
  type AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry,
} from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchIntakeValidator,
  type AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
} from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport,
  type AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry,
  type AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal,
  type AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignalStatus,
} from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport,
  type AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry,
} from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';

export type AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateStatus =
  | 'blocked'
  | 'no-intake-dirs'
  | 'ready-for-manual-review'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItemKind =
  | 'field-completeness'
  | 'p0-target'
  | 'runbook-completion'
  | 'validator';

export type AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode =
  | 'field-completeness-missing-entry'
  | 'field-completeness-open-fields'
  | 'p0-entry-blocked'
  | 'p0-entry-missing'
  | 'p0-entry-review-needed'
  | 'p0-target-blocked'
  | 'p0-target-missing'
  | 'p0-target-review-needed'
  | 'runbook-blocked'
  | 'runbook-missing-entry'
  | 'runbook-review-needed'
  | 'validator-empty'
  | 'validator-missing'
  | 'validator-mixed'
  | 'validator-not-ready';

export interface AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem {
  detail: string;
  issueCode: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode;
  kind: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItemKind;
  severity: Exclude<AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateStatus, 'no-intake-dirs' | 'ready-for-manual-review'>;
  sourceReports: string[];
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCodeRollupEntry {
  affectedIntakeCount: number;
  intakeDirs: string[];
  issueCode: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode;
  itemCount: number;
  kind: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItemKind;
  severity: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'];
}

export type AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockCategory =
  | 'fill-intake-fields'
  | 'fix-path-health'
  | 'review-p0-targets'
  | 'run-validator'
  | 'source-declaration'
  | 'unknown';

export interface AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockItem {
  category: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockCategory;
  detail: string;
  evidence: string[];
  intakeDir: string;
  issueCodes: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode[];
  severity: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'];
  sourceReports: string[];
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockRollupEntry {
  affectedIntakeCount: number;
  category: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockCategory;
  intakeDirs: string[];
  itemCount: number;
  severity: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'];
}

export type AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateP0AttributionStatus =
  | 'blocked'
  | 'missing'
  | 'ready-for-manual-review'
  | 'review-needed';

export interface AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateP0SignalAttribution {
  aggregateSignalStatus: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignalStatus;
  entryStatus: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry['status'] | null;
  gapKind: string;
  reasons: string[];
  status: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateP0AttributionStatus;
  supportsTarget: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry {
  blockerItems: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[];
  fieldCompletenessStatus: string | null;
  intakeDir: string;
  p0EntryStatus: string | null;
  p0SignalAttributions: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateP0SignalAttribution[];
  readinessStatus: Exclude<AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateStatus, 'no-intake-dirs'>;
  reviewItems: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[];
  runbookStatus: string | null;
  summaryText: string;
  validatorStatus: string;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportResult {
  blockedCount: number;
  entries: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry[];
  fieldCompletenessSummaryText: string;
  guardrail: string;
  intakeCount: number;
  issueCodeRollup: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCodeRollupEntry[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report';
  p0IntakeTargetStatusSummaryText: string;
  p0TargetSignals: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal[];
  readyForManualReviewCount: number;
  readyForProductionRuntime: false;
  reportText: string;
  reviewNeededCount: number;
  runbookCompletionSummaryText: string;
  status: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateStatus;
  statusCounts: Record<Exclude<AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateStatus, 'no-intake-dirs'>, number>;
  summaryText: string;
  unblockItems: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockItem[];
  unblockRollup: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockRollupEntry[];
  version: 1;
}

export interface RunAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportOptions {
  includeJsonText?: boolean;
  intakeDirs?: readonly string[];
  prettyJson?: boolean;
  projectRoot?: string;
}

const SOURCE_REPORTS = {
  fieldCompleteness: [
    'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  ],
  p0TargetStatus: [
    'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
  ],
  runbookCompletion: [
    'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
  ],
  validator: [
    'scripts/agent-session-v3-pilot-real-corpus-batch-intake-validator.ts',
  ],
} as const;

function parseArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportOptions {
  const intakeDirs: string[] = [];
  let includeJsonText = false;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing intake directory after --dir.');
      }
      intakeDirs.push(nextArg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return {
    includeJsonText,
    intakeDirs,
    prettyJson,
  };
}

function createGateItem(options: {
  detail: string;
  issueCode: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode;
  kind: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItemKind;
  severity: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'];
  sourceReports: readonly string[];
}): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem {
  return {
    ...options,
    sourceReports: [...options.sourceReports],
  };
}

function createValidatorItems(
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
) {
  const blockerItems: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[] = [];
  const reviewItems: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[] = [];

  if (validator.status === 'missing' || validator.status === 'empty' || validator.status === 'not-ready') {
    blockerItems.push(createGateItem({
      detail: `validator status=${validator.status}, pathHealth=${validator.pathHealthReport.status}, schemaShape=${validator.schemaShapeReport.status}, consistency=${validator.consistencyReport.status}`,
      issueCode: validator.status === 'missing'
        ? 'validator-missing'
        : validator.status === 'empty'
          ? 'validator-empty'
          : 'validator-not-ready',
      kind: 'validator',
      severity: 'blocked',
      sourceReports: SOURCE_REPORTS.validator,
    }));
  } else if (validator.status === 'mixed') {
    reviewItems.push(createGateItem({
      detail: 'validator status=mixed; manual interpretation is needed before treating this intake as ready',
      issueCode: 'validator-mixed',
      kind: 'validator',
      severity: 'review-needed',
      sourceReports: SOURCE_REPORTS.validator,
    }));
  }

  return {
    blockerItems,
    reviewItems,
  };
}

function createFieldCompletenessItems(
  fieldEntry: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry | null,
) {
  if (!fieldEntry) {
    return {
      blockerItems: [
        createGateItem({
          detail: 'field completeness audit did not return an entry for this explicit intake directory',
          issueCode: 'field-completeness-missing-entry',
          kind: 'field-completeness',
          severity: 'blocked',
          sourceReports: SOURCE_REPORTS.fieldCompleteness,
        }),
      ],
      reviewItems: [],
    };
  }
  if (fieldEntry.status === 'complete') {
    return {
      blockerItems: [],
      reviewItems: [],
    };
  }

  return {
    blockerItems: [
      createGateItem({
        detail: `field completeness status=${fieldEntry.status}, open=${fieldEntry.openFieldCount}, placeholder=${fieldEntry.placeholderFieldCount}, missing=${fieldEntry.missingFieldCount}, unreadable=${fieldEntry.unreadableFieldCount}`,
        issueCode: 'field-completeness-open-fields',
        kind: 'field-completeness',
        severity: 'blocked',
        sourceReports: SOURCE_REPORTS.fieldCompleteness,
      }),
    ],
    reviewItems: [],
  };
}

function createP0Items(
  p0Entry: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry | null,
  p0SignalAttributions: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateP0SignalAttribution[],
) {
  const blockerItems: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[] = [];
  const reviewItems: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[] = [];

  if (!p0Entry) {
    blockerItems.push(createGateItem({
      detail: 'P0 target status did not return an entry for this explicit intake directory',
      issueCode: 'p0-entry-missing',
      kind: 'p0-target',
      severity: 'blocked',
      sourceReports: SOURCE_REPORTS.p0TargetStatus,
    }));
  } else if (p0Entry.status === 'blocked') {
    blockerItems.push(createGateItem({
      detail: `P0 intake status=blocked; blockers=${p0Entry.blockerReasons.join('; ') || 'none'}`,
      issueCode: 'p0-entry-blocked',
      kind: 'p0-target',
      severity: 'blocked',
      sourceReports: SOURCE_REPORTS.p0TargetStatus,
    }));
  } else if (p0Entry.status === 'review-needed') {
    reviewItems.push(createGateItem({
      detail: `P0 intake status=review-needed; review=${p0Entry.reviewReasons.join('; ') || 'none'}`,
      issueCode: 'p0-entry-review-needed',
      kind: 'p0-target',
      severity: 'review-needed',
      sourceReports: SOURCE_REPORTS.p0TargetStatus,
    }));
  }

  for (const attribution of p0SignalAttributions) {
    if (attribution.status === 'blocked') {
      blockerItems.push(createGateItem({
        detail: `P0 target ${attribution.gapKind} per-intake status=blocked; aggregateStatus=${attribution.aggregateSignalStatus}; reasons=${attribution.reasons.join('; ') || 'none'}`,
        issueCode: 'p0-target-blocked',
        kind: 'p0-target',
        severity: 'blocked',
        sourceReports: SOURCE_REPORTS.p0TargetStatus,
      }));
    } else if (attribution.status === 'review-needed') {
      reviewItems.push(createGateItem({
        detail: `P0 target ${attribution.gapKind} per-intake status=review-needed; aggregateStatus=${attribution.aggregateSignalStatus}; reasons=${attribution.reasons.join('; ') || 'none'}`,
        issueCode: 'p0-target-review-needed',
        kind: 'p0-target',
        severity: 'review-needed',
        sourceReports: SOURCE_REPORTS.p0TargetStatus,
      }));
    } else if (attribution.status === 'missing') {
      reviewItems.push(createGateItem({
        detail: `P0 target ${attribution.gapKind} per-intake status=missing; aggregateStatus=${attribution.aggregateSignalStatus}; reasons=${attribution.reasons.join('; ') || 'none'}`,
        issueCode: 'p0-target-missing',
        kind: 'p0-target',
        severity: 'review-needed',
        sourceReports: SOURCE_REPORTS.p0TargetStatus,
      }));
    }
  }

  return {
    blockerItems,
    reviewItems,
  };
}

function p0EntrySupportsGapKind(
  p0Entry: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry,
  gapKind: string,
) {
  if (gapKind === 'real-production-like-sample') {
    return p0Entry.hasProductionLikeSourceKind;
  }
  if (gapKind === 'real-exported-corpus') {
    return (
      p0Entry.sourceSampleSource === 'real-exported'
      && p0Entry.sourceSampleSourceStatus === 'real-exported-evidence'
    );
  }

  return false;
}

function createP0AttributionReasons(options: {
  gapKind: string;
  p0Entry: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry | null;
  supportsTarget: boolean;
}) {
  const { gapKind, p0Entry, supportsTarget } = options;

  if (!p0Entry) {
    return ['P0 target status did not return an entry for this explicit intake directory'];
  }

  const reasons: string[] = [];

  if (gapKind === 'real-production-like-sample') {
    reasons.push(supportsTarget
      ? 'this intake has production-like source-kind evidence'
      : 'this intake does not have production-like source-kind evidence');
  } else if (gapKind === 'real-exported-corpus') {
    reasons.push(supportsTarget
      ? 'this intake has real-exported sample-source evidence'
      : 'this intake does not have real-exported sample-source evidence');
  } else {
    reasons.push('this P0 target has no per-intake attribution mapper');
  }

  if (p0Entry.status === 'blocked') {
    reasons.push(`entry blocked: ${p0Entry.blockerReasons.join('; ') || 'none'}`);
  } else if (p0Entry.status === 'review-needed') {
    reasons.push(`entry review-needed: ${p0Entry.reviewReasons.join('; ') || 'none'}`);
  } else {
    reasons.push('entry ready-for-manual-review');
  }

  return reasons;
}

function createP0SignalAttributions(
  p0Entry: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry | null,
  p0TargetSignals: readonly AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal[],
): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateP0SignalAttribution[] {
  return p0TargetSignals.map((signal) => {
    const supportsTarget = p0Entry ? p0EntrySupportsGapKind(p0Entry, signal.gapKind) : false;
    const status: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateP0AttributionStatus = p0Entry
      ? (supportsTarget ? p0Entry.status : 'missing')
      : 'blocked';

    return {
      aggregateSignalStatus: signal.status,
      entryStatus: p0Entry?.status ?? null,
      gapKind: signal.gapKind,
      reasons: createP0AttributionReasons({
        gapKind: signal.gapKind,
        p0Entry,
        supportsTarget,
      }),
      status,
      supportsTarget,
    };
  });
}

function createRunbookItems(
  runbookEntry: AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry | null,
) {
  if (!runbookEntry) {
    return {
      blockerItems: [
        createGateItem({
          detail: 'runbook completion report did not return an entry for this explicit intake directory',
          issueCode: 'runbook-missing-entry',
          kind: 'runbook-completion',
          severity: 'blocked',
          sourceReports: SOURCE_REPORTS.runbookCompletion,
        }),
      ],
      reviewItems: [],
    };
  }
  if (runbookEntry.status === 'blocked') {
    return {
      blockerItems: [
        createGateItem({
          detail: runbookEntry.summaryText,
          issueCode: 'runbook-blocked',
          kind: 'runbook-completion',
          severity: 'blocked',
          sourceReports: SOURCE_REPORTS.runbookCompletion,
        }),
      ],
      reviewItems: [],
    };
  }
  if (runbookEntry.status === 'review-needed') {
    return {
      blockerItems: [],
      reviewItems: [
        createGateItem({
          detail: runbookEntry.summaryText,
          issueCode: 'runbook-review-needed',
          kind: 'runbook-completion',
          severity: 'review-needed',
          sourceReports: SOURCE_REPORTS.runbookCompletion,
        }),
      ],
    };
  }

  return {
    blockerItems: [],
    reviewItems: [],
  };
}

function createEntryStatus(options: {
  blockerItems: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[];
  reviewItems: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem[];
}): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry['readinessStatus'] {
  if (options.blockerItems.length > 0) {
    return 'blocked';
  }

  return options.reviewItems.length > 0 ? 'review-needed' : 'ready-for-manual-review';
}

function createEntrySummaryText(
  entry: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry,
    'blockerItems' | 'intakeDir' | 'readinessStatus' | 'reviewItems'
  >,
) {
  return [
    `intakeDir=${entry.intakeDir}`,
    `status=${entry.readinessStatus}`,
    `blockers=${entry.blockerItems.length}`,
    `review=${entry.reviewItems.length}`,
  ].join(' ');
}

function createStatusCounts(
  entries: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry[],
) {
  const counts = {
    blocked: 0,
    'ready-for-manual-review': 0,
    'review-needed': 0,
  } satisfies AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportResult['statusCounts'];

  for (const entry of entries) {
    counts[entry.readinessStatus] += 1;
  }

  return counts;
}

function createIssueCodeRollup(
  entries: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry[],
): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCodeRollupEntry[] {
  const rollupByIssueCode = new Map<
    AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode,
    {
      intakeDirs: Set<string>;
      issueCode: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode;
      itemCount: number;
      kind: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItemKind;
      severity: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'];
    }
  >();

  for (const entry of entries) {
    for (const item of [
      ...entry.blockerItems,
      ...entry.reviewItems,
    ]) {
      const existing = rollupByIssueCode.get(item.issueCode);
      if (existing) {
        existing.itemCount += 1;
        existing.intakeDirs.add(entry.intakeDir);
      } else {
        rollupByIssueCode.set(item.issueCode, {
          intakeDirs: new Set([entry.intakeDir]),
          issueCode: item.issueCode,
          itemCount: 1,
          kind: item.kind,
          severity: item.severity,
        });
      }
    }
  }

  const severityRank: Record<AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'], number> = {
    blocked: 0,
    'review-needed': 1,
  };

  return [...rollupByIssueCode.values()]
    .map((entry) => ({
      affectedIntakeCount: entry.intakeDirs.size,
      intakeDirs: [...entry.intakeDirs].sort(),
      issueCode: entry.issueCode,
      itemCount: entry.itemCount,
      kind: entry.kind,
      severity: entry.severity,
    }))
    .sort((left, right) => {
      const severityDiff = severityRank[left.severity] - severityRank[right.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const countDiff = right.itemCount - left.itemCount;
      return countDiff !== 0 ? countDiff : left.issueCode.localeCompare(right.issueCode);
    });
}

function createUnblockCategory(
  item: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem,
): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockCategory {
  if (item.issueCode === 'field-completeness-open-fields' || item.issueCode === 'field-completeness-missing-entry') {
    return 'fill-intake-fields';
  }
  if (
    item.issueCode === 'validator-empty'
    || item.issueCode === 'validator-missing'
    || item.issueCode === 'validator-mixed'
    || item.issueCode === 'validator-not-ready'
  ) {
    return 'run-validator';
  }
  if (
    item.issueCode === 'p0-entry-blocked'
    || item.issueCode === 'p0-entry-missing'
    || item.issueCode === 'p0-entry-review-needed'
    || item.issueCode === 'p0-target-blocked'
    || item.issueCode === 'p0-target-missing'
    || item.issueCode === 'p0-target-review-needed'
  ) {
    return 'review-p0-targets';
  }
  if (
    item.issueCode === 'runbook-blocked'
    || item.issueCode === 'runbook-missing-entry'
    || item.issueCode === 'runbook-review-needed'
  ) {
    return /pathHealth=issues|pathIssues=[1-9]/u.test(item.detail)
      ? 'fix-path-health'
      : 'fill-intake-fields';
  }

  return 'unknown';
}

function uniqSorted(values: Iterable<string>) {
  return [...new Set(values)].sort();
}

function createUnblockItems(
  entries: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry[],
): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockItem[] {
  return entries.flatMap((entry) => [
    ...entry.blockerItems,
    ...entry.reviewItems,
  ].map((item) => ({
    category: createUnblockCategory(item),
    detail: item.detail,
    evidence: [
      `kind=${item.kind}`,
      `issueCode=${item.issueCode}`,
      `severity=${item.severity}`,
    ],
    intakeDir: entry.intakeDir,
    issueCodes: [item.issueCode],
    severity: item.severity,
    sourceReports: [...item.sourceReports],
  })));
}

function createUnblockRollup(
  unblockItems: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockItem[],
): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockRollupEntry[] {
  const rollupByCategory = new Map<
    string,
    {
      intakeDirs: Set<string>;
      itemCount: number;
      severity: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'];
    }
  >();

  for (const item of unblockItems) {
    const key = `${item.severity}:${item.category}`;
    const existing = rollupByCategory.get(key);
    if (existing) {
      existing.itemCount += 1;
      existing.intakeDirs.add(item.intakeDir);
    } else {
      rollupByCategory.set(key, {
        intakeDirs: new Set([item.intakeDir]),
        itemCount: 1,
        severity: item.severity,
      });
    }
  }

  const severityRank: Record<AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateItem['severity'], number> = {
    blocked: 0,
    'review-needed': 1,
  };

  return [...rollupByCategory.entries()]
    .map(([key, entry]) => {
      const [, category] = key.split(':');

      return {
        affectedIntakeCount: entry.intakeDirs.size,
        category: category as AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateUnblockCategory,
        intakeDirs: uniqSorted(entry.intakeDirs),
        itemCount: entry.itemCount,
        severity: entry.severity,
      };
    })
    .sort((left, right) => {
      const severityDiff = severityRank[left.severity] - severityRank[right.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const countDiff = right.itemCount - left.itemCount;
      return countDiff !== 0 ? countDiff : left.category.localeCompare(right.category);
    });
}

function createAggregateStatus(
  entries: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry[],
): AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateStatus {
  if (entries.length === 0) {
    return 'no-intake-dirs';
  }
  if (entries.some((entry) => entry.readinessStatus === 'blocked')) {
    return 'blocked';
  }
  if (entries.some((entry) => entry.readinessStatus === 'review-needed')) {
    return 'review-needed';
  }

  return 'ready-for-manual-review';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportResult,
    | 'blockedCount'
    | 'intakeCount'
    | 'readyForManualReviewCount'
    | 'readyForProductionRuntime'
    | 'reviewNeededCount'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport status=${result.status}`,
    `intakes=${result.intakeCount}`,
    `blocked=${result.blockedCount}`,
    `reviewNeeded=${result.reviewNeededCount}`,
    `readyForManualReview=${result.readyForManualReviewCount}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportResult,
    | 'entries'
    | 'fieldCompletenessSummaryText'
    | 'guardrail'
    | 'issueCodeRollup'
    | 'p0IntakeTargetStatusSummaryText'
    | 'p0TargetSignals'
    | 'runbookCompletionSummaryText'
    | 'statusCounts'
    | 'summaryText'
    | 'unblockItems'
    | 'unblockRollup'
  >,
) {
  return [
    result.summaryText,
    `fieldCompletenessSummary=${result.fieldCompletenessSummaryText}`,
    `p0IntakeTargetStatusSummary=${result.p0IntakeTargetStatusSummaryText}`,
    `runbookCompletionSummary=${result.runbookCompletionSummaryText}`,
    'gateStatusCounts:',
    ...Object.entries(result.statusCounts).map(([status, count]) => `- status=${status} intakes=${count}`),
    result.issueCodeRollup.length ? 'issueCodeRollup:' : 'issueCodeRollup: none',
    ...result.issueCodeRollup.map((entry) => [
      `- severity=${entry.severity}`,
      `kind=${entry.kind}`,
      `issueCode=${entry.issueCode}`,
      `items=${entry.itemCount}`,
      `intakes=${entry.affectedIntakeCount}`,
      `intakeDirs=${entry.intakeDirs.length ? entry.intakeDirs.join('; ') : 'none'}`,
    ].join(' ')),
    result.unblockRollup.length ? 'unblockRollup:' : 'unblockRollup: none',
    ...result.unblockRollup.map((entry) => [
      `- severity=${entry.severity}`,
      `category=${entry.category}`,
      `items=${entry.itemCount}`,
      `intakes=${entry.affectedIntakeCount}`,
      `intakeDirs=${entry.intakeDirs.length ? entry.intakeDirs.join('; ') : 'none'}`,
    ].join(' ')),
    result.unblockItems.length ? 'unblockItems:' : 'unblockItems: none',
    ...result.unblockItems.map((item) => [
      `- severity=${item.severity}`,
      `category=${item.category}`,
      `intakeDir=${item.intakeDir}`,
      `issueCodes=${item.issueCodes.join(',')}`,
      `sourceReports=${item.sourceReports.join(',')}`,
      `evidence=${item.evidence.join('; ')}`,
      `detail=${item.detail}`,
    ].join(' ')),
    result.p0TargetSignals.length ? 'p0TargetSignals:' : 'p0TargetSignals: none',
    ...result.p0TargetSignals.map((signal) => [
      `- gapKind=${signal.gapKind}`,
      `status=${signal.status}`,
      `intakes=${signal.intakeCount}`,
      `blocked=${signal.blockedIntakeCount}`,
      `reviewNeeded=${signal.reviewNeededIntakeCount}`,
      `readyForManualReview=${signal.readyForManualReviewIntakeCount}`,
      `missingReason=${signal.missingReason ?? 'none'}`,
    ].join(' ')),
    result.entries.length ? 'intakeReadinessGateEntries:' : 'intakeReadinessGateEntries: none',
    ...result.entries.flatMap((entry) => [
      [
        `- intakeDir=${entry.intakeDir}`,
        `status=${entry.readinessStatus}`,
        `validator=${entry.validatorStatus}`,
        `fieldCompleteness=${entry.fieldCompletenessStatus ?? 'missing'}`,
        `p0=${entry.p0EntryStatus ?? 'missing'}`,
        `runbook=${entry.runbookStatus ?? 'missing'}`,
        `p0Attributions=${entry.p0SignalAttributions.length}`,
        `blockers=${entry.blockerItems.length}`,
        `review=${entry.reviewItems.length}`,
      ].join(' '),
      ...entry.p0SignalAttributions.map((attribution) => [
        `  - p0Attribution`,
        `gapKind=${attribution.gapKind}`,
        `perIntakeStatus=${attribution.status}`,
        `aggregateStatus=${attribution.aggregateSignalStatus}`,
        `supportsTarget=${attribution.supportsTarget ? 'yes' : 'no'}`,
        `entryStatus=${attribution.entryStatus ?? 'missing'}`,
        `reasons=${attribution.reasons.length ? attribution.reasons.join('; ') : 'none'}`,
      ].join(' ')),
      ...entry.blockerItems.map((item) => [
        `  - severity=blocked`,
        `kind=${item.kind}`,
        `issueCode=${item.issueCode}`,
        `sourceReports=${item.sourceReports.join(',')}`,
        `detail=${item.detail}`,
      ].join(' ')),
      ...entry.reviewItems.map((item) => [
        `  - severity=review-needed`,
        `kind=${item.kind}`,
        `issueCode=${item.issueCode}`,
        `sourceReports=${item.sourceReports.join(',')}`,
        `detail=${item.detail}`,
      ].join(' ')),
    ]),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport(
  options: RunAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportOptions = {},
): Promise<AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const intakeDirs = (options.intakeDirs ?? []).map((intakeDir) => path.resolve(intakeDir));
  const [
    validators,
    fieldCompleteness,
    p0Status,
    runbookCompletion,
  ] = await Promise.all([
    Promise.all(intakeDirs.map((intakeDir) => runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
      intakeDir,
      prettyJson: options.prettyJson,
    }))),
    runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
      intakeDirs,
      prettyJson: options.prettyJson,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
      intakeDirs,
      prettyJson: options.prettyJson,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
      intakeDirs,
      prettyJson: options.prettyJson,
      projectRoot,
    }),
  ]);
  const fieldEntriesByDir = new Map(fieldCompleteness.intakeEntries.map((entry) => [path.resolve(entry.intakeDir), entry]));
  const p0EntriesByDir = new Map(p0Status.entries.map((entry) => [path.resolve(entry.intakeDir), entry]));
  const runbookEntriesByDir = new Map(runbookCompletion.intakeEntries.map((entry) => [path.resolve(entry.intakeDir), entry]));
  const entries = validators.map((validator, index) => {
    const intakeDir = intakeDirs[index] ?? validator.intakeDir;
    const fieldEntry = fieldEntriesByDir.get(intakeDir) ?? null;
    const p0Entry = p0EntriesByDir.get(intakeDir) ?? null;
    const runbookEntry = runbookEntriesByDir.get(intakeDir) ?? null;
    const p0SignalAttributions = createP0SignalAttributions(p0Entry, p0Status.p0TargetSignals);
    const itemGroups = [
      createValidatorItems(validator),
      createFieldCompletenessItems(fieldEntry),
      createP0Items(p0Entry, p0SignalAttributions),
      createRunbookItems(runbookEntry),
    ];
    const blockerItems = itemGroups.flatMap((group) => group.blockerItems);
    const reviewItems = itemGroups.flatMap((group) => group.reviewItems);
    const entryWithoutSummary = {
      blockerItems,
      fieldCompletenessStatus: fieldEntry?.status ?? null,
      intakeDir,
      p0EntryStatus: p0Entry?.status ?? null,
      p0SignalAttributions,
      readinessStatus: createEntryStatus({
        blockerItems,
        reviewItems,
      }),
      reviewItems,
      runbookStatus: runbookEntry?.status ?? null,
      summaryText: '',
      validatorStatus: validator.status,
    } satisfies AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateEntry;

    return {
      ...entryWithoutSummary,
      summaryText: createEntrySummaryText(entryWithoutSummary),
    };
  });
  const statusCounts = createStatusCounts(entries);
  const issueCodeRollup = createIssueCodeRollup(entries);
  const unblockItems = createUnblockItems(entries);
  const unblockRollup = createUnblockRollup(unblockItems);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportResult = {
    blockedCount: statusCounts.blocked,
    entries,
    fieldCompletenessSummaryText: fieldCompleteness.summaryText,
    guardrail: 'caller-owned intake readiness gate report only; reads only explicitly supplied --dir intake directories; does not discover directories, create intake directories, collect samples, auto-fill files, write manifests, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, block runtime execution, or grant runtime authority.',
    intakeCount: entries.length,
    issueCodeRollup,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report',
    p0IntakeTargetStatusSummaryText: p0Status.summaryText,
    p0TargetSignals: p0Status.p0TargetSignals,
    readyForManualReviewCount: statusCounts['ready-for-manual-review'],
    readyForProductionRuntime: false,
    reportText: '',
    reviewNeededCount: statusCounts['review-needed'],
    runbookCompletionSummaryText: runbookCompletion.summaryText,
    status: createAggregateStatus(entries),
    statusCounts,
    summaryText: '',
    unblockItems,
    unblockRollup,
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

async function runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
