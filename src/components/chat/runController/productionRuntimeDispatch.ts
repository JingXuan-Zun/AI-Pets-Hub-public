import { runAgentProductionRuntime, runAgentProductionApprovedAction, type AgentRuntimeContinuation, type AgentChatCommandResult, type AgentRuntimeToolExecutor } from '../../../agent';
import type { ChatMessage, PetConfig } from '../../../types';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import type { resolvePreparedAgentTargetSlot } from './sessionMessageProjection';
import { buildPersonaBehaviorContractInstruction } from '../../../services/personaRulePolicy';
import { runAgentControllerToolTransactionWithLiveProgress } from './toolExecutionAdapter';
type PreparedOptions = Pick<Parameters<typeof runAgentProductionRuntime>[0], 'approvedToolResult' | 'canonicalEventJournal' | 'initialCommand' | 'onProgress' | 'importedSkills' | 'toolExecutor' | 'workingMemory'> & {
    signal: AbortSignal;
    targetSlot: NonNullable<ReturnType<typeof resolvePreparedAgentTargetSlot>>;
    preparedRequest: PreparedChatSendRequest;
    instruction: string;
};
type ApprovedOptions = Pick<Parameters<typeof runAgentProductionApprovedAction>[0], 'canonicalEventJournal' | 'onProgress' | 'toolExecutor'> & {
    approval: NonNullable<ChatMessage['agentApproval']>;
    approvalRuntime: AgentRuntimeContinuation;
    signal: AbortSignal;
    executor?: AgentRuntimeToolExecutor;
    messageId: string;
    missingExecutorResult: AgentChatCommandResult;
    targetSlot: ReturnType<typeof resolvePreparedAgentTargetSlot>;
    configRef: {
        current: PetConfig;
    };
};
export function runPreparedAgentRuntimeStage({ approvedToolResult, canonicalEventJournal, initialCommand, signal, onProgress, importedSkills, targetSlot, preparedRequest, toolExecutor, instruction, workingMemory }: PreparedOptions) {
    return runAgentProductionRuntime({
        approvedToolResult,
        canonicalEventJournal,
        initialCommand,
        cancellationSignal: signal,
        onProgress,
        importedSkills,
        personaBehaviorContract: buildPersonaBehaviorContractInstruction(targetSlot.personality),
        settings: preparedRequest.currentConfig.settings,
        sourceText: preparedRequest.outgoingText,
        toolExecutor,
        userGoal: instruction,
        workingMemory,
        workingMemoryText: workingMemory.summaryText,
    });
}
export function runApprovedAgentRuntimeStage({ canonicalEventJournal, approval, approvalRuntime, signal, executor, messageId, missingExecutorResult, onProgress, targetSlot, configRef, toolExecutor }: ApprovedOptions) {
    return runAgentProductionApprovedAction({
        canonicalEventJournal,
        approval: {
            command: approval.command,
            plan: approval.plan,
            reason: 'User approved execution.',
            routeSummary: 'Approved by user.',
            runId: approvalRuntime.taskState?.runId ?? null,
            surfaceGeneration: approvalRuntime.taskState?.surface?.generation ?? null,
            surfaceId: approvalRuntime.taskState?.surface?.surfaceId ?? null,
            taskId: approvalRuntime.taskState?.taskId ?? null,
        },
        cancellationSignal: signal,
        continuation: approvalRuntime,
        executeApprovedCommand: (command) => executor
            ? runAgentControllerToolTransactionWithLiveProgress({
                command,
                executor: executor,
                messageId,
                signal: signal,
            })
            : Promise.resolve(missingExecutorResult),
        onProgress,
        personaBehaviorContract: targetSlot
            ? buildPersonaBehaviorContractInstruction(targetSlot.personality)
            : undefined,
        settings: configRef.current.settings,
        toolExecutor,
    });
}
