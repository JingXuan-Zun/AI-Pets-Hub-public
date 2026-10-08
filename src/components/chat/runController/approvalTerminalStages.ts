import { releaseAgentCanonicalEventJournal, assessAgentCommandResult, type getAgentCanonicalEventJournal, type AgentRuntimeContinuation } from '../../../agent';
import type { ChatMessage } from '../../../types';
import { updateAgentApprovalMessage } from '../agentApprovalMessageStore';
import { publishAgentRuntimeWorldResult } from '../../../runtime-world/agentRuntimeWorldBridge';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { publishGroupTaskEvent, completeGroupTaskMessageLifecycle, type GroupTaskLifecycleCallbacks } from '../group/task/groupTaskApprovalLifecycle';
import { updateGroupTaskConversationEvent } from '../group/task/groupTaskConversationEvent';
import { projectAgentApprovalDenied } from './approvalDecisionProjection';
import { projectAgentApprovalFailure } from './approvalFailureProjection';
import { createAgentApprovalFailureVisibleText } from './sessionVisibleText';

interface ApprovalTerminalOptions {
  canonicalEventJournal: ReturnType<typeof getAgentCanonicalEventJournal>;
  approvalRuntime: AgentRuntimeContinuation | null;
  approval: NonNullable<ChatMessage['agentApproval']>;
  approvalMessage: ChatMessage;
  messageId: string;
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
}

export function completeDeniedAgentApproval({ canonicalEventJournal, approvalRuntime, approval, approvalMessage, messageId, groupTaskLifecycle }: ApprovalTerminalOptions) {
    if (canonicalEventJournal && approvalRuntime?.taskState) {
      canonicalEventJournal.append({
        payload: { reason: 'user-denied' },
        runId: approvalRuntime.taskState.runId ?? approvalRuntime.taskState.taskId,
        taskId: approvalRuntime.taskState.taskId,
        type: 'task_cancelled',
      });
    }
    const deniedGroupTaskEvent = updateGroupTaskConversationEvent({
      event: approval.groupTaskEvent ?? approvalMessage?.groupTaskEvent,
      outcome: 'failed',
      summary: 'User denied execution.',
    });
    updateAgentApprovalMessage(messageId, (message) => projectAgentApprovalDenied(message, { deniedGroupTaskEvent, approval }));
    pushFrontendRuntimeLog('agent-run', 'approval denied', {
      goal: approval.plan.goal,
    });
    publishAgentRuntimeWorldResult({
      status: 'cancelled',
      taskState: approvalRuntime?.taskState ?? null,
    });
    publishGroupTaskEvent(groupTaskLifecycle, deniedGroupTaskEvent);
    completeGroupTaskMessageLifecycle(
      groupTaskLifecycle,
      deniedGroupTaskEvent,
      approvalMessage.petId,
    );
    releaseAgentCanonicalEventJournal(messageId);
}

export function completeFailedAgentApproval({ canonicalEventJournal, approvalRuntime, approval, approvalMessage, messageId, groupTaskLifecycle, errorText }: ApprovalTerminalOptions & { errorText: string }) {
    if (canonicalEventJournal && approvalRuntime?.taskState) {
      canonicalEventJournal.append({
        payload: { reason: 'approval-continuation-error' },
        runId: approvalRuntime.taskState.runId ?? approvalRuntime.taskState.taskId,
        taskId: approvalRuntime.taskState.taskId,
        type: 'task_failed',
      });
    }
    releaseAgentCanonicalEventJournal(messageId);
    publishAgentRuntimeWorldResult({
      status: 'failed',
      taskState: approvalRuntime?.taskState ?? null,
    });
    const result = assessAgentCommandResult(approval.command, {
      errorText,
      ok: false,
      responseText: createAgentApprovalFailureVisibleText(errorText),
    });
    const failedGroupTaskEvent = updateGroupTaskConversationEvent({
      event: approval.groupTaskEvent ?? approvalMessage.groupTaskEvent,
      outcome: 'failed',
      summary: errorText,
    });
    updateAgentApprovalMessage(messageId, (message) => projectAgentApprovalFailure(message, { failedGroupTaskEvent, errorText, result, approval }));
    publishGroupTaskEvent(groupTaskLifecycle, failedGroupTaskEvent);
    completeGroupTaskMessageLifecycle(
      groupTaskLifecycle,
      failedGroupTaskEvent,
      approvalMessage.petId,
    );
    pushFrontendRuntimeLog('agent-run', 'approved run failed', {
      goal: approval.plan.goal,
      error: errorText,
    });
}
