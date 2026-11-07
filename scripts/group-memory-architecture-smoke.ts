import { readChatMessageSource } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const MAX_FILE_LINES = 300;
const MAX_FUNCTION_LINES = 50;
const files = [
  'src/group-memory/groupMemoryTypes.ts',
  'src/group-memory/groupMemoryEvidenceScope.ts',
  'src/group-memory/groupMemoryEvidenceScopeCorrection.ts',
  'src/group-memory/groupMemoryCandidateArchive.ts',
  'src/group-memory/groupMemoryCandidateNormalization.ts',
  'src/group-memory/groupMemoryCandidateScreening.ts',
  'src/group-memory/groupMemorySubgroups.ts',
  'src/group-memory/groupMemoryConflictDetection.ts',
  'src/group-memory/groupMemoryCandidates.ts',
  'src/group-memory/groupMemoryIntegrity.ts',
  'src/group-memory/groupMemoryRepository.ts',
  'src/group-memory/groupMemoryOperations.ts',
  'src/group-memory/groupMemoryNormalizationUtils.ts',
  'src/group-memory/groupMemoryReceiptArchive.ts',
  'src/components/settings/SettingsGroupMemorySection.tsx',
  'src/components/settings/SettingsGroupMemoryEvidenceScopePanel.tsx',
  'src/components/settings/SettingsGroupMemoryCard.tsx',
  'src/components/settings/SettingsGroupMemorySubgroupPanel.tsx',
  'src/components/settings/SettingsGroupMemoryCandidateInbox.tsx',
  'src/components/settings/SettingsGroupMemoryConflictPanel.tsx',
  'src/components/settings/SettingsGroupMemoryHistory.tsx',
  'src/components/settings/SettingsGroupMemoryReviewPanel.tsx',
  'src/components/settings/useSettingsGroupMemoryManagement.ts',
  'src/components/settings/useSettingsGroupMemoryCandidateManagement.ts',
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
// The auto-write readiness / shadow corpus rollout was removed on 2026-11-06 (docs/removed-features-log.md).
assert.doesNotMatch(managementSource, /ShadowCorpus|AutoWriteReadiness/u);
assert.match(managementSource, /SettingsGroupMemorySubgroupPanel/u);
assert.match(managementSource, /自动长期写入当前关闭/u);
assert.doesNotMatch(managementSource, /createStore|GroupChatRuntime|neuron/iu);
const scopePanelSource = fs.readFileSync(
  'src/components/settings/SettingsGroupMemoryEvidenceScopePanel.tsx', 'utf8',
);
assert.match(scopePanelSource, /不覆盖原快照、不迁移正式记忆/u);
assert.match(scopePanelSource, /appendGroupMemoryEvidenceScopeCorrection/u);
assert.doesNotMatch(scopePanelSource, /gemini|openai|AgentRuntime|GroupChatRuntime|neuron/iu);
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
const messageBubbleSource = readChatMessageSource();
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
