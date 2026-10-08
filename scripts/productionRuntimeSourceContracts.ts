import assert from 'node:assert/strict';
import { readModuleProjectFile, readModuleProjectFunction } from './projectModuleSource.mjs';

// Production contracts after legacy Runtime retirement. Historical V3 diagnostic
// tests may still exercise legacy exports, but must never require UI routing
// or automatic fallback back into those isolated implementations.
export function assertProductionRuntimeSourceContracts() {
  const controllerSource = readModuleProjectFile('src/components/chat/agentRunController.ts');
  const preparedRun = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
  const approvalRun = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
  const boundarySource = readModuleProjectFile('src/agent/agentProductionSession.ts');
  const productionRun = readModuleProjectFunction('src/agent/agentProductionSession.ts', 'runAgentProductionRuntime');
  const approvedRun = readModuleProjectFunction('src/agent/agentProductionSession.ts', 'runAgentProductionApprovedAction');
  const progressFactory = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createAgentRunProgressHandler');
  const preparedDispatch = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentRuntimeStage');
  const approvedDispatch = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runApprovedAgentRuntimeStage');
  const approvedCallbacks = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createApprovedAgentRuntimeCallbacks');
  assert.match(preparedRun, /await runPreparedAgentRuntimeStage\(\{/u);
  assert.match(preparedRun, /approvedToolResult,[\s\S]*signal: abortController\.signal/u);
  assert.match(preparedDispatch, /return runAgentProductionRuntime\(\{[\s\S]*approvedToolResult,[\s\S]*cancellationSignal: signal/u);
  assert.match(preparedRun, /const isCancelled = createInitialAgentRunCancellationGuard\(\{ abortController, preparedRequest, activeChatRequestTokenRef, messageId: runMessageId \}\)/u);
  assert.match(preparedRun, /if \(isInitialAgentRequestStale\(\{ preparedRequest, activeChatRequestTokenRef, messageId: runMessageId \}\)\)/u);
  const initialGuard = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createInitialAgentRunCancellationGuard');
  assert.match(initialGuard, /return \(\) => \(\s*abortController\.signal\.aborted\s*\|\| preparedRequest\.requestToken !== activeChatRequestTokenRef\.current\s*\|\| isStoppedAgentRunMessage\(messageId\)/u);
  const initialStale = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'isInitialAgentRequestStale');
  assert.match(initialStale, /return preparedRequest\.requestToken !== activeChatRequestTokenRef\.current \|\| isStoppedAgentRunMessage\(messageId\)/u);
  assert.doesNotMatch(initialStale, /abortController|signal/u);
  assert.match(preparedRun, /createAgentRunProgressHandler\(\{ isCancelled, messageId: runMessageId \}\)/u);
  assert.match(approvalRun, /await runApprovedAgentRuntimeStage\(\{/u);
  assert.match(approvalRun, /canonicalEventJournal, approval, approvalRuntime, signal: abortController\.signal/u);
  assert.match(approvedDispatch, /return runAgentProductionApprovedAction\(\{[\s\S]*cancellationSignal: signal,[\s\S]*continuation: approvalRuntime/u);
  assert.match(approvalRun, /const isCancelled = createApprovedAgentRunCancellationGuard\(\{ abortController, requestToken, activeChatRequestTokenRef, messageId \}\)/u);
  assert.equal((approvalRun.match(/if \(isApprovedAgentRequestCancelled\(\{ abortController, requestToken, activeChatRequestTokenRef, messageId \}\)\)/gu) ?? []).length, 3);
  const approvedGuard = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createApprovedAgentRunCancellationGuard');
  assert.match(approvedGuard, /return \(\) => isApprovedAgentRequestCancelled\(\{ abortController, requestToken, activeChatRequestTokenRef, messageId \}\)/u);
  const approvedCancelled = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'isApprovedAgentRequestCancelled');
  assert.match(approvedCancelled, /return abortController\.signal\.aborted \|\| requestToken !== activeChatRequestTokenRef\.current \|\| isStoppedAgentRunMessage\(messageId\)/u);
  assert.match(approvalRun, /createApprovedAgentRuntimeCallbacks\(\{\s*approval, canonicalEventJournal, signal: abortController\.signal, executor: onAgentChatCommand,\s*messageId, missingExecutorResult, isCancelled, configRef,/u);
  assert.match(approvedCallbacks, /createAgentRunProgressHandler\(\{ isCancelled, messageId: messageId \}\)/u);
  assert.match(progressFactory, /if \(isCancelled\(\)\) return;[\s\S]*publishAgentRuntimeWorldProgress\(event\);[\s\S]*updateAgentProductionSessionProgressMessage\(messageId, event\)/u);
  assert.match(approvedRun, /runAgentApprovedActionLifecycle\(\{/u);
  assert.match(approvedRun, /runAgentProductionRuntime\(\{/u);
  assert.match(productionRun, /runAgentProductionSessionImplementation\(\{/u);
  assert.match(productionRun, /authorizeModelIteration: runtimeContext\.authorizeModelIteration/u);
  assert.match(productionRun, /authorizeRecovery: runtimeContext\.authorizeRecovery/u);
  assert.match(productionRun, /runAgentRuntime\(\{/u);
  assert.match(productionRun, /createNativeAgentRuntimeAdapter\(nativeRun\)/u);
  for (const file of ['src/constants.ts', 'src/petConfigNormalization.ts', 'src/components/chat/petChatMessageSenderTypes.ts',
    'src/components/chat/usePetChatMessageSender.ts', 'src/components/chat/usePetChatSession.ts',
    'src/components/pet/usePetContainerPanelChatState.ts', 'src/components/settings/SettingsSystemTab.tsx']) {
    assert.doesNotMatch(readModuleProjectFile(file), /agentRuntimeMode|runAgentSessionV3Experimental/u, `${file} must not restore legacy runtime selectors`);
  }
  assert.doesNotMatch(controllerSource, /runAgentSessionV2\(|runAgentSessionV3Experimental|createAgentRuntimeLegacyVersionAdapter|runV2:|runV3Experimental:/u);
  return { controllerSource, preparedRun, approvalRun, boundarySource, productionRun, approvedRun };
}
