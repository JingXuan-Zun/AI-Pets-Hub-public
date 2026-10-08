import { runAgentProductionApprovalContinuations, type AgentRuntimeToolExecutor } from '../../../agent';
import type { PetConfig } from '../../../types';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import type { resolvePreparedAgentTargetSlot } from './sessionMessageProjection';
import { createSkippedStaleOuterApprovalResult } from './approvalConflictResult';
import { runAgentControllerToolTransactionWithLiveProgress } from './toolExecutionAdapter';
import { buildPersonaBehaviorContractInstruction } from '../../../services/personaRulePolicy';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
type RuntimeOptions = Parameters<typeof runAgentProductionApprovalContinuations>[0];
type CommonOptions = Pick<RuntimeOptions, 'approvedCommand' | 'approvedPlan' | 'canonicalEventJournal' | 'initialPendingApproval' | 'initialResult' | 'isCancelled' | 'toolExecutor'> & {
    signal: AbortSignal;
    executor: AgentRuntimeToolExecutor;
    messageId: string | null;
};
export function runInitialAgentApprovalContinuations({ approvedCommand, approvedPlan, canonicalEventJournal, signal, executor, messageId, initialPendingApproval, initialResult, isCancelled, preparedRequest, targetSlot, toolExecutor }: CommonOptions & {
    preparedRequest: PreparedChatSendRequest;
    targetSlot: NonNullable<ReturnType<typeof resolvePreparedAgentTargetSlot>>;
}) {
    return runAgentProductionApprovalContinuations({
        approvedCommand: approvedCommand,
        approvedPlan: approvedPlan,
        canonicalEventJournal,
        cancellationSignal: signal,
        createSkippedResult: createSkippedStaleOuterApprovalResult,
        executeApprovedCommand: (command) => runAgentControllerToolTransactionWithLiveProgress({
            command,
            executor: executor,
            messageId: messageId,
            signal: signal,
        }),
        initialPendingApproval: initialPendingApproval,
        initialResult,
        isCancelled,
        onIteration: (context) => {
            pushFrontendRuntimeLog('agent-run', 'initial task-scoped follow-up approval continuation executing', {
                count: context.count,
                decision: context.decision,
                goal: context.pendingPlan.goal,
                tool: context.pendingCommand.toolCall?.name ?? context.pendingCommand.kind,
            });
        },
        settings: preparedRequest.currentConfig.settings,
        personaBehaviorContract: buildPersonaBehaviorContractInstruction(targetSlot.personality),
        toolExecutor,
    });
}
export function runReadOnlyAgentApprovalContinuations({ approvedCommand, approvedPlan, canonicalEventJournal, signal, executor, messageId, initialPendingApproval, initialResult, isCancelled, onProgress, configRef, targetSlot, toolExecutor }: CommonOptions & {
    onProgress: RuntimeOptions['onProgress'];
    configRef: {
        current: PetConfig;
    };
    targetSlot: ReturnType<typeof resolvePreparedAgentTargetSlot>;
}) {
    return runAgentProductionApprovalContinuations({
        approvedCommand,
        approvedPlan,
        canonicalEventJournal,
        cancellationSignal: signal,
        createSkippedResult: createSkippedStaleOuterApprovalResult,
        executeApprovedCommand: (command) => runAgentControllerToolTransactionWithLiveProgress({
            command,
            executor: executor,
            messageId,
            signal: signal,
        }),
        initialPendingApproval: initialPendingApproval,
        initialResult,
        isCancelled,
        maxContinuations: 1,
        onIteration: (context) => {
            pushFrontendRuntimeLog('agent-run', 'task-scoped read-only follow-up approval continuation executing', {
                goal: context.pendingPlan.goal,
                tool: context.pendingCommand.toolCall?.name ?? context.pendingCommand.kind,
            });
        },
        onProgress,
        personaBehaviorContract: targetSlot
            ? buildPersonaBehaviorContractInstruction(targetSlot.personality)
            : undefined,
        settings: configRef.current.settings,
        toolExecutor,
    });
}
