import { type AgentTaskScopedApprovalContinuationDecision } from '../agentPermissionRouter';
import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimeResult } from './agentRuntimeContract';
import {
  hasAgentRuntimeCommittedDesktopDispatch,
  hasAgentRuntimeCommittedInputDispatch,
} from './agentDispatchEvidence';

function createAgentApprovalCommandFingerprint(command: AgentChatCommand) {
  return command.toolCall
    ? JSON.stringify({ input: command.toolCall.input ?? null, name: command.toolCall.name })
    : JSON.stringify({ kind: command.kind, sourceText: command.sourceText });
}

function isSameAgentApprovalCommand(left: AgentChatCommand, right: AgentChatCommand) {
  return createAgentApprovalCommandFingerprint(left) === createAgentApprovalCommandFingerprint(right);
}

function isAgentOuterDesktopDispatchCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name ?? command.kind;
  if (toolName === 'launch_local_app') {
    return true;
  }
  if (toolName !== 'execute_desktop_action') {
    return false;
  }
  const action = typeof command.toolCall?.input?.action === 'string'
    ? command.toolCall.input.action.trim().toLowerCase()
    : '';
  return action === 'launch_local_app'
    || action === 'open_resource'
    || action === 'focus_window'
    || action === 'open_or_focus_then_control_window'
    || action === 'open_or_focus_then_move_window_to_display';
}

function agentSequenceContainsDesktopInput(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return false;
  }
  const stepsJson = command.toolCall.input?.stepsJson;
  if (typeof stepsJson !== 'string') {
    return false;
  }
  try {
    const steps = JSON.parse(stepsJson) as unknown;
    return Array.isArray(steps) && steps.some((step) => (
      Boolean(step)
      && typeof step === 'object'
      && (step as Record<string, unknown>).tool === 'execute_desktop_input'
    ));
  } catch {
    return false;
  }
}

function isAgentInAppDispatchCommand(command: AgentChatCommand) {
  return command.toolCall?.name === 'execute_desktop_input'
    || agentSequenceContainsDesktopInput(command);
}

function hasAgentDispatchEvidence(
  result: AgentRuntimeResult,
  predicate: (command: AgentChatCommand) => boolean,
) {
  return result.toolResults.some((entry) => {
    if (!predicate(entry.command)) {
      return false;
    }
    return isAgentInAppDispatchCommand(entry.command)
      ? hasAgentRuntimeCommittedInputDispatch(entry.command, entry.result)
      : hasAgentRuntimeCommittedDesktopDispatch(entry.command, entry.result);
  });
}

export function canSkipAgentStaleOuterApprovalAfterTaskEvidence(options: {
  approvedCommand: AgentChatCommand;
  continuationCount: number;
  decision: AgentTaskScopedApprovalContinuationDecision | null;
  pendingCommand: AgentChatCommand;
  result: AgentRuntimeResult;
  staleDuplicateSkipCount: number;
}) {
  return options.staleDuplicateSkipCount < 1
    && options.decision?.reason === 'duplicate-command'
    && isAgentOuterDesktopDispatchCommand(options.approvedCommand)
    && isSameAgentApprovalCommand(options.approvedCommand, options.pendingCommand)
    && (
      options.continuationCount > 0
        ? hasAgentDispatchEvidence(options.result, isAgentInAppDispatchCommand)
        : hasAgentDispatchEvidence(options.result, isAgentOuterDesktopDispatchCommand)
    );
}
