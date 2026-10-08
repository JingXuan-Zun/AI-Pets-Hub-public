import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from './agentChatCommand';
import {
  type AgentRuntimeExecutorContext,
} from './agentRuntimeExecutor';
import {
  createAgentRuntimeResult,
} from './desktopSequence/sequenceResultEvidence';
import {
  parseAgentRuntimeDesktopSequenceSteps,
  runAgentRuntimeDesktopSequenceSteps,
} from './desktopSequence/sequenceExecution';
import {
  parseAgentRuntimeVisibleClickSpec,
  executeAgentRuntimeVisibleClick,
} from './desktopSequence/visibleClickSequence';
export {
  resolveAgentRuntimeDesktopSequenceObservedWindow,
  getAgentRuntimeDesktopSequenceWindowTarget,
  resolveAgentRuntimeDesktopSequencePostCreationTarget,
} from './desktopSequence/sequenceWindowTarget';
export {
  inferAgentRuntimeDesktopSequencePostActionState,
} from './desktopSequence/sequenceVerification';

export async function executeDesktopSequence(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const visibleClickSpec = parseAgentRuntimeVisibleClickSpec(toolCall);
  if (visibleClickSpec) {
    return executeAgentRuntimeVisibleClick(context, toolCall, visibleClickSpec);
  }

  const parsed = parseAgentRuntimeDesktopSequenceSteps(toolCall);
  if (parsed.ok === false) {
    return createAgentRuntimeResult({
      errorText: parsed.error,
      ok: false,
      receipt: {
        evidenceLines: [parsed.error],
        status: 'failed',
        summaryLines: [
          'Call: execute_desktop_sequence',
          'Result: rejected before any step ran',
        ],
        title: 'Agent desktop sequence',
        toolName: 'execute_desktop_sequence',
        verification: parsed.error,
      },
      responseText: parsed.error,
      verification: parsed.error,
    });
  }

  return runAgentRuntimeDesktopSequenceSteps(context, toolCall, parsed.steps);
}
