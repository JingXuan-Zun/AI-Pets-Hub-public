import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [
  'src/social-trend/relationshipEvidenceShadowCorpusTypes.ts',
  'src/social-trend/relationshipEvidenceShadowCorpusImport.ts',
  'src/social-trend/relationshipEvidenceShadowEvaluation.ts',
  'src/social-trend/relationshipEvidenceShadowReadiness.ts',
  'src/social-trend/relationshipEvidenceShadowBatchEvaluation.ts',
  'src/social-trend/relationshipEvidenceShadowDrift.ts',
  'src/social-trend/relationshipEvidenceShadowDerivedReport.ts',
  'src/social-trend/relationshipEvidenceShadowConfidence.ts',
  'src/social-trend/relationshipEvidenceShadowReasonEvaluation.ts',
  'src/social-trend/relationshipEvidenceShadowReasonConfidence.ts',
  'src/social-trend/relationshipEvidenceShadowReasonDrift.ts',
  'src/social-trend/relationshipEvidenceShadowReasonStability.ts',
  'src/social-trend/relationshipEvidenceShadowManualReviewReadiness.ts',
  'src/social-trend/relationshipEvidenceShadowManualReviewPacket.ts',
  'src/social-trend/relationshipEvidenceShadowManualReviewDecision.ts',
  'src/social-trend/relationshipEvidenceShadowManualReviewReceipt.ts',
  'src/social-trend/relationshipEvidenceShadowCorpusTemplate.ts',
  'src/components/settings/useSettingsRelationshipEvidenceShadowCorpus.ts',
  'src/components/settings/SettingsRelationshipEvidenceShadowCorpusPreview.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowBatchReport.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowDriftReport.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowConfidenceReport.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowReasonReport.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowReasonConfidenceReport.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowReasonDriftReport.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowReasonStabilityReport.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowManualReviewReadiness.tsx',
  'src/components/settings/SettingsRelationshipEvidenceShadowManualReviewPacketButton.tsx',
  'src/components/settings/relationshipEvidenceShadowManualReviewPacketDownload.ts',
  'src/components/settings/SettingsRelationshipEvidenceShadowManualReviewDecision.tsx',
  'src/components/settings/relationshipEvidenceShadowManualReviewDecisionTemplateDownload.ts',
  'src/components/settings/SettingsRelationshipEvidenceShadowManualReviewReceiptButton.tsx',
  'src/components/settings/relationshipEvidenceShadowManualReviewReceiptDownload.ts',
  'src/components/settings/relationshipEvidenceShadowUiLabels.ts',
  'src/components/settings/relationshipEvidenceShadowDerivedReportDownload.ts',
  'src/components/settings/relationshipEvidenceShadowCorpusTemplateDownload.ts',
];

function line(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectFunctions(source: ts.SourceFile) {
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(source, node.body.end) - line(source, node.getStart(source)) + 1;
      assert.ok(size <= 50, `${source.fileName} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const relativePath of files) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true,
    relativePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  inspectFunctions(source);
  assert.doesNotMatch(text,
    /createStore|localStorage|sessionStorage|writeFile|fetch\(|GroupChatRuntime|AgentRuntime|gemini|openai/iu);
}

const evaluation = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowEvaluation.ts', 'utf8',
);
assert.match(evaluation, /buildRelationshipEvidenceWindows\s*\(/u,
  'evaluation must call the production evidence-window projection');
assert.doesNotMatch(evaluation, /MIN_SUSTAINED|MAX_REJECTION|MAX_ROLLBACK|24 \* 60/u,
  'evaluation must not duplicate production readiness thresholds');
const hook = fs.readFileSync(
  'src/components/settings/useSettingsRelationshipEvidenceShadowCorpus.ts', 'utf8',
);
assert.match(hook, /visibilitychange/u);
assert.match(hook, /pagehide/u);
assert.match(hook, /MAX_RELATIONSHIP_EVIDENCE_SHADOW_BATCH_FILES = 20/u);
assert.match(hook, /MAX_RELATIONSHIP_EVIDENCE_SHADOW_BATCH_BYTES = 5_000_000/u);
const preview = fs.readFileSync(
  'src/components/settings/SettingsRelationshipEvidenceShadowCorpusPreview.tsx', 'utf8',
);
assert.match(preview, /不会上传、保存、生成候选、写正式关系或影响聊天/u);
assert.match(preview, /不代表允许自动生成候选或写入正式关系/u);
assert.match(preview, /multiple/u);
const readiness = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowReadiness.ts', 'utf8',
);
assert.doesNotMatch(readiness,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const batch = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowBatchEvaluation.ts', 'utf8',
);
assert.match(batch, /offline-batch-calibration-only/u);
assert.doesNotMatch(batch,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const derived = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowDerivedReport.ts', 'utf8',
);
assert.match(derived, /derived-offline-metrics-only/u);
assert.doesNotMatch(derived,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const confidence = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowConfidence.ts', 'utf8',
);
assert.match(confidence, /WILSON_Z_95/u);
assert.match(confidence, /MIN_RELATIONSHIP_EVIDENCE_SHADOW_METRIC_DENOMINATOR = 20/u);
assert.doesNotMatch(confidence,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const reasonEvaluation = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowReasonEvaluation.ts', 'utf8',
);
assert.match(reasonEvaluation, /RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES/u);
assert.doesNotMatch(reasonEvaluation,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const reasonConfidence = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowReasonConfidence.ts', 'utf8',
);
assert.match(reasonConfidence, /MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_DENOMINATOR = 20/u);
assert.match(reasonConfidence, /descriptive-reason-confidence-only/u);
assert.doesNotMatch(reasonConfidence,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const reasonDrift = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowReasonDrift.ts', 'utf8',
);
assert.match(reasonDrift, /descriptive-reason-drift-only/u);
assert.match(reasonDrift, /insufficient-denominator/u);
assert.doesNotMatch(reasonDrift,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const reasonStability = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowReasonStability.ts', 'utf8',
);
assert.match(reasonStability,
  /MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_STABILITY_BATCHES = 3/u);
assert.match(reasonStability, /descriptive-reason-stability-only/u);
assert.doesNotMatch(reasonStability,
  /createStore|localStorage|writeFile|fetch\(|upsertDirectedRelationship|approveDirectedRelationship/iu);
const manualReview = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowManualReviewReadiness.ts', 'utf8',
);
assert.match(manualReview, /manual-calibration-review-readiness-only/u);
assert.doesNotMatch(manualReview,
  /createStore|localStorage|writeFile|fetch\(|setItem|thresholds?:|upsertDirectedRelationship|approveDirectedRelationship/iu);
const manualPacket = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowManualReviewPacket.ts', 'utf8',
);
assert.match(manualPacket, /anonymous-manual-calibration-review-only/u);
assert.match(manualPacket, /automaticThresholdApplication: false/u);
assert.match(manualPacket, /automaticThresholdRecommendation: false/u);
assert.doesNotMatch(manualPacket,
  /createStore|localStorage|writeFile|fetch\(|setItem|upsertDirectedRelationship|approveDirectedRelationship/iu);
const manualDecision = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowManualReviewDecision.ts', 'utf8',
);
assert.match(manualDecision, /relationship-evidence-shadow-manual-review-decision/u);
assert.match(manualDecision, /accept-not-eligible/u);
assert.doesNotMatch(manualDecision,
  /createStore|localStorage|writeFile|fetch\(|setItem|upsertDirectedRelationship|approveDirectedRelationship/iu);
const manualReceipt = fs.readFileSync(
  'src/social-trend/relationshipEvidenceShadowManualReviewReceipt.ts', 'utf8',
);
assert.match(manualReceipt, /validated-manual-review-receipt-only/u);
assert.match(manualReceipt, /executable: false/u);
assert.match(manualReceipt, /persisted: false/u);
assert.doesNotMatch(manualReceipt,
  /createStore|localStorage|writeFile|fetch\(|setItem|upsertDirectedRelationship|approveDirectedRelationship/iu);
const decisionUi = fs.readFileSync(
  'src/components/settings/SettingsRelationshipEvidenceShadowManualReviewDecision.tsx', 'utf8',
);
assert.match(decisionUi,
  /result\?\.decision \? <SettingsRelationshipEvidenceShadowManualReviewReceiptButton/u);
const batchUi = fs.readFileSync(
  'src/components/settings/SettingsRelationshipEvidenceShadowBatchReport.tsx', 'utf8',
);
assert.match(batchUi, /导出不含原始样本和批次ID/u);
const panel = fs.readFileSync(
  'src/components/settings/SettingsRelationshipEvidenceWindowPanel.tsx', 'utf8',
);
assert.match(panel, /<SettingsRelationshipEvidenceShadowCorpusPreview/u);
console.log('relationship evidence shadow architecture smoke ok');
