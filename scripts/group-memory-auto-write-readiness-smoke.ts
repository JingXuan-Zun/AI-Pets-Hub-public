import assert from 'node:assert/strict';
import {
  buildGroupMemoryAutoWriteReadinessReport,
  buildGroupMemoryReadinessApprovalReleaseChecklist,
  buildGroupMemoryReadinessReviewTrendChecklist,
  auditGroupMemoryReadinessReviewTrendApprovalHistory,
  auditGroupMemoryReadinessReviewHistory,
  createGroupMemoryAutoWriteReadinessExport,
  compareGroupMemoryAutoWriteReadinessExports,
  compareGroupMemoryReadinessReviewHistoryExports,
  createGroupMemoryReadinessComparisonExport,
  createGroupMemoryReadinessApprovalHistoryExport,
  createGroupMemoryReadinessManualReleaseReviewReceipt,
  createGroupMemoryReadinessReviewReceipt,
  createGroupMemoryReadinessReviewHistoryExport,
  createGroupMemoryReadinessReviewTrendExport,
  createGroupMemoryReadinessReviewTrendApprovalReceipt,
  EMPTY_GROUP_MEMORY_REPOSITORY,
  type GroupMemoryCandidateShadowReport,
  serializeGroupMemoryAutoWriteReadinessExport,
  parseGroupMemoryAutoWriteReadinessExportJson,
  parseGroupMemoryReadinessReviewReceiptJson,
  parseGroupMemoryReadinessReviewHistoryExportJson,
  parseGroupMemoryReadinessReviewTrendExportJson,
  parseGroupMemoryReadinessReviewTrendApprovalReceiptJson,
  parseGroupMemoryReadinessApprovalHistoryExportJson,
  parseGroupMemoryReadinessManualReleaseReviewReceiptJson,
  serializeGroupMemoryReadinessComparisonExport,
  serializeGroupMemoryReadinessApprovalHistoryExport,
  serializeGroupMemoryReadinessManualReleaseReviewReceipt,
  serializeGroupMemoryReadinessReviewReceipt,
  serializeGroupMemoryReadinessReviewHistoryExport,
  serializeGroupMemoryReadinessReviewTrendExport,
  serializeGroupMemoryReadinessReviewTrendApprovalReceipt,
  validateGroupMemoryReadinessReviewTrendExport,
  validateGroupMemoryReadinessApprovalHistoryExport,
  MAX_GROUP_MEMORY_READINESS_APPROVAL_HISTORY_EXPORT_AGE_MS,
  MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_EXPORT_AGE_MS,
  MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_AGE_MS,
  validateGroupMemoryReadinessReviewReceipt,
  MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS,
} from '../src/group-memory';

const readyShadow: GroupMemoryCandidateShadowReport = {
  accuracy: 1, actualEligibleCount: 5, eligiblePrecision: 1,
  expectedEligibleCount: 5, falseEligibleCount: 0, matchedCount: 20,
  mismatches: [], readiness: 'ready', sampleCount: 20,
};

const empty = buildGroupMemoryAutoWriteReadinessReport(
  EMPTY_GROUP_MEMORY_REPOSITORY, null,
);
assert.equal(empty.automaticWriteEnabled, false);
assert.equal(empty.decision, 'needs-drill');
assert.equal(empty.gates.find((item) => item.id === 'shadow-corpus')?.status,
  'needs-evidence');

const evidencedRepository = {
  ...EMPTY_GROUP_MEMORY_REPOSITORY,
  candidateReviewReceipts: [{
    candidateId: 'candidate-1', decision: 'rollback' as const, id: 'review-rollback-1',
    nextStatus: 'pending' as const, occurredAt: 2, previousStatus: 'approved' as const,
    recordAfter: null, recordBefore: null, revertsReceiptId: 'review-1',
  }],
  evidenceScopeCorrections: [{
    correctedGroupId: 'current-group', correctedRecordId: 'memory-1',
    id: 'scope-correction-1', occurredAt: 3, reason: 'drill', snapshotId: 'scope-1',
  }],
  receipts: [{
    changes: [{ after: null, before: null, recordId: 'memory-1' }],
    id: 'operation-rollback-1', kind: 'rollback' as const, occurredAt: 4,
  }],
};
const ready = buildGroupMemoryAutoWriteReadinessReport(evidencedRepository, readyShadow);
assert.equal(ready.decision, 'shadow-ready');
assert.equal(ready.automaticWriteEnabled, false,
  'readiness must never enable automatic formal writes');
assert.equal(ready.gates.every((item) => item.status === 'pass'), true);

const unsafeShadow = { ...readyShadow, falseEligibleCount: 1,
  readiness: 'unsafe-false-eligible' as const };
const unsafe = buildGroupMemoryAutoWriteReadinessReport(evidencedRepository, unsafeShadow);
assert.equal(unsafe.decision, 'blocked');
assert.equal(unsafe.gates.find((item) => item.id === 'false-eligible')?.status, 'block');

const blockedApproval = buildGroupMemoryAutoWriteReadinessReport({
  ...evidencedRepository,
  candidates: [{
    createdAt: 1, evidence: {
      capturedAt: 1, excerpt: '这是真的吗？', kind: 'chat-message',
      sourceMessageId: 'message-1', sourceRoleId: 'alice', topicId: 'topic-1',
    },
    id: 'candidate-blocked', proposedRecord: {
      confidence: 0.8, createdAt: 1, groupId: 'current-group', id: 'memory-blocked',
      kind: 'discussion-summary', sourceRoleId: 'alice', summary: 'question',
      topicId: 'topic-1', updatedAt: 1, visibility: 'group',
    },
    status: 'approved',
  }],
}, readyShadow);
assert.equal(blockedApproval.decision, 'blocked');
assert.equal(blockedApproval.gates.find((item) => (
  item.id === 'approved-candidate-screening'
))?.count, 1);

const duplicateRecord = {
  confidence: 1, createdAt: 1, groupId: 'current-group', kind: 'discussion-summary' as const,
  sourceRoleId: 'alice', summary: 'duplicate', topicId: 'topic-1', updatedAt: 1,
  visibility: 'group' as const,
};
const duplicate = buildGroupMemoryAutoWriteReadinessReport({
  ...evidencedRepository,
  records: [{ ...duplicateRecord, id: 'memory-1' }, { ...duplicateRecord, id: 'memory-2' }],
}, readyShadow);
assert.equal(duplicate.decision, 'blocked');
assert.equal(duplicate.gates.find((item) => item.id === 'duplicate-conflicts')?.count, 1);
const archived = buildGroupMemoryAutoWriteReadinessReport({
  ...evidencedRepository,
  candidateArchives: [{
    approvedCount: 1, archivedAt: 10, candidateCount: 1, firstCandidateId: 'old-1',
    firstCreatedAt: 1, id: 'archive-1', lastCandidateId: 'old-1', lastReviewedAt: 2,
    rejectedCount: 0, reviewReceiptCount: 1,
  }],
}, readyShadow);
assert.equal(archived.decision, 'needs-drill');
assert.equal(archived.gates.find((item) => item.id === 'retained-candidate-audit')?.status,
  'needs-evidence');
const exported = createGroupMemoryAutoWriteReadinessExport(ready, 123);
assert.equal(exported.schemaVersion, 1);
assert.equal(exported.generatedAt, 123);
assert.equal(exported.report.automaticWriteEnabled, false);
assert.deepEqual(exported.report.shadowMetrics, {
  accuracy: 1, eligiblePrecision: 1, expectedEligibleCount: 5,
  falseEligibleCount: 0, readiness: 'ready', sampleCount: 20,
});
assert.deepEqual(exported.privacy, {
  containsChatContent: false, containsLocalPaths: false,
  containsMemorySummaries: false, containsMessageOrRoleIds: false,
});
const serialized = serializeGroupMemoryAutoWriteReadinessExport(ready, 123);
assert.equal(serialized.endsWith('\n'), true);
assert.doesNotMatch(serialized, /candidate-1|memory-1|message-1|alice|summary/iu);
const stableArtifacts = [1, 2, 3].map((generatedAt) => (
  createGroupMemoryAutoWriteReadinessExport(ready, generatedAt)
));
const stable = compareGroupMemoryAutoWriteReadinessExports(stableArtifacts);
assert.equal(stable.status, 'stable-shadow-evidence');
assert.equal(stable.reportCount, 3);
assert.equal(stable.independence, 'user-attested-not-verifiable');
assert.equal(stable.minimumAccuracy, 1);
const comparisonExport = createGroupMemoryReadinessComparisonExport(stable, true, 456);
assert.equal(comparisonExport.exportedAt, 456);
assert.equal(comparisonExport.attestation.independentBatchesConfirmedByTester, true);
assert.equal(comparisonExport.attestation.programmaticallyVerified, false);
assert.deepEqual(comparisonExport.comparison, stable);
const comparisonText = serializeGroupMemoryReadinessComparisonExport(stable, true, 456);
assert.equal(comparisonText.endsWith('\n'), true);
assert.doesNotMatch(comparisonText, /candidate-1|memory-1|message-1|alice|summary/iu);
assert.doesNotMatch(comparisonText, /\.json|\\|sourceMessageId|sourceRoleId/iu);
const reviewInput = {
  comparison: stable, decision: 'accept-for-version-review' as const,
  independentBatchesConfirmedByTester: true,
  noAutomaticApplicationAcknowledged: true,
  rationale: 'private reviewer note',
};
const reviewReceipt = createGroupMemoryReadinessReviewReceipt(reviewInput, 789);
assert.equal(reviewReceipt?.decision, 'accept-for-version-review');
assert.equal(reviewReceipt?.validationBoundary.executable, false);
assert.equal(reviewReceipt?.validationBoundary.automaticWriteEnabled, false);
assert.equal(reviewReceipt?.privacy.containsReviewerRationale, false);
assert.equal(createGroupMemoryReadinessReviewReceipt({
  ...reviewInput, independentBatchesConfirmedByTester: false,
}, 789), null);
assert.equal(createGroupMemoryReadinessReviewReceipt({
  ...reviewInput, comparison: { ...stable, status: 'accuracy-drift' },
}, 789), null);
const reviewText = serializeGroupMemoryReadinessReviewReceipt(reviewInput, 789)!;
assert.doesNotMatch(reviewText, /private reviewer note|sourceMessageId|sourceRoleId/iu);
assert.equal(JSON.parse(reviewText).rationaleSummary.length, reviewInput.rationale.length);
const parsedReview = parseGroupMemoryReadinessReviewReceiptJson(reviewText)!;
assert.equal(parsedReview.reviewedAt, 789);
assert.deepEqual(validateGroupMemoryReadinessReviewReceipt(parsedReview, stable, 789), []);
assert.deepEqual(validateGroupMemoryReadinessReviewReceipt(
  parsedReview, { ...stable, reportCount: 4 }, 789,
), ['comparison-mismatch']);
assert.deepEqual(validateGroupMemoryReadinessReviewReceipt(
  parsedReview, stable, 789 + MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS + 1,
), ['expired-receipt']);
assert.deepEqual(validateGroupMemoryReadinessReviewReceipt(parsedReview, stable, 788),
  ['future-reviewed-at']);
const reviewWithExtraField = JSON.parse(reviewText) as Record<string, unknown>;
reviewWithExtraField.repository = 'forbidden';
assert.equal(parseGroupMemoryReadinessReviewReceiptJson(JSON.stringify(reviewWithExtraField)), null);
const reviewWithUnsafeBoundary = JSON.parse(reviewText) as {
  validationBoundary: { automaticWriteEnabled: boolean };
};
reviewWithUnsafeBoundary.validationBoundary.automaticWriteEnabled = true;
assert.equal(parseGroupMemoryReadinessReviewReceiptJson(
  JSON.stringify(reviewWithUnsafeBoundary),
), null);
const comparisonAt = (latestGeneratedAt: number) => ({ ...stable, latestGeneratedAt });
const historyReceipt = (
  latestGeneratedAt: number,
  decision: 'accept-for-version-review' | 'needs-more-evidence' | 'reject-for-now',
  reviewedAt: number,
) => createGroupMemoryReadinessReviewReceipt({
  ...reviewInput, comparison: comparisonAt(latestGeneratedAt), decision,
}, reviewedAt)!;
const consistentHistory = auditGroupMemoryReadinessReviewHistory([
  historyReceipt(1, 'needs-more-evidence', 100),
  historyReceipt(2, 'accept-for-version-review', 200),
], comparisonAt(2), 200);
assert.equal(consistentHistory.status, 'consistent-history');
assert.equal(consistentHistory.latestMatchesCurrentComparison, true);
assert.equal(consistentHistory.currentComparisonMatchCount, 1);
const historyExport = createGroupMemoryReadinessReviewHistoryExport(consistentHistory, 456);
assert.equal(historyExport.generatedAt, 456);
assert.equal(historyExport.report.status, 'consistent-history');
assert.equal(historyExport.report.receiptCount, 2);
assert.equal(historyExport.validationBoundary.executable, false);
assert.equal(historyExport.validationBoundary.automaticWriteEnabled, false);
assert.equal(historyExport.privacy.containsRawReceipts, false);
assert.equal(historyExport.privacy.containsReceiptTimestamps, false);
const historyExportText = serializeGroupMemoryReadinessReviewHistoryExport(
  consistentHistory, 456,
);
assert.equal(historyExportText.endsWith('\n'), true);
assert.doesNotMatch(historyExportText,
  /"latestReviewedAt"|"reviewedAt"|"fileName"|"localPath"|private reviewer|sourceMessageId/iu);
const parsedHistoryExport = parseGroupMemoryReadinessReviewHistoryExportJson(historyExportText)!;
assert.equal(parsedHistoryExport.report.status, 'consistent-history');
const stableHistoryExports = [1, 2].map((generatedAt) => ({
  ...parsedHistoryExport, generatedAt,
}));
const stableTrend = compareGroupMemoryReadinessReviewHistoryExports(stableHistoryExports);
assert.equal(stableTrend.status, 'stable-audit-trend');
assert.equal(stableTrend.versionIdentity, 'user-attested-not-verifiable');
const unconfirmedTrendChecklist = buildGroupMemoryReadinessReviewTrendChecklist(
  stableTrend, false,
);
assert.equal(unconfirmedTrendChecklist.decision, 'needs-attestation');
assert.equal(unconfirmedTrendChecklist.gates.find((item) => (
  item.id === 'version-identity-attestation'
))?.status, 'needs-attestation');
const confirmedTrendChecklist = buildGroupMemoryReadinessReviewTrendChecklist(stableTrend, true);
assert.equal(confirmedTrendChecklist.decision, 'ready-for-manual-version-review');
assert.equal(confirmedTrendChecklist.gates.every((item) => item.status === 'pass'), true);
const trendExport = createGroupMemoryReadinessReviewTrendExport(stableTrend, true, 654);
assert.equal(trendExport.generatedAt, 654);
assert.equal(trendExport.attestation.programmaticallyVerifiedVersionIdentity, false);
assert.equal(trendExport.validationBoundary.automaticWriteEnabled, false);
assert.equal(trendExport.validationBoundary.executable, false);
assert.equal(trendExport.validationBoundary.reviewOnly, true);
assert.equal(trendExport.privacy.containsRawAuditReports, false);
const trendExportText = serializeGroupMemoryReadinessReviewTrendExport(stableTrend, true, 654);
assert.equal(trendExportText.endsWith('\n'), true);
assert.doesNotMatch(trendExportText,
  /"fileName"|"localPath"|"reviewedAt"|"rawReceipt"|private reviewer|sourceMessageId/iu);
const parsedTrendExport = parseGroupMemoryReadinessReviewTrendExportJson(trendExportText)!;
assert.equal(parsedTrendExport.checklist.decision, 'ready-for-manual-version-review');
assert.deepEqual(validateGroupMemoryReadinessReviewTrendExport(parsedTrendExport, 654), []);
assert.deepEqual(validateGroupMemoryReadinessReviewTrendExport(parsedTrendExport, 653),
  ['future-generated-at']);
assert.deepEqual(validateGroupMemoryReadinessReviewTrendExport(
  parsedTrendExport, 654 + MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_EXPORT_AGE_MS + 1,
), ['expired-report']);
const tamperedTrendChecklist = JSON.parse(trendExportText) as {
  checklist: { decision: string };
};
tamperedTrendChecklist.checklist.decision = 'blocked';
assert.equal(parseGroupMemoryReadinessReviewTrendExportJson(
  JSON.stringify(tamperedTrendChecklist),
), null);
const unsafeTrendBoundary = JSON.parse(trendExportText) as {
  validationBoundary: { automaticWriteEnabled: boolean };
};
unsafeTrendBoundary.validationBoundary.automaticWriteEnabled = true;
assert.equal(parseGroupMemoryReadinessReviewTrendExportJson(
  JSON.stringify(unsafeTrendBoundary),
), null);
const trendApprovalInput = {
  decision: 'accept-evidence-for-manual-review' as const, issues: [],
  noAutomaticApplicationAcknowledged: true,
  rationale: 'private trend approval rationale', report: parsedTrendExport,
};
const trendApproval = createGroupMemoryReadinessReviewTrendApprovalReceipt(
  trendApprovalInput, 777,
);
assert.equal(trendApproval?.decision, 'accept-evidence-for-manual-review');
assert.equal(trendApproval?.validationBoundary.executable, false);
assert.equal(trendApproval?.validationBoundary.automaticWriteEnabled, false);
assert.equal(createGroupMemoryReadinessReviewTrendApprovalReceipt({
  ...trendApprovalInput, noAutomaticApplicationAcknowledged: false,
}, 777), null);
assert.equal(createGroupMemoryReadinessReviewTrendApprovalReceipt({
  ...trendApprovalInput, issues: ['expired-report'],
}, 777), null);
assert.ok(createGroupMemoryReadinessReviewTrendApprovalReceipt({
  ...trendApprovalInput, decision: 'needs-more-evidence', issues: ['expired-report'],
}, 777));
const trendApprovalText = serializeGroupMemoryReadinessReviewTrendApprovalReceipt(
  trendApprovalInput, 777,
)!;
assert.doesNotMatch(trendApprovalText, /private trend approval rationale|sourceMessageId/iu);
const parsedTrendApproval = parseGroupMemoryReadinessReviewTrendApprovalReceiptJson(
  trendApprovalText,
)!;
assert.equal(parsedTrendApproval.sourceReference.generatedAt, 654);
const approvalWithExtra = JSON.parse(trendApprovalText) as Record<string, unknown>;
approvalWithExtra.repository = 'forbidden';
assert.equal(parseGroupMemoryReadinessReviewTrendApprovalReceiptJson(
  JSON.stringify(approvalWithExtra),
), null);
const approvalWithUnsafeBoundary = JSON.parse(trendApprovalText) as {
  validationBoundary: { executable: boolean };
};
approvalWithUnsafeBoundary.validationBoundary.executable = true;
assert.equal(parseGroupMemoryReadinessReviewTrendApprovalReceiptJson(
  JSON.stringify(approvalWithUnsafeBoundary),
), null);
const approvalReceipt = (
  generatedAt: number,
  decision: 'accept-evidence-for-manual-review' | 'needs-more-evidence' | 'reject-for-now',
  reviewedAt: number,
) => createGroupMemoryReadinessReviewTrendApprovalReceipt({
  ...trendApprovalInput, decision,
  report: { ...parsedTrendExport, generatedAt },
}, reviewedAt)!;
const consistentApprovalHistory = auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(1, 'needs-more-evidence', 100),
  approvalReceipt(2, 'accept-evidence-for-manual-review', 200),
], 200);
assert.equal(consistentApprovalHistory.status, 'consistent-history');
assert.equal(consistentApprovalHistory.latestDecision, 'accept-evidence-for-manual-review');
const unconfirmedReleaseChecklist = buildGroupMemoryReadinessApprovalReleaseChecklist(
  consistentApprovalHistory, false,
);
assert.equal(unconfirmedReleaseChecklist.decision, 'needs-attestation');
assert.equal(unconfirmedReleaseChecklist.gates.find((item) => (
  item.id === 'manual-release-review-boundary'
))?.status, 'needs-attestation');
const confirmedReleaseChecklist = buildGroupMemoryReadinessApprovalReleaseChecklist(
  consistentApprovalHistory, true,
);
assert.equal(confirmedReleaseChecklist.decision, 'ready-for-manual-release-review');
assert.equal(confirmedReleaseChecklist.gates.every((item) => item.status === 'pass'), true);
const approvalHistoryExport = createGroupMemoryReadinessApprovalHistoryExport(
  consistentApprovalHistory, true, 987,
);
assert.equal(approvalHistoryExport.generatedAt, 987);
assert.equal(approvalHistoryExport.validationBoundary.automaticWriteEnabled, false);
assert.equal(approvalHistoryExport.validationBoundary.executable, false);
assert.equal(approvalHistoryExport.validationBoundary.releaseReviewOnly, true);
assert.equal(approvalHistoryExport.privacy.containsRawApprovalReceipts, false);
assert.equal(approvalHistoryExport.privacy.containsReceiptTimestamps, false);
const approvalHistoryExportText = serializeGroupMemoryReadinessApprovalHistoryExport(
  consistentApprovalHistory, true, 987,
);
assert.equal(approvalHistoryExportText.endsWith('\n'), true);
assert.doesNotMatch(approvalHistoryExportText,
  /"reviewedAt"|"rawReceipt"|"reviewerRationale"|"notes"|"fileName"|"localPath"|private reviewer|sourceMessageId/iu);
const parsedApprovalHistoryExport = parseGroupMemoryReadinessApprovalHistoryExportJson(
  approvalHistoryExportText,
)!;
assert.deepEqual(validateGroupMemoryReadinessApprovalHistoryExport(
  parsedApprovalHistoryExport, 987,
), []);
assert.deepEqual(validateGroupMemoryReadinessApprovalHistoryExport(
  parsedApprovalHistoryExport, 986,
), ['future-generated-at']);
assert.deepEqual(validateGroupMemoryReadinessApprovalHistoryExport(
  parsedApprovalHistoryExport,
  987 + MAX_GROUP_MEMORY_READINESS_APPROVAL_HISTORY_EXPORT_AGE_MS + 1,
), ['expired-report']);
const tamperedApprovalHistory = JSON.parse(approvalHistoryExportText) as {
  checklist: { decision: string };
};
tamperedApprovalHistory.checklist.decision = 'blocked';
assert.equal(parseGroupMemoryReadinessApprovalHistoryExportJson(
  JSON.stringify(tamperedApprovalHistory),
), null);
const manualReleaseInput = {
  configurationReviewOnlyAcknowledged: true,
  decision: 'accept-for-manual-configuration-review' as const,
  issues: [], rationale: 'private final reviewer note', report: parsedApprovalHistoryExport,
};
assert.equal(createGroupMemoryReadinessManualReleaseReviewReceipt({
  ...manualReleaseInput, configurationReviewOnlyAcknowledged: false,
}, 1), null);
const manualReleaseReceipt = createGroupMemoryReadinessManualReleaseReviewReceipt(
  manualReleaseInput, 1,
)!;
assert.equal(manualReleaseReceipt.validationBoundary.automaticWriteEnabled, false);
assert.equal(manualReleaseReceipt.validationBoundary.configurationApplied, false);
assert.equal(manualReleaseReceipt.validationBoundary.configurationReviewOnly, true);
assert.equal(manualReleaseReceipt.validationBoundary.executable, false);
const manualReleaseText = serializeGroupMemoryReadinessManualReleaseReviewReceipt(
  manualReleaseInput, 1,
)!;
assert.doesNotMatch(manualReleaseText, /private final reviewer note|fileName|localPath/iu);
assert.ok(parseGroupMemoryReadinessManualReleaseReviewReceiptJson(manualReleaseText));
const unsafeManualRelease = JSON.parse(manualReleaseText) as {
  validationBoundary: { configurationApplied: boolean };
};
unsafeManualRelease.validationBoundary.configurationApplied = true;
assert.equal(parseGroupMemoryReadinessManualReleaseReviewReceiptJson(
  JSON.stringify(unsafeManualRelease),
), null);
const blockedApprovalHistoryReport = createGroupMemoryReadinessApprovalHistoryExport(
  { ...consistentApprovalHistory, latestDecision: null, receiptCount: 0 }, false, 987,
);
const blockedManualReleaseText = serializeGroupMemoryReadinessManualReleaseReviewReceipt({
  configurationReviewOnlyAcknowledged: true,
  decision: 'reject-for-now', issues: [], rationale: '', report: blockedApprovalHistoryReport,
}, 2)!;
assert.ok(parseGroupMemoryReadinessManualReleaseReviewReceiptJson(blockedManualReleaseText));
assert.equal(createGroupMemoryReadinessManualReleaseReviewReceipt({
  configurationReviewOnlyAcknowledged: true,
  decision: 'accept-for-manual-configuration-review', issues: [], rationale: '',
  report: blockedApprovalHistoryReport,
}, 2), null);
assert.equal(auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(1, 'accept-evidence-for-manual-review', 100),
  approvalReceipt(2, 'needs-more-evidence', 200),
], 200).status, 'decision-regression');
assert.equal(buildGroupMemoryReadinessApprovalReleaseChecklist(
  auditGroupMemoryReadinessReviewTrendApprovalHistory([
    approvalReceipt(1, 'accept-evidence-for-manual-review', 100),
    approvalReceipt(2, 'needs-more-evidence', 200),
  ], 200), true,
).decision, 'blocked');
assert.equal(buildGroupMemoryReadinessApprovalReleaseChecklist(
  auditGroupMemoryReadinessReviewTrendApprovalHistory([
    approvalReceipt(2, 'needs-more-evidence', 100),
    approvalReceipt(1, 'accept-evidence-for-manual-review', 200),
  ], 200), true,
).decision, 'blocked');
assert.equal(buildGroupMemoryReadinessApprovalReleaseChecklist(
  auditGroupMemoryReadinessReviewTrendApprovalHistory([
    approvalReceipt(1, 'accept-evidence-for-manual-review', 100),
    approvalReceipt(2, 'needs-more-evidence', 200),
    approvalReceipt(3, 'accept-evidence-for-manual-review', 300),
  ], 300), true,
).decision, 'blocked');
assert.equal(auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(1, 'accept-evidence-for-manual-review', 100),
  approvalReceipt(2, 'needs-more-evidence', 200),
  approvalReceipt(3, 'accept-evidence-for-manual-review', 300),
], 300).status, 'decision-oscillation');
assert.equal(auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(2, 'needs-more-evidence', 100),
  approvalReceipt(1, 'needs-more-evidence', 200),
], 200).status, 'source-report-regression');
assert.equal(auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(1, 'needs-more-evidence', 100),
  approvalReceipt(1, 'accept-evidence-for-manual-review', 200),
], 200).status, 'duplicate-source-report');
assert.equal(auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(1, 'needs-more-evidence', 100),
  approvalReceipt(2, 'accept-evidence-for-manual-review', 100),
], 100).status, 'duplicate-reviewed-at');
assert.equal(auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(1, 'needs-more-evidence', 100),
], 99).status, 'future-reviewed-at');
assert.equal(auditGroupMemoryReadinessReviewTrendApprovalHistory([
  approvalReceipt(1, 'needs-more-evidence', 100),
], 100 + MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_AGE_MS + 1).status,
  'expired-receipts');
assert.equal(compareGroupMemoryReadinessReviewHistoryExports([
  stableHistoryExports[0]!, { ...stableHistoryExports[1]!, generatedAt: 1 },
]).status, 'duplicate-generated-at');
const regressedHistoryExport = createGroupMemoryReadinessReviewHistoryExport(
  { ...consistentHistory, evidenceRegressionCount: 1, status: 'evidence-regression' }, 2,
);
assert.equal(compareGroupMemoryReadinessReviewHistoryExports([
  stableHistoryExports[0]!, regressedHistoryExport,
]).status, 'regressed-audit-metrics');
assert.equal(buildGroupMemoryReadinessReviewTrendChecklist(
  compareGroupMemoryReadinessReviewHistoryExports([
    stableHistoryExports[0]!, regressedHistoryExport,
  ]), true,
).decision, 'blocked');
const fullCoverage = createGroupMemoryReadinessReviewHistoryExport({
  ...consistentHistory, currentComparisonMatchCount: 2,
}, 1);
const halfCoverage = createGroupMemoryReadinessReviewHistoryExport({
  ...consistentHistory, currentComparisonMatchCount: 1,
}, 2);
assert.equal(compareGroupMemoryReadinessReviewHistoryExports([
  fullCoverage, halfCoverage,
]).status, 'match-coverage-drift');
const latestMismatch = createGroupMemoryReadinessReviewHistoryExport({
  ...consistentHistory, latestMatchesCurrentComparison: false,
}, 2);
assert.equal(compareGroupMemoryReadinessReviewHistoryExports([
  stableHistoryExports[0]!, latestMismatch,
]).status, 'latest-evidence-mismatch');
const repeatedExpired = createGroupMemoryReadinessReviewHistoryExport({
  ...consistentHistory, expiredCount: 1, status: 'expired-receipts',
}, 1);
assert.equal(compareGroupMemoryReadinessReviewHistoryExports([
  repeatedExpired, { ...repeatedExpired, generatedAt: 2 },
]).status, 'not-all-consistent');
const historyExportWithExtra = JSON.parse(historyExportText) as Record<string, unknown>;
historyExportWithExtra.fileName = 'forbidden';
assert.equal(parseGroupMemoryReadinessReviewHistoryExportJson(
  JSON.stringify(historyExportWithExtra),
), null);
const historyExportWithUnsafeBoundary = JSON.parse(historyExportText) as {
  validationBoundary: { executable: boolean };
};
historyExportWithUnsafeBoundary.validationBoundary.executable = true;
assert.equal(parseGroupMemoryReadinessReviewHistoryExportJson(
  JSON.stringify(historyExportWithUnsafeBoundary),
), null);
const historyExportWithWrongStatus = JSON.parse(historyExportText) as {
  report: { status: string };
};
historyExportWithWrongStatus.report.status = 'evidence-regression';
assert.equal(parseGroupMemoryReadinessReviewHistoryExportJson(
  JSON.stringify(historyExportWithWrongStatus),
), null);
const regressedHistory = auditGroupMemoryReadinessReviewHistory([
  historyReceipt(1, 'accept-for-version-review', 100),
  historyReceipt(2, 'needs-more-evidence', 200),
], comparisonAt(2), 200);
assert.equal(regressedHistory.status, 'decision-regression');
assert.equal(regressedHistory.decisionRegressionCount, 1);
const oscillatingHistory = auditGroupMemoryReadinessReviewHistory([
  historyReceipt(1, 'accept-for-version-review', 100),
  historyReceipt(2, 'needs-more-evidence', 200),
  historyReceipt(3, 'accept-for-version-review', 300),
], comparisonAt(3), 300);
assert.equal(oscillatingHistory.status, 'decision-oscillation');
assert.equal(oscillatingHistory.decisionOscillationCount, 1);
const evidenceRegressionHistory = auditGroupMemoryReadinessReviewHistory([
  historyReceipt(2, 'needs-more-evidence', 100),
  historyReceipt(1, 'needs-more-evidence', 200),
], comparisonAt(2), 200);
assert.equal(evidenceRegressionHistory.status, 'evidence-regression');
assert.equal(evidenceRegressionHistory.evidenceRegressionCount, 1);
assert.equal(auditGroupMemoryReadinessReviewHistory([
  historyReceipt(1, 'needs-more-evidence', 100),
  historyReceipt(2, 'needs-more-evidence', 100),
], comparisonAt(2), 100).status, 'duplicate-reviewed-at');
assert.equal(auditGroupMemoryReadinessReviewHistory([
  historyReceipt(1, 'needs-more-evidence', 100),
], comparisonAt(1), 99).status, 'future-reviewed-at');
assert.equal(auditGroupMemoryReadinessReviewHistory([
  historyReceipt(1, 'needs-more-evidence', 100),
], comparisonAt(1), 100 + MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS + 1).status,
  'expired-receipts');
assert.equal(compareGroupMemoryAutoWriteReadinessExports(stableArtifacts.slice(0, 2)).status,
  'insufficient-reports');
assert.equal(compareGroupMemoryAutoWriteReadinessExports([
  stableArtifacts[0]!, stableArtifacts[1]!, { ...stableArtifacts[2]!, generatedAt: 2 },
]).status, 'duplicate-report-time');
const driftReport = { ...ready, shadowMetrics: { ...ready.shadowMetrics!, accuracy: 0.9 } };
assert.equal(compareGroupMemoryAutoWriteReadinessExports([
  stableArtifacts[0]!, stableArtifacts[1]!,
  createGroupMemoryAutoWriteReadinessExport(driftReport, 3),
]).status, 'accuracy-drift');
const precisionDriftReport = { ...ready,
  shadowMetrics: { ...ready.shadowMetrics!, eligiblePrecision: 0.97 } };
assert.equal(compareGroupMemoryAutoWriteReadinessExports([
  stableArtifacts[0]!, stableArtifacts[1]!,
  createGroupMemoryAutoWriteReadinessExport(precisionDriftReport, 3),
]).status, 'eligible-precision-drift');
assert.equal(compareGroupMemoryAutoWriteReadinessExports([
  stableArtifacts[0]!, stableArtifacts[1]!,
  createGroupMemoryAutoWriteReadinessExport(unsafe, 3),
]).status, 'unsafe-false-eligible');
const unstableGateReport = { ...ready, decision: 'needs-drill' as const,
  gates: ready.gates.map((item, index) => index ? item : { ...item, status: 'needs-evidence' as const }) };
assert.equal(compareGroupMemoryAutoWriteReadinessExports([
  stableArtifacts[0]!, stableArtifacts[1]!,
  createGroupMemoryAutoWriteReadinessExport(unstableGateReport, 3),
]).status, 'unstable-gates');
assert.ok(parseGroupMemoryAutoWriteReadinessExportJson(serialized));
const withForbiddenField = JSON.parse(serialized) as Record<string, unknown>;
withForbiddenField.sourceMessageId = 'forbidden';
assert.equal(parseGroupMemoryAutoWriteReadinessExportJson(JSON.stringify(withForbiddenField)), null);
console.log('group memory auto write readiness smoke ok');
