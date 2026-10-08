import { createApprovedAgentRunCancellationGuard, isApprovedAgentRequestCancelled } from "./requestCancellationGuards";
import { activateApprovedAgentRequest } from "./approvalRequestActivation";
import { getAgentCanonicalEventJournal } from "../../../agent";
import { desktopPetChatStore } from "../../../chatStore";
import { registerAgentRunAbortController } from "../agentRunAbortRegistry";
import { resolveChatAgentRuntimeContinuation } from "../chatAgentRuntimeCompatibility";
import { isAgentTaskRuntimeWaitingApproval } from "../agentRuntimeUiStatusProjection";
import { speakApprovedAgentResultReply } from "./resultReplyStages";
import { publishApprovedAgentRuntimeResult } from "./runtimeResultPublication";
import { runApprovedAgentRuntimeStage } from "./productionRuntimeDispatch";
import { runReadOnlyAgentApprovalContinuations } from "./approvalContinuationDispatch";
import { dispatchApprovedPendingPresentation, dispatchReadOnlyPendingPresentation } from "./pendingPresentationDispatch";
import { createMissingAgentExecutorResult, createApprovedAgentRuntimeCallbacks } from "./approvedRuntimeCallbacks";
import { finalizeChatSendRequest } from "../chatMessageSendUtils";
import { createAgentApprovalPreparedRequest } from "./approvalRequestContext";
import { completeApprovedAgentRuntimeLifecycle } from "./runtimeCompletionStages";
import { presentUnsupportedAgentApproval } from "./approvalEntryPresentation";
import { completeDeniedAgentApproval, completeFailedAgentApproval } from "./approvalTerminalStages";
import { updateAgentApprovalContinuationPresentation } from "./continuationPresentationStages";
import { updateApprovedAgentRunPresentation } from "./resultPresentationStages";
import type { ResolveAgentApprovalRequestOptions } from "./controllerOptions";
import { resolveAgentLoopApproval } from "./agentLoopApprovalRegistry";

export async function resolveAgentApprovalRequest({
  activeChatRequestTokenRef,
  configRef,
  decision,
  getPlaybackToken,
  groupTaskLifecycle,
  groupChatContinuationEnabledRef,
  messageId,
  onAgentChatCommand,
  playVoiceText,
  runPetResponseTurn,
  stopGroupChat,
  stopPetSpeech,
  warmLocalReplyVoice,
}: ResolveAgentApprovalRequestOptions) {
  // Approval cards from the desktop agent loop are answered by the loop itself.
  if (resolveAgentLoopApproval(messageId, decision)) return;
  const approvalMessage = desktopPetChatStore.getState().messages.find((message) => message.id === messageId);
  const approval = approvalMessage?.agentApproval ?? null;

  if (!approval || approval.status !== 'pending') {
    return;
  }

  const approvalRuntime = resolveChatAgentRuntimeContinuation(approval);
  const canonicalEventJournal = getAgentCanonicalEventJournal(messageId);

  if (decision === 'deny') {
    completeDeniedAgentApproval({ canonicalEventJournal, approvalRuntime, approval, approvalMessage, messageId, groupTaskLifecycle });
    return;
  }

  const { currentChatState, targetSlot, requestToken } = activateApprovedAgentRequest({
    activeChatRequestTokenRef, configRef, groupChatContinuationEnabledRef,
    approval, approvalMessage, approvalRuntime, messageId, stopGroupChat, stopPetSpeech,
  });

  const abortController = new AbortController();
  const unregisterAbortController = registerAgentRunAbortController(messageId, abortController);

  try {
    if (!approvalRuntime) {
      presentUnsupportedAgentApproval({ approval, messageId });
      return;
    }

    const preparedRequest = createAgentApprovalPreparedRequest({ currentChatState, configRef, approval, approvalMessage, approvalRuntime, targetSlot, requestToken, getPlaybackToken });
    const missingExecutorResult = createMissingAgentExecutorResult();
    const isCancelled = createApprovedAgentRunCancellationGuard({ abortController, requestToken, activeChatRequestTokenRef, messageId });
    const { onProgress, toolExecutor, consumeTaskScopedApprovedContinuations } = createApprovedAgentRuntimeCallbacks({
      approval, canonicalEventJournal, signal: abortController.signal, executor: onAgentChatCommand,
      messageId, missingExecutorResult, isCancelled, configRef,
    });
    const routedResult = await runApprovedAgentRuntimeStage({
      canonicalEventJournal, approval, approvalRuntime, signal: abortController.signal,
      executor: onAgentChatCommand, messageId, missingExecutorResult, onProgress, targetSlot, configRef, toolExecutor,
    });
    if (!routedResult.result) {
      throw new Error(routedResult.reason);
    }
    let sessionResult = routedResult.result;

    if (isApprovedAgentRequestCancelled({ abortController, requestToken, activeChatRequestTokenRef, messageId })) {
      return;
    }

    const taskScopedApprovedContinuation = await consumeTaskScopedApprovedContinuations(sessionResult, {
      logLabel: 'task-scoped approval continuation executing',
    });
    sessionResult = taskScopedApprovedContinuation.result;
    publishApprovedAgentRuntimeResult({ sessionResult, routedResult, taskScopedApprovedContinuation });

    const { displayResult, pendingReadOnlyFollowUpApproval } = updateApprovedAgentRunPresentation({
      sessionResult, approval, approvalRuntime, approvalMessage, preparedRequest, groupTaskLifecycle, messageId,
    });

    const pendingReadOnlyContinuationRun = pendingReadOnlyFollowUpApproval && onAgentChatCommand
      ? await runReadOnlyAgentApprovalContinuations({
          approvedCommand: approval.command, approvedPlan: approval.plan, canonicalEventJournal,
          signal: abortController.signal, executor: onAgentChatCommand, messageId,
          initialPendingApproval: pendingReadOnlyFollowUpApproval, initialResult: sessionResult, isCancelled,
          onProgress, configRef, targetSlot, toolExecutor,
        })
      : null;

    if (isAgentTaskRuntimeWaitingApproval(sessionResult) && sessionResult.pendingApproval) {
      const pendingPresentation = dispatchApprovedPendingPresentation({ taskScopedApprovedContinuation, sessionResult, displayResult, preparedRequest, messageId });
      if (pendingPresentation) await pendingPresentation;
    } else if (pendingReadOnlyContinuationRun?.count) {
      let continuationSessionResult = pendingReadOnlyContinuationRun.result;
      const taskScopedReadOnlyContinuation = await consumeTaskScopedApprovedContinuations(continuationSessionResult, {
        logLabel: 'task-scoped approval continuation executing after read-only follow-up',
      });
      continuationSessionResult = taskScopedReadOnlyContinuation.result;

      if (isApprovedAgentRequestCancelled({ abortController, requestToken, activeChatRequestTokenRef, messageId })) {
        return;
      }

      const continuationStatus = updateAgentApprovalContinuationPresentation({ continuationSessionResult, preparedRequest, groupTaskLifecycle, messageId });
      if (continuationStatus !== 'awaiting-approval') {
        await speakApprovedAgentResultReply({
          groupTaskLifecycle, approvalRuntime, playVoiceText, preparedRequest, messageId,
          result: continuationSessionResult, runPetResponseTurn, targetSlot,
        });
      }
    } else if (pendingReadOnlyFollowUpApproval) {
      const pendingPresentation = dispatchReadOnlyPendingPresentation({ pendingReadOnlyContinuationRun, pendingReadOnlyFollowUpApproval, sessionResult, displayResult, preparedRequest, messageId });
      if (pendingPresentation) await pendingPresentation;
    } else {
      if (!preparedRequest.isGroupMode) {
        warmLocalReplyVoice(configRef.current.settings);
      }

      await speakApprovedAgentResultReply({
        groupTaskLifecycle, approvalRuntime, playVoiceText, preparedRequest, messageId,
        result: sessionResult, runPetResponseTurn, targetSlot,
      });
    }

    completeApprovedAgentRuntimeLifecycle({ sessionResult, messageId });
  } catch (error) {
    if (isApprovedAgentRequestCancelled({ abortController, requestToken, activeChatRequestTokenRef, messageId })) {
      return;
    }

    const errorText = error instanceof Error ? error.message : String(error);
    completeFailedAgentApproval({ canonicalEventJournal, approvalRuntime, approval, approvalMessage, messageId, groupTaskLifecycle, errorText });
  } finally {
    unregisterAbortController();
    finalizeChatSendRequest(
      requestToken,
      activeChatRequestTokenRef,
      groupChatContinuationEnabledRef,
    );
  }
}
