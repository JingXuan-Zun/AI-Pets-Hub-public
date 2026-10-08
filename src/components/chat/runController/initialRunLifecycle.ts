import { createInitialAgentRunCancellationGuard, isInitialAgentRequestStale } from "./requestCancellationGuards";
import { type AgentProductionSessionResult, releaseAgentCanonicalEventJournal } from "../../../agent";
import { registerAgentRunAbortController } from "../agentRunAbortRegistry";
import { resolvePreparedAgentTargetSlot, createAgentProductionSessionPlaceholderCommand, createAgentProductionSessionDisplayPlan } from "./sessionMessageProjection";
import { isAgentTaskRuntimeWaitingApproval } from "../agentRuntimeUiStatusProjection";
import { speakInitialAgentResultReply } from "./resultReplyStages";
import { publishInitialAgentRuntimeResult } from "./runtimeResultPublication";
import { runPreparedAgentRuntimeStage } from "./productionRuntimeDispatch";
import { runInitialAgentApprovalContinuations } from "./approvalContinuationDispatch";
import { createMissingAgentExecutorResult } from "./approvedRuntimeCallbacks";
import { logInitialAgentRuntimeCompletion } from "./runtimeCompletionStages";
import { createAgentRunRequestContext } from "./runRequestContext";
import { logUnconsumedInitialAgentApproval, logMissingInitialAgentApprovalExecutor, updateInitialAgentContinuationPresentation } from "./initialContinuationPresentation";
import { beginInitialAgentRunPresentation } from "./initialEntryPresentation";
import { updateInitialAgentRunPresentation } from "./resultPresentationStages";
import { presentAgentRunPendingApproval } from "./pendingApprovalStages";
import { createAgentRunToolExecutor, createAgentRunProgressHandler } from "./guardedRequestCallbacks";
import type { RunPreparedAgentProductionSessionOptions } from "./controllerOptions";
import { shouldRouteToAgentLoop } from "../../../agent/loop/agentLoopRouting";
import { runAgentLoopChatSession } from "./agentLoopChatSession";

export async function runPreparedAgentProductionSession({
  activeChatRequestTokenRef,
  approvedToolResult,
  groupTaskLifecycle,
  instruction,
  onRuntimeResult,
  onAgentChatCommand,
  playVoiceText,
  preparedRequest,
  runPetResponseTurn,
  warmLocalReplyVoice,
}: RunPreparedAgentProductionSessionOptions) {
  const targetSlot = resolvePreparedAgentTargetSlot(preparedRequest);
  if (!targetSlot) {
    return;
  }
  if (!approvedToolResult && shouldRouteToAgentLoop({ enabled: preparedRequest.currentConfig.settings.agentDesktopLoopEnabled, instruction })) {
    await runAgentLoopChatSession({
      activeChatRequestTokenRef, approvedToolResult, groupTaskLifecycle, instruction, onRuntimeResult, onAgentChatCommand,
      playVoiceText, preparedRequest, runPetResponseTurn, targetSlot, warmLocalReplyVoice,
    });
    return;
  }

  const { participantNames, shouldAutoSpeakReply, workingMemory, initialCommand, importedSkills } = createAgentRunRequestContext(preparedRequest, targetSlot);

  const { runMessageId, canonicalEventJournal } = beginInitialAgentRunPresentation({
    shouldAutoSpeakReply, warmLocalReplyVoice, instruction, preparedRequest,
  });

  const missingExecutorResult = createMissingAgentExecutorResult();

  const abortController = new AbortController();
  const unregisterAbortController = registerAgentRunAbortController(runMessageId, abortController);
  const isCancelled = createInitialAgentRunCancellationGuard({ abortController, preparedRequest, activeChatRequestTokenRef, messageId: runMessageId });
  const toolExecutor = createAgentRunToolExecutor({
    isCancelled,
    executor: onAgentChatCommand,
    messageId: runMessageId,
    missingExecutorResult,
    signal: abortController.signal,
  });
  let result: AgentProductionSessionResult;
  let runtimeRoute = 'stable';
  try {
    const onProgress = createAgentRunProgressHandler({ isCancelled, messageId: runMessageId });

    const routedResult = await runPreparedAgentRuntimeStage({
      approvedToolResult, canonicalEventJournal, initialCommand, signal: abortController.signal, onProgress,
      importedSkills, targetSlot, preparedRequest, toolExecutor, instruction, workingMemory,
    });
    runtimeRoute = routedResult.implementation;
    if (!routedResult.result) {
      throw new Error(routedResult.reason);
    }
    result = routedResult.result;

  } catch (error) {
    releaseAgentCanonicalEventJournal(runMessageId ?? `request-${preparedRequest.requestToken}`);
    throw error;
  } finally {
    unregisterAbortController();
  }

  if (isInitialAgentRequestStale({ preparedRequest, activeChatRequestTokenRef, messageId: runMessageId })) {
    return;
  }

  logInitialAgentRuntimeCompletion({ runtimeRoute, result });
  publishInitialAgentRuntimeResult({ result, runtimeRoute, onRuntimeResult, preparedRequest, runMessageId, groupTaskLifecycle });

  const pendingRunFollowUpApproval = updateInitialAgentRunPresentation({
    result, instruction, preparedRequest, runMessageId,
  });

  if (isAgentTaskRuntimeWaitingApproval(result) && result.pendingApproval) {
    await presentAgentRunPendingApproval({
      agentRuntime: result.continuation, pendingApproval: result.pendingApproval, preparedRequest, messageId: runMessageId,
      initial: true,
    });
    return;
  }

  if (pendingRunFollowUpApproval) {
    const approvedScopeCommand = createAgentProductionSessionPlaceholderCommand(instruction, preparedRequest.outgoingText);
    const approvedScopePlan = createAgentProductionSessionDisplayPlan(instruction, preparedRequest.outgoingText);

    if (onAgentChatCommand) {
      const continuationRun = await runInitialAgentApprovalContinuations({
        approvedCommand: approvedScopeCommand, approvedPlan: approvedScopePlan, canonicalEventJournal,
        signal: abortController.signal, executor: onAgentChatCommand, messageId: runMessageId,
        initialPendingApproval: pendingRunFollowUpApproval, initialResult: result, isCancelled,
        preparedRequest, targetSlot, toolExecutor,
      });;
      if (continuationRun.count === 0) {
        logUnconsumedInitialAgentApproval({ continuationRun, pendingRunFollowUpApproval });
      } else {
        result = continuationRun.result;
        publishInitialAgentRuntimeResult({ result, runtimeRoute, onRuntimeResult, preparedRequest, runMessageId, groupTaskLifecycle });
        updateInitialAgentContinuationPresentation({ continuationRun, result, runMessageId });
        if (!isAgentTaskRuntimeWaitingApproval(result)) {
          await speakInitialAgentResultReply({
            groupTaskLifecycle, instruction, participantNames, playVoiceText, preparedRequest, messageId: runMessageId,
            result, runPetResponseTurn, shouldAutoSpeakReply, targetSlot,
          });
          releaseAgentCanonicalEventJournal(runMessageId ?? `request-${preparedRequest.requestToken}`);
          return;
        }
        if (result.pendingApproval) {
          await presentAgentRunPendingApproval({
            agentRuntime: result.continuation, pendingApproval: result.pendingApproval, preparedRequest, messageId: runMessageId,
            initial: false,
          });
          return;
        }
      }
    } else {
      logMissingInitialAgentApprovalExecutor({ pendingRunFollowUpApproval });
    }

    await presentAgentRunPendingApproval({
      agentRuntime: result.continuation, pendingApproval: pendingRunFollowUpApproval, preparedRequest, messageId: runMessageId,
      initial: false,
    });
    return;
  }

  await speakInitialAgentResultReply({
    groupTaskLifecycle, instruction, participantNames, playVoiceText, preparedRequest, messageId: runMessageId,
    result, runPetResponseTurn, shouldAutoSpeakReply, targetSlot,
  });
  releaseAgentCanonicalEventJournal(runMessageId ?? `request-${preparedRequest.requestToken}`);
}
