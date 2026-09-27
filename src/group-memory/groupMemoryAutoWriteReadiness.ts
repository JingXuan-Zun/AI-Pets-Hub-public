import { evaluateGroupMemoryCandidateEvidence } from './groupMemoryCandidateScreening';
import type { GroupMemoryCandidateShadowReport } from './groupMemoryCandidateShadowEvaluation';
import { detectGroupMemoryConflictCandidates } from './groupMemoryConflictDetection';
import { validateGroupMemoryIntegrity } from './groupMemoryIntegrity';
import type { GroupMemoryRepositoryData } from './groupMemoryTypes';

export const GROUP_MEMORY_AUTO_WRITE_GATE_IDS = [
  'approved-candidate-screening', 'candidate-review-rollback-drill',
  'duplicate-conflicts', 'duplicate-scan-coverage', 'false-eligible',
  'record-integrity', 'record-operation-rollback-drill', 'retained-candidate-audit',
  'scope-correction-drill', 'shadow-corpus',
] as const;

export type GroupMemoryAutoWriteGateId = typeof GROUP_MEMORY_AUTO_WRITE_GATE_IDS[number];

export type GroupMemoryAutoWriteGateStatus = 'pass' | 'block' | 'needs-evidence';

export interface GroupMemoryAutoWriteGateResult {
  count: number;
  id: GroupMemoryAutoWriteGateId;
  status: GroupMemoryAutoWriteGateStatus;
}

export interface GroupMemoryAutoWriteReadinessReport {
  automaticWriteEnabled: false;
  decision: 'blocked' | 'needs-drill' | 'shadow-ready';
  gates: GroupMemoryAutoWriteGateResult[];
  shadowMetrics: {
    accuracy: number;
    eligiblePrecision: number;
    expectedEligibleCount: number;
    falseEligibleCount: number;
    readiness: GroupMemoryCandidateShadowReport['readiness'];
    sampleCount: number;
  } | null;
}

function gate(id: GroupMemoryAutoWriteGateId, status: GroupMemoryAutoWriteGateStatus,
  count: number): GroupMemoryAutoWriteGateResult {
  return { count, id, status };
}

function shadowGates(report: GroupMemoryCandidateShadowReport | null) {
  if (!report) return [
    gate('shadow-corpus', 'needs-evidence', 0),
    gate('false-eligible', 'needs-evidence', 0),
  ];
  return [
    gate('shadow-corpus', report.readiness === 'ready' ? 'pass' : 'block', report.sampleCount),
    gate('false-eligible', report.falseEligibleCount ? 'block' : 'pass', report.falseEligibleCount),
  ];
}

function repositoryGates(repository: GroupMemoryRepositoryData) {
  const blockedApproved = repository.candidates.filter((candidate) => (
    candidate.status === 'approved'
    && evaluateGroupMemoryCandidateEvidence(candidate).decision === 'blocked'
  )).length;
  const conflicts = detectGroupMemoryConflictCandidates(repository, Number.MAX_SAFE_INTEGER).length;
  const activeRecordCount = repository.records.filter((record) => (
    record.invalidatedAt === undefined
  )).length;
  const integrityIssues = validateGroupMemoryIntegrity(repository).length;
  const candidateRollbacks = repository.candidateReviewReceipts
    .filter((receipt) => receipt.decision === 'rollback').length;
  const operationRollbacks = repository.receipts.filter((receipt) => receipt.kind === 'rollback').length
    + repository.receiptArchives.reduce((sum, archive) => (
      sum + (archive.operationCounts.rollback ?? 0)
    ), 0);
  return [
    gate('approved-candidate-screening', blockedApproved ? 'block' : 'pass', blockedApproved),
    gate('retained-candidate-audit', repository.candidateArchives.length
      ? 'needs-evidence' : 'pass', repository.candidateArchives.length),
    gate('duplicate-conflicts', conflicts ? 'block' : 'pass', conflicts),
    gate('duplicate-scan-coverage', activeRecordCount > 200 ? 'needs-evidence' : 'pass',
      Math.max(0, activeRecordCount - 200)),
    gate('record-integrity', integrityIssues ? 'block' : 'pass', integrityIssues),
    gate('candidate-review-rollback-drill', candidateRollbacks ? 'pass' : 'needs-evidence',
      candidateRollbacks),
    gate('record-operation-rollback-drill', operationRollbacks ? 'pass' : 'needs-evidence',
      operationRollbacks),
    gate('scope-correction-drill', repository.evidenceScopeCorrections.length
      ? 'pass' : 'needs-evidence', repository.evidenceScopeCorrections.length),
  ];
}

export function buildGroupMemoryAutoWriteReadinessReport(
  repository: GroupMemoryRepositoryData,
  shadowReport: GroupMemoryCandidateShadowReport | null,
): GroupMemoryAutoWriteReadinessReport {
  const gates = [...shadowGates(shadowReport), ...repositoryGates(repository)];
  const decision = gates.some((item) => item.status === 'block')
    ? 'blocked' : gates.some((item) => item.status === 'needs-evidence')
      ? 'needs-drill' : 'shadow-ready';
  const shadowMetrics = shadowReport ? {
    accuracy: shadowReport.accuracy, eligiblePrecision: shadowReport.eligiblePrecision,
    expectedEligibleCount: shadowReport.expectedEligibleCount,
    falseEligibleCount: shadowReport.falseEligibleCount, readiness: shadowReport.readiness,
    sampleCount: shadowReport.sampleCount,
  } : null;
  return { automaticWriteEnabled: false, decision, gates, shadowMetrics };
}
