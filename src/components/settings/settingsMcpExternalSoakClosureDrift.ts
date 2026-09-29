import type {
  SettingsMcpExternalSoakClosureChecklist,
  SettingsMcpExternalSoakClosureStatus,
} from './settingsMcpExternalSoakClosureChecklist';
import type {
  SettingsMcpExternalSoakClosureCoverage,
  SettingsMcpExternalSoakClosureCoverageStep,
} from './settingsMcpExternalSoakClosureCoverage';

export type SettingsMcpExternalSoakClosureDriftStatus = 'aligned' | 'blocked' | 'drift' | 'warning';

type ClosureComparisonClass = 'pending' | 'ready' | 'warning';
type ClosureDriftComparisonId = 'estimate-review' | 'import-soak' | 'run-soak';

export interface SettingsMcpExternalSoakClosureDriftComparison {
  aligned: boolean;
  checklistStatus: SettingsMcpExternalSoakClosureStatus;
  coverageStatus: SettingsMcpExternalSoakClosureCoverageStep['status'] | 'blocked' | 'ready';
  detail: string;
  id: ClosureDriftComparisonId;
  label: string;
}

export interface SettingsMcpExternalSoakClosureDrift {
  alignedCount: number;
  comparisons: SettingsMcpExternalSoakClosureDriftComparison[];
  detail: string;
  status: SettingsMcpExternalSoakClosureDriftStatus;
  summaryText: string;
  totalCount: number;
}

function toComparisonClass(status: SettingsMcpExternalSoakClosureStatus): ClosureComparisonClass {
  if (status === 'ready' || status === 'warning') {
    return status;
  }

  return 'pending';
}

function toCoverageStepClass(
  status: SettingsMcpExternalSoakClosureDriftComparison['coverageStatus'],
): ClosureComparisonClass {
  if (status === 'ready' || status === 'warning') {
    return status;
  }

  return 'pending';
}

function findChecklistStatus(
  checklist: SettingsMcpExternalSoakClosureChecklist,
  id: ClosureDriftComparisonId,
) {
  return checklist.steps.find((step) => step.id === id)?.status ?? 'blocked';
}

function findCoverageStepStatus(
  coverage: SettingsMcpExternalSoakClosureCoverage,
  id: SettingsMcpExternalSoakClosureCoverageStep['id'],
) {
  return coverage.closureSteps.find((step) => step.id === id)?.status ?? 'blocked';
}

function getCoverageEstimateStatus(coverage: SettingsMcpExternalSoakClosureCoverage) {
  return coverage.status === 'covered' ? 'ready' as const : 'blocked' as const;
}

function createComparison(options: {
  checklistStatus: SettingsMcpExternalSoakClosureStatus;
  coverageStatus: SettingsMcpExternalSoakClosureDriftComparison['coverageStatus'];
  id: ClosureDriftComparisonId;
  label: string;
}): SettingsMcpExternalSoakClosureDriftComparison {
  const aligned = toComparisonClass(options.checklistStatus)
    === toCoverageStepClass(options.coverageStatus);
  return {
    ...options,
    aligned,
    detail: aligned
      ? 'Checklist and coverage evidence agree on this closure phase.'
      : 'Checklist and coverage evidence disagree; refresh readiness, soak import, or exports before estimate review.',
  };
}

function getDriftStatus(options: {
  checklist: SettingsMcpExternalSoakClosureChecklist;
  coverage: SettingsMcpExternalSoakClosureCoverage;
  hasDrift: boolean;
}): SettingsMcpExternalSoakClosureDriftStatus {
  if (options.hasDrift) {
    return 'drift';
  }

  if (options.checklist.status === 'warning' || options.coverage.status === 'warning') {
    return 'warning';
  }

  return options.checklist.status === 'ready' && options.coverage.status === 'covered'
    ? 'aligned'
    : 'blocked';
}

function createDriftDetail(status: SettingsMcpExternalSoakClosureDriftStatus) {
  if (status === 'aligned') {
    return 'Closure checklist and ready-server coverage agree that healthy external soak evidence is present.';
  }

  if (status === 'drift') {
    return 'Closure checklist and coverage evidence disagree; do not review the MCP foundation estimate yet.';
  }

  if (status === 'warning') {
    return 'Closure evidence is aligned, but imported soak evidence still needs review.';
  }

  return 'Closure evidence is aligned on the current blocker; MCP foundation estimate remains held.';
}

export function createSettingsMcpExternalSoakClosureDrift(options: {
  checklist: SettingsMcpExternalSoakClosureChecklist;
  coverage: SettingsMcpExternalSoakClosureCoverage;
}): SettingsMcpExternalSoakClosureDrift {
  const comparisons = [
    createComparison({
      checklistStatus: findChecklistStatus(options.checklist, 'run-soak'),
      coverageStatus: findCoverageStepStatus(options.coverage, 'run-missing-soak'),
      id: 'run-soak',
      label: 'Run soak evidence',
    }),
    createComparison({
      checklistStatus: findChecklistStatus(options.checklist, 'import-soak'),
      coverageStatus: findCoverageStepStatus(options.coverage, 'import-summary'),
      id: 'import-soak',
      label: 'Import evidence',
    }),
    createComparison({
      checklistStatus: findChecklistStatus(options.checklist, 'estimate-review'),
      coverageStatus: getCoverageEstimateStatus(options.coverage),
      id: 'estimate-review',
      label: 'Estimate review',
    }),
  ];
  const alignedCount = comparisons.filter((comparison) => comparison.aligned).length;
  const status = getDriftStatus({
    checklist: options.checklist,
    coverage: options.coverage,
    hasDrift: alignedCount !== comparisons.length,
  });

  return {
    alignedCount,
    comparisons,
    detail: createDriftDetail(status),
    status,
    summaryText: `MCPExternalSoakClosureDrift status=${status} aligned=${alignedCount}/${comparisons.length}`,
    totalCount: comparisons.length,
  };
}
