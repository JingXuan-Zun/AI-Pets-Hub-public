import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const MAX_FILE_LINES = 300;
const MAX_FUNCTION_LINES = 50;
const files = [
  'src/group-memory/groupMemoryTypes.ts',
  'src/group-memory/groupMemoryAutoWriteReadiness.ts',
  'src/group-memory/groupMemoryAutoWriteReadinessExport.ts',
  'src/group-memory/groupMemoryAutoWriteReadinessComparison.ts',
  'src/group-memory/groupMemoryReadinessComparisonExport.ts',
  'src/group-memory/groupMemoryReadinessReviewReceipt.ts',
  'src/group-memory/groupMemoryReadinessReviewReceiptImport.ts',
  'src/group-memory/groupMemoryReadinessReviewHistory.ts',
  'src/group-memory/groupMemoryReadinessReviewHistoryExport.ts',
  'src/group-memory/groupMemoryReadinessReviewHistoryExportImport.ts',
  'src/group-memory/groupMemoryReadinessReviewTrendExport.ts',
  'src/group-memory/groupMemoryReadinessReviewTrendImport.ts',
  'src/group-memory/groupMemoryReadinessReviewTrendApproval.ts',
  'src/group-memory/groupMemoryReadinessReviewTrendApprovalImport.ts',
  'src/group-memory/groupMemoryReadinessReviewTrendApprovalHistory.ts',
  'src/group-memory/groupMemoryReadinessReviewTrendApprovalHistoryExport.ts',
  'src/group-memory/groupMemoryReadinessApprovalHistoryExportImport.ts',
  'src/group-memory/groupMemoryReadinessManualReleaseReview.ts',
  'src/group-memory/groupMemoryReadinessManualReleaseReviewImport.ts',
  'src/group-memory/groupMemoryEvidenceScope.ts',
  'src/group-memory/groupMemoryEvidenceScopeCorrection.ts',
  'src/group-memory/groupMemoryCandidateArchive.ts',
  'src/group-memory/groupMemoryCandidateNormalization.ts',
  'src/group-memory/groupMemoryCandidateScreening.ts',
  'src/group-memory/groupMemoryCandidateShadowEvaluation.ts',
  'src/group-memory/groupMemoryShadowCorpusImport.ts',
  'src/group-memory/groupMemoryShadowCorpusTemplate.ts',
  'src/group-memory/groupMemorySubgroups.ts',
  'src/group-memory/groupMemoryConflictDetection.ts',
  'src/group-memory/groupMemoryCandidates.ts',
  'src/group-memory/groupMemoryIntegrity.ts',
  'src/group-memory/groupMemoryRepository.ts',
  'src/group-memory/groupMemoryOperations.ts',
  'src/group-memory/groupMemoryNormalizationUtils.ts',
  'src/group-memory/groupMemoryReceiptArchive.ts',
  'src/components/settings/SettingsGroupMemorySection.tsx',
  'src/components/settings/SettingsGroupMemoryAutoWriteReadiness.tsx',
  'src/components/settings/SettingsGroupMemoryRollbackDrillChecklist.tsx',
  'src/components/settings/SettingsGroupMemoryReadinessComparison.tsx',
  'src/components/settings/groupMemoryReadinessComparisonDownload.ts',
  'src/components/settings/SettingsGroupMemoryReadinessReview.tsx',
  'src/components/settings/groupMemoryReadinessReviewReceiptDownload.ts',
  'src/components/settings/SettingsGroupMemoryReadinessReviewImport.tsx',
  'src/components/settings/SettingsGroupMemoryReadinessReviewWorkspace.tsx',
  'src/components/settings/useSettingsGroupMemoryReadinessReviewImport.ts',
  'src/components/settings/SettingsGroupMemoryReadinessReviewHistory.tsx',
  'src/components/settings/useSettingsGroupMemoryReadinessReviewHistory.ts',
  'src/components/settings/groupMemoryReadinessReviewHistoryDownload.ts',
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrend.tsx',
  'src/components/settings/useSettingsGroupMemoryReadinessReviewTrend.ts',
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendChecklist.tsx',
  'src/components/settings/groupMemoryReadinessReviewTrendDownload.ts',
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendApproval.tsx',
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendApprovalForm.tsx',
  'src/components/settings/useSettingsGroupMemoryReadinessReviewTrendApproval.ts',
  'src/components/settings/groupMemoryReadinessReviewTrendApprovalDownload.ts',
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendApprovalHistory.tsx',
  'src/components/settings/useSettingsGroupMemoryReadinessReviewTrendApprovalHistory.ts',
  'src/components/settings/groupMemoryReadinessApprovalHistoryDownload.ts',
  'src/components/settings/SettingsGroupMemoryReadinessApprovalReleaseChecklist.tsx',
  'src/components/settings/SettingsGroupMemoryReadinessManualReleaseReview.tsx',
  'src/components/settings/SettingsGroupMemoryReadinessManualReleaseReviewForm.tsx',
  'src/components/settings/useSettingsGroupMemoryReadinessManualReleaseReview.ts',
  'src/components/settings/groupMemoryReadinessManualReleaseReviewDownload.ts',
  'src/components/settings/groupMemoryAutoWriteReadinessDownload.ts',
  'src/components/settings/useSettingsGroupMemoryReadinessComparison.ts',
  'src/components/settings/SettingsGroupMemoryEvidenceScopePanel.tsx',
  'src/components/settings/SettingsGroupMemoryCard.tsx',
  'src/components/settings/SettingsGroupMemorySubgroupPanel.tsx',
  'src/components/settings/SettingsSmallGroupCandidatePanel.tsx',
  'src/components/settings/SettingsGroupMemoryCandidateInbox.tsx',
  'src/components/settings/SettingsGroupMemoryConflictPanel.tsx',
  'src/components/settings/SettingsGroupMemoryHistory.tsx',
  'src/components/settings/SettingsGroupMemoryReviewPanel.tsx',
  'src/components/settings/SettingsGroupMemoryShadowCorpusPreview.tsx',
  'src/components/settings/SettingsGroupMemoryShadowCorpusGuide.tsx',
  'src/components/settings/useSettingsGroupMemoryManagement.ts',
  'src/components/settings/useSettingsGroupMemoryCandidateManagement.ts',
  'src/components/settings/useSettingsGroupMemoryShadowCorpusPreview.ts',
  'src/components/settings/groupMemoryShadowCorpusTemplateDownload.ts',
  'src/components/chat/group/memory/groupMemoryCandidate.ts',
  'src/components/chat/group/memory/GroupMemoryCandidateSaveButton.tsx',
  'src/components/chat/group/memory/groupMemoryRecord.ts',
  'src/components/chat/group/memory/groupMemoryGraphAdapter.ts',
  'src/components/chat/group/memory/groupRoleRuntimeSnapshot.ts',
  'src/components/chat/group/memory/groupTaskMemoryCandidate.ts',
  'src/components/chat/group/memory/GroupTaskMemoryCandidatePrompt.tsx',
  'src/components/chat/group/memory/useGroupTaskMemoryCandidateCapture.ts',
  'src/components/chat/group/memory/GroupMemorySaveButton.tsx',
  'src/components/chat/chatMemorySaveUtils.ts',
];

function line(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectFunctions(source: ts.SourceFile) {
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(source, node.body.end) - line(source, node.getStart(source)) + 1;
      assert.ok(size <= MAX_FUNCTION_LINES, `${source.fileName} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

for (const relativePath of files) {
  const sourceText = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(sourceText.split(/\r?\n/u).length <= MAX_FILE_LINES, `${relativePath} is too large`);
  const source = ts.createSourceFile(
    relativePath, sourceText, ts.ScriptTarget.Latest, true,
    relativePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  inspectFunctions(source);
  assert.doesNotMatch(sourceText, /GroupChatRuntimeV[23]|createStore|new GroupChatRuntime/u);
}

const snapshotSource = fs.readFileSync(
  path.resolve('src/components/chat/group/memory/groupRoleRuntimeSnapshot.ts'),
  'utf8',
);
assert.doesNotMatch(snapshotSource, /privateMemory(?:Summary|Content):\s*string/u);
assert.match(snapshotSource, /hasPrivateMemory:\s*boolean/u);

const saveSource = fs.readFileSync('src/components/chat/chatMemorySaveUtils.ts', 'utf8');
assert.match(saveSource, /upsertGroupMemoryRecord/u);
assert.match(saveSource, /enqueueGroupMemoryCandidate/u);
assert.match(saveSource, /groupId\?: string/u);
assert.match(saveSource, /appendGroupMemoryEvidenceScopeSnapshot/u);
assert.doesNotMatch(saveSource, /getDesktopPetSlots\(config\)[\s\S]*groupMemory/u);
const repositorySource = fs.readFileSync('src/group-memory/groupMemoryRepository.ts', 'utf8');
assert.match(repositorySource, /existing\.groupId !== record\.groupId/u);

const normalizationSource = fs.readFileSync('src/petConfigNormalization.ts', 'utf8');
assert.match(normalizationSource, /normalizeGroupMemoryRepository/u);
assert.match(normalizationSource, /stripLegacyGroupMemory/u);
const promptSource = fs.readFileSync('src/services/geminiPromptService.ts', 'utf8');
assert.match(promptSource, /stripLegacyGroupMemory\(personality\.chatHistoryMemory\)/u);
const graphAdapterSource = fs.readFileSync(
  'src/components/chat/group/memory/groupMemoryGraphAdapter.ts', 'utf8',
);
assert.doesNotMatch(graphAdapterSource, /candidates|candidateReviewReceipts/u);
assert.match(graphAdapterSource, /getReadableGroupMemoryGroupIds/u);
const subgroupSource = fs.readFileSync('src/group-memory/groupMemorySubgroups.ts', 'utf8');
assert.match(subgroupSource, /memberRoleIds/u);
assert.match(subgroupSource, /subgroupAuditTrail/u);
assert.match(subgroupSource, /getWritableGroupMemoryGroupOptions/u);
assert.doesNotMatch(subgroupSource, /gemini|openai|AgentRuntime|new GroupChatRuntime/iu);
const smallGroupCandidatePanelSource = fs.readFileSync(
  'src/components/settings/SettingsSmallGroupCandidatePanel.tsx', 'utf8',
);
assert.match(smallGroupCandidatePanelSource, /不会自动建组或扩大记忆权限/u);
assert.doesNotMatch(smallGroupCandidatePanelSource,
  /createGroupMemorySubgroup|onChange|onApplyConfig|onUpdateConfig|AgentRuntime/u);
const scopeSource = fs.readFileSync('src/group-memory/groupMemoryEvidenceScope.ts', 'utf8');
assert.match(scopeSource, /MAX_GROUP_MEMORY_EVIDENCE_SCOPE_SNAPSHOTS = 300/u);
assert.doesNotMatch(scopeSource, /gemini|openai|AgentRuntime|GroupChatRuntime/iu);
const correctionSource = fs.readFileSync(
  'src/group-memory/groupMemoryEvidenceScopeCorrection.ts', 'utf8',
);
assert.match(correctionSource, /MAX_GROUP_MEMORY_EVIDENCE_SCOPE_CORRECTIONS = 300/u);
assert.match(correctionSource, /supersedesCorrectionId/u);
assert.doesNotMatch(correctionSource, /gemini|openai|AgentRuntime|GroupChatRuntime/iu);

const managementSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemorySection.tsx',
  'utf8',
);
assert.match(managementSource, /useSettingsGroupMemoryManagement/u);
assert.match(managementSource, /SettingsGroupMemoryShadowCorpusPreview/u);
assert.match(managementSource, /SettingsGroupMemorySubgroupPanel/u);
assert.match(managementSource, /自动长期写入当前关闭/u);
assert.doesNotMatch(managementSource, /createStore|GroupChatRuntime|neuron/iu);
const scopePanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryEvidenceScopePanel.tsx', 'utf8',
);
assert.match(scopePanelSource, /不覆盖原快照、不迁移正式记忆/u);
assert.match(scopePanelSource, /appendGroupMemoryEvidenceScopeCorrection/u);
assert.doesNotMatch(scopePanelSource, /gemini|openai|AgentRuntime|GroupChatRuntime|neuron/iu);
const shadowPreviewSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryShadowCorpusPreview.tsx', 'utf8',
);
assert.match(shadowPreviewSource, /只读、不保存/u);
assert.match(shadowPreviewSource, /downloadGroupMemoryShadowCorpusTemplate/u);
assert.doesNotMatch(
  shadowPreviewSource,
  /localStorage|fetch\(|enqueueGroupMemoryCandidate|onUpdateConfig|onApplyConfig/iu,
);
assert.match(shadowPreviewSource, /SettingsGroupMemoryAutoWriteReadiness/u);
const templateDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryShadowCorpusTemplateDownload.ts', 'utf8',
);
assert.match(templateDownloadSource, /URL\.createObjectURL/u);
assert.match(templateDownloadSource, /URL\.revokeObjectURL/u);
assert.doesNotMatch(
  templateDownloadSource,
  /fetch\(|groupMemoryRepository|chatHistory|localStorage|AgentRuntime/iu,
);
const shadowPreviewHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryShadowCorpusPreview.ts', 'utf8',
);
assert.match(shadowPreviewHookSource, /file\.size > MAX_GROUP_MEMORY_SHADOW_CORPUS_FILE_BYTES/u);
assert.match(shadowPreviewHookSource, /visibilitychange/u);
assert.match(shadowPreviewHookSource, /pagehide/u);
assert.doesNotMatch(
  shadowPreviewHookSource,
  /onChange|groupMemoryRepository|localStorage|writeFile|fetch\(|enqueueGroupMemoryCandidate/iu,
);

const operationSource = fs.readFileSync('src/group-memory/groupMemoryOperations.ts', 'utf8');
assert.match(operationSource, /invalidateGroupMemoryRecord/u);
assert.match(operationSource, /resolveGroupMemoryConflict/u);
assert.match(operationSource, /moveGroupMemoryRecordToGroup/u);
assert.match(operationSource, /rollbackGroupMemoryOperation/u);
assert.doesNotMatch(operationSource, /splice|records\.filter/u);

const cardSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryCard.tsx',
  'utf8',
);
assert.match(cardSource, /稳定 ID/u);
assert.match(cardSource, /记忆组/u);
assert.match(cardSource, /替代记录/u);
const conflictSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryConflictPanel.tsx',
  'utf8',
);
assert.match(conflictSource, /系统不会自动裁决/u);
assert.doesNotMatch(conflictSource, /gemini|openai|generateContent|AgentRuntime/iu);
const reviewSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReviewPanel.tsx',
  'utf8',
);
assert.match(reviewSource, /不会自动修改、失效或合并/u);
assert.doesNotMatch(reviewSource, /gemini|openai|generateContent|AgentRuntime/iu);
const archiveSource = fs.readFileSync(
  'src/group-memory/groupMemoryReceiptArchive.ts',
  'utf8',
);
assert.match(archiveSource, /MAX_ACTIVE_GROUP_MEMORY_RECEIPTS = 50/u);
const candidateInboxSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryCandidateInbox.tsx', 'utf8',
);
assert.match(candidateInboxSource, /只有用户点击“批准写入”后/u);
assert.match(candidateInboxSource, /候选写入目标组/u);
assert.doesNotMatch(candidateInboxSource, /gemini|openai|generateContent|AgentRuntime/iu);
const messageBubbleSource = fs.readFileSync(
  'src/components/chat/PetChatConversationMessageBubble.tsx', 'utf8',
);
assert.match(messageBubbleSource, /saveMessageToMemory\('groupMemoryCandidate'\)/u);
assert.match(messageBubbleSource, /saveMessageToMemory\('groupMemory', groupId\)/u);
const candidateFactorySource = fs.readFileSync(
  'src/components/chat/group/memory/groupMemoryCandidate.ts', 'utf8',
);
assert.match(candidateFactorySource, /groupTaskEvent\.factualSummary/u);
const automaticCandidateSource = fs.readFileSync(
  'src/components/chat/group/memory/groupTaskMemoryCandidate.ts', 'utf8',
);
assert.match(automaticCandidateSource, /type !== 'task-completed'/u);
assert.match(automaticCandidateSource, /evaluateGroupMemoryCandidateEvidence/u);
assert.match(automaticCandidateSource, /decision === 'eligible'/u);
assert.match(automaticCandidateSource, /!message\.id/u);
assert.doesNotMatch(
  automaticCandidateSource,
  /approveGroupMemoryCandidate|upsertGroupMemoryRecord|records\s*:/u,
);
const automaticCaptureHookSource = fs.readFileSync(
  'src/components/chat/group/memory/useGroupTaskMemoryCandidateCapture.ts', 'utf8',
);
assert.match(automaticCaptureHookSource, /approveGroupMemoryCandidate/u);
assert.match(automaticCaptureHookSource, /targetGroupId/u);
assert.match(automaticCaptureHookSource, /rejectGroupMemoryCandidate/u);
assert.doesNotMatch(
  automaticCaptureHookSource,
  /gemini|openai|generateContent|AgentRuntime|new GroupChatRuntime/iu,
);
const conversationSource = fs.readFileSync(
  'src/components/chat/PetChatConversation.tsx', 'utf8',
);
assert.match(conversationSource, /useGroupTaskMemoryCandidateCapture/u);
assert.match(conversationSource, /GroupTaskMemoryCandidatePrompt/u);
const taskCandidatePromptSource = fs.readFileSync(
  'src/components/chat/group/memory/GroupTaskMemoryCandidatePrompt.tsx', 'utf8',
);
assert.match(taskCandidatePromptSource, /任务候选写入目标组/u);
assert.doesNotMatch(taskCandidatePromptSource, /gemini|openai|AgentRuntime/iu);
const candidateScreeningSource = fs.readFileSync(
  'src/group-memory/groupMemoryCandidateScreening.ts', 'utf8',
);
assert.match(candidateScreeningSource, /verified-task-result/u);
assert.doesNotMatch(
  candidateScreeningSource,
  /enqueueGroupMemoryCandidate|approveGroupMemoryCandidate|gemini|openai|AgentRuntime/iu,
);
const shadowEvaluationSource = fs.readFileSync(
  'src/group-memory/groupMemoryCandidateShadowEvaluation.ts', 'utf8',
);
const corpusImportSource = fs.readFileSync(
  'src/group-memory/groupMemoryShadowCorpusImport.ts', 'utf8',
);
assert.match(corpusImportSource, /redaction-not-confirmed/u);
assert.doesNotMatch(
  corpusImportSource,
  /localStorage|writeFile|enqueueGroupMemoryCandidate|groupMemoryRepository|AgentRuntime/iu,
);
assert.match(shadowEvaluationSource, /mode: 'shadow'/u);
assert.doesNotMatch(
  shadowEvaluationSource,
  /enqueueGroupMemoryCandidate|approveGroupMemoryCandidate|groupMemoryRepository|gemini|openai|AgentRuntime/iu,
);
const autoWriteReadinessSource = fs.readFileSync(
  'src/group-memory/groupMemoryAutoWriteReadiness.ts', 'utf8',
);
assert.match(autoWriteReadinessSource, /automaticWriteEnabled: false/u);
assert.match(autoWriteReadinessSource, /validateGroupMemoryIntegrity/u);
assert.match(autoWriteReadinessSource, /detectGroupMemoryConflictCandidates/u);
assert.doesNotMatch(autoWriteReadinessSource,
  /upsert|approveGroupMemoryCandidate|enqueueGroupMemoryCandidate|gemini|openai|AgentRuntime/iu);
const autoWriteReadinessPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryAutoWriteReadiness.tsx', 'utf8',
);
assert.match(autoWriteReadinessPanelSource, /不检查、不限制用户聊天内容/u);
assert.match(autoWriteReadinessPanelSource, /自动正式写入仍保持关闭/u);
assert.doesNotMatch(autoWriteReadinessPanelSource,
  /onChange|onUpdateConfig|onApplyConfig|gemini|openai|AgentRuntime/iu);
const readinessExportSource = fs.readFileSync(
  'src/group-memory/groupMemoryAutoWriteReadinessExport.ts', 'utf8',
);
assert.match(readinessExportSource, /containsChatContent: false/u);
assert.match(readinessExportSource, /containsMessageOrRoleIds: false/u);
assert.doesNotMatch(readinessExportSource,
  /repository|summary|sourceMessageId|sourceRoleId|localStorage|fetch\(|writeFile/iu);
const readinessDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryAutoWriteReadinessDownload.ts', 'utf8',
);
assert.match(readinessDownloadSource, /URL\.createObjectURL/u);
assert.match(readinessDownloadSource, /URL\.revokeObjectURL/u);
assert.doesNotMatch(readinessDownloadSource,
  /repository|localStorage|fetch\(|writeFile|chatHistory/iu);
const drillChecklistSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryRollbackDrillChecklist.tsx', 'utf8',
);
assert.match(drillChecklistSource, /清单不会自行执行任何操作/u);
assert.match(drillChecklistSource, /纠正了／后来被纠正/u);
assert.doesNotMatch(drillChecklistSource,
  /onChange|onUpdateConfig|onApplyConfig|approveGroupMemoryCandidate|rollbackGroupMemory/iu);
const readinessComparisonSource = fs.readFileSync(
  'src/group-memory/groupMemoryAutoWriteReadinessComparison.ts', 'utf8',
);
assert.match(readinessComparisonSource, /MIN_GROUP_MEMORY_READINESS_REPORTS = 3/u);
assert.match(readinessComparisonSource, /user-attested-not-verifiable/u);
assert.doesNotMatch(readinessComparisonSource,
  /sourceMessageId|sourceRoleId|summary|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const readinessComparisonPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessComparison.tsx', 'utf8',
);
assert.match(readinessComparisonPanelSource, /批次独立性必须由测试人员人工确认/u);
assert.match(readinessComparisonPanelSource, /不会开启自动正式写入/u);
assert.match(readinessComparisonPanelSource, /程序未验证/u);
assert.match(readinessComparisonPanelSource, /downloadGroupMemoryReadinessComparison/u);
assert.doesNotMatch(readinessComparisonPanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessComparisonHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryReadinessComparison.ts', 'utf8',
);
assert.match(readinessComparisonHookSource, /visibilitychange/u);
assert.match(readinessComparisonHookSource, /pagehide/u);
assert.doesNotMatch(readinessComparisonHookSource,
  /localStorage|fetch\(|writeFile|onUpdateConfig|onApplyConfig|AgentRuntime/iu);
const readinessComparisonExportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessComparisonExport.ts', 'utf8',
);
assert.match(readinessComparisonExportSource, /programmaticallyVerified: false/u);
assert.match(readinessComparisonExportSource, /containsFileNamesOrLocalPaths: false/u);
assert.doesNotMatch(readinessComparisonExportSource,
  /sourceMessageId|sourceRoleId|summary|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const readinessComparisonDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryReadinessComparisonDownload.ts', 'utf8',
);
assert.doesNotMatch(readinessComparisonDownloadSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewReceipt.ts', 'utf8',
);
assert.match(readinessReviewSource, /automaticWriteEnabled: false/u);
assert.match(readinessReviewSource, /executable: false/u);
assert.match(readinessReviewSource, /containsReviewerRationale: false/u);
assert.doesNotMatch(readinessReviewSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReview.tsx', 'utf8',
);
assert.match(readinessReviewPanelSource, /不可执行评审凭证/u);
assert.match(readinessReviewPanelSource, /不会自动应用或开启正式写入/u);
assert.doesNotMatch(readinessReviewPanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessReviewImportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewReceiptImport.ts', 'utf8',
);
assert.match(readinessReviewImportSource, /MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS/u);
assert.match(readinessReviewImportSource, /comparison-mismatch/u);
assert.doesNotMatch(readinessReviewImportSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewImportPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReviewImport.tsx', 'utf8',
);
assert.match(readinessReviewImportPanelSource, /不保存、不上传/u);
assert.match(readinessReviewImportPanelSource, /不会执行凭证或修改任何配置/u);
assert.doesNotMatch(readinessReviewImportPanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessReviewImportHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryReadinessReviewImport.ts', 'utf8',
);
assert.match(readinessReviewImportHookSource, /visibilitychange/u);
assert.match(readinessReviewImportHookSource, /pagehide/u);
assert.doesNotMatch(readinessReviewImportHookSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const readinessReviewHistorySource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewHistory.ts', 'utf8',
);
assert.match(readinessReviewHistorySource, /evidence-regression/u);
assert.match(readinessReviewHistorySource, /decision-oscillation/u);
assert.match(readinessReviewHistorySource, /duplicate-reviewed-at/u);
assert.doesNotMatch(readinessReviewHistorySource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewHistoryPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReviewHistory.tsx', 'utf8',
);
assert.match(readinessReviewHistoryPanelSource, /只读、仅内存/u);
assert.match(readinessReviewHistoryPanelSource, /不保存、不执行、不启用写入/u);
assert.doesNotMatch(readinessReviewHistoryPanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessReviewHistoryHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryReadinessReviewHistory.ts', 'utf8',
);
assert.match(readinessReviewHistoryHookSource, /visibilitychange/u);
assert.match(readinessReviewHistoryHookSource, /pagehide/u);
assert.doesNotMatch(readinessReviewHistoryHookSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const readinessReviewHistoryExportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewHistoryExport.ts', 'utf8',
);
assert.match(readinessReviewHistoryExportSource, /containsRawReceipts: false/u);
assert.match(readinessReviewHistoryExportSource, /containsReceiptTimestamps: false/u);
assert.match(readinessReviewHistoryExportSource, /automaticWriteEnabled: false/u);
assert.doesNotMatch(readinessReviewHistoryExportSource,
  /latestReviewedAt:|localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewHistoryDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryReadinessReviewHistoryDownload.ts', 'utf8',
);
assert.doesNotMatch(readinessReviewHistoryDownloadSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewTrendSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewHistoryExportImport.ts', 'utf8',
);
assert.match(readinessReviewTrendSource, /user-attested-not-verifiable/u);
assert.match(readinessReviewTrendSource, /regressed-audit-metrics/u);
assert.match(readinessReviewTrendSource, /match-coverage-drift/u);
assert.doesNotMatch(readinessReviewTrendSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewTrendPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrend.tsx', 'utf8',
);
assert.match(readinessReviewTrendPanelSource, /程序无法验证真实版本身份/u);
assert.match(readinessReviewTrendPanelSource, /只读、仅内存，不执行、不启用写入/u);
assert.doesNotMatch(readinessReviewTrendPanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessReviewTrendHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryReadinessReviewTrend.ts', 'utf8',
);
assert.match(readinessReviewTrendHookSource, /visibilitychange/u);
assert.match(readinessReviewTrendHookSource, /pagehide/u);
assert.doesNotMatch(readinessReviewTrendHookSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const readinessReviewTrendExportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewTrendExport.ts', 'utf8',
);
assert.match(readinessReviewTrendExportSource, /ready-for-manual-version-review/u);
assert.match(readinessReviewTrendExportSource, /programmaticallyVerifiedVersionIdentity: false/u);
assert.match(readinessReviewTrendExportSource, /automaticWriteEnabled: false/u);
assert.match(readinessReviewTrendExportSource, /reviewOnly: true/u);
assert.doesNotMatch(readinessReviewTrendExportSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewTrendChecklistSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendChecklist.tsx', 'utf8',
);
assert.match(readinessReviewTrendChecklistSource, /不是启用许可/u);
assert.match(readinessReviewTrendChecklistSource, /不会开启自动长期写入/u);
assert.doesNotMatch(readinessReviewTrendChecklistSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessReviewTrendDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryReadinessReviewTrendDownload.ts', 'utf8',
);
assert.doesNotMatch(readinessReviewTrendDownloadSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewTrendImportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewTrendImport.ts', 'utf8',
);
assert.match(readinessReviewTrendImportSource, /JSON\.stringify\(value\.checklist\)/u);
assert.match(readinessReviewTrendImportSource, /expired-report/u);
assert.doesNotMatch(readinessReviewTrendImportSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewTrendApprovalSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewTrendApproval.ts', 'utf8',
);
assert.match(readinessReviewTrendApprovalSource, /automaticWriteEnabled: false/u);
assert.match(readinessReviewTrendApprovalSource, /executable: false/u);
assert.doesNotMatch(readinessReviewTrendApprovalSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const readinessReviewTrendApprovalPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendApproval.tsx', 'utf8',
);
assert.match(readinessReviewTrendApprovalPanelSource, /不是密码学真实性证明/u);
assert.match(readinessReviewTrendApprovalPanelSource, /仅内存，不保存、不执行/u);
assert.doesNotMatch(readinessReviewTrendApprovalPanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessReviewTrendApprovalFormSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendApprovalForm.tsx', 'utf8',
);
assert.match(readinessReviewTrendApprovalFormSource, /回执不可执行/u);
assert.match(readinessReviewTrendApprovalFormSource, /不会自动应用或开启正式写入/u);
assert.doesNotMatch(readinessReviewTrendApprovalFormSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const readinessReviewTrendApprovalHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryReadinessReviewTrendApproval.ts', 'utf8',
);
assert.match(readinessReviewTrendApprovalHookSource, /visibilitychange/u);
assert.match(readinessReviewTrendApprovalHookSource, /pagehide/u);
assert.doesNotMatch(readinessReviewTrendApprovalHookSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const readinessReviewTrendApprovalDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryReadinessReviewTrendApprovalDownload.ts', 'utf8',
);
assert.doesNotMatch(readinessReviewTrendApprovalDownloadSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const trendApprovalImportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewTrendApprovalImport.ts', 'utf8',
);
assert.match(trendApprovalImportSource, /acceptedSourceIsReady/u);
assert.match(trendApprovalImportSource, /automaticWriteEnabled/u);
assert.doesNotMatch(trendApprovalImportSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const trendApprovalHistorySource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewTrendApprovalHistory.ts', 'utf8',
);
assert.match(trendApprovalHistorySource, /source-report-regression/u);
assert.match(trendApprovalHistorySource, /duplicate-source-report/u);
assert.match(trendApprovalHistorySource, /decision-oscillation/u);
assert.doesNotMatch(trendApprovalHistorySource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const trendApprovalHistoryPanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessReviewTrendApprovalHistory.tsx', 'utf8',
);
assert.match(trendApprovalHistoryPanelSource, /只读、仅内存，不保存、不执行、不启用写入/u);
assert.doesNotMatch(trendApprovalHistoryPanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|AgentRuntime/iu);
const trendApprovalHistoryHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryReadinessReviewTrendApprovalHistory.ts', 'utf8',
);
assert.match(trendApprovalHistoryHookSource, /visibilitychange/u);
assert.match(trendApprovalHistoryHookSource, /pagehide/u);
assert.doesNotMatch(trendApprovalHistoryHookSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const trendApprovalHistoryExportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessReviewTrendApprovalHistoryExport.ts', 'utf8',
);
assert.match(trendApprovalHistoryExportSource, /ready-for-manual-release-review/u);
assert.match(trendApprovalHistoryExportSource, /automaticWriteEnabled: false/u);
assert.match(trendApprovalHistoryExportSource, /releaseReviewOnly: true/u);
assert.doesNotMatch(trendApprovalHistoryExportSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const approvalHistoryDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryReadinessApprovalHistoryDownload.ts', 'utf8',
);
assert.doesNotMatch(approvalHistoryDownloadSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const approvalReleaseChecklistSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessApprovalReleaseChecklist.tsx', 'utf8',
);
assert.match(approvalReleaseChecklistSource, /不会自动启用任何功能/u);
assert.match(approvalReleaseChecklistSource, /自动长期写入继续关闭/u);
assert.doesNotMatch(approvalReleaseChecklistSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const approvalHistoryImportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessApprovalHistoryExportImport.ts', 'utf8',
);
assert.match(approvalHistoryImportSource, /internallyConsistent/u);
assert.match(approvalHistoryImportSource, /expired-report/u);
assert.doesNotMatch(approvalHistoryImportSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const manualReleaseReviewSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessManualReleaseReview.ts', 'utf8',
);
assert.match(manualReleaseReviewSource, /accept-for-manual-configuration-review/u);
assert.match(manualReleaseReviewSource, /automaticWriteEnabled: false/u);
assert.match(manualReleaseReviewSource, /configurationApplied: false/u);
assert.match(manualReleaseReviewSource, /configurationReviewOnly: true/u);
assert.match(manualReleaseReviewSource, /executable: false/u);
assert.doesNotMatch(manualReleaseReviewSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const manualReleaseImportSource = fs.readFileSync(
  'src/group-memory/groupMemoryReadinessManualReleaseReviewImport.ts', 'utf8',
);
assert.match(manualReleaseImportSource, /acceptedSourceIsReady/u);
assert.doesNotMatch(manualReleaseImportSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
const manualReleasePanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessManualReleaseReview.tsx', 'utf8',
);
assert.match(manualReleasePanelSource, /不应用配置、不启用写入/u);
assert.doesNotMatch(manualReleasePanelSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const manualReleaseFormSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryReadinessManualReleaseReviewForm.tsx', 'utf8',
);
assert.match(manualReleaseFormSource, /不会自动应用配置或启用长期写入/u);
assert.doesNotMatch(manualReleaseFormSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const manualReleaseHookSource = fs.readFileSync(
  'src/components/settings/useSettingsGroupMemoryReadinessManualReleaseReview.ts', 'utf8',
);
assert.match(manualReleaseHookSource, /visibilitychange/u);
assert.match(manualReleaseHookSource, /pagehide/u);
assert.doesNotMatch(manualReleaseHookSource,
  /onUpdateConfig|onApplyConfig|localStorage|fetch\(|writeFile|AgentRuntime/iu);
const manualReleaseDownloadSource = fs.readFileSync(
  'src/components/settings/groupMemoryReadinessManualReleaseReviewDownload.ts', 'utf8',
);
assert.doesNotMatch(manualReleaseDownloadSource,
  /localStorage|fetch\(|writeFile|sourceMessageId|sourceRoleId|AgentRuntime/iu);
for (const runtimePath of [
  'src/components/chat/chatMessageSendRequestExecution.ts',
  'src/components/chat/chatPreparedTargetResponses.ts',
  'src/components/chat/group/orchestration/groupTurnExecution.ts',
]) {
  assert.doesNotMatch(
    fs.readFileSync(runtimePath, 'utf8'),
    /enqueueGroupMemoryCandidate|approveGroupMemoryCandidate|evaluateGroupMemoryCandidateEvidence|createGroupMemoryCandidateShadowObservation|importGroupMemoryShadowCorpus/u,
  );
}

const personalitySource = fs.readFileSync(
  'src/components/settings/SettingsPersonalityTab.tsx',
  'utf8',
);
assert.match(personalitySource, /<SettingsGroupMemorySection/u);
assert.match(personalitySource, /groupMemoryRepository/u);
assert.match(personalitySource, /slots=\{desktopPetSlots\}/u);

console.log('group memory architecture smoke ok');
