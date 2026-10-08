import { type AgentChatCommandResult, type AgentRuntimeProgressEvent, type AgentProductionSessionResult } from '../../../agent';
import { isAgentTaskRuntimeWaitingApproval } from '../agentRuntimeUiStatusProjection';
import { compactAgentPersonaPromptText } from './personaText';

export function getAgentResultRunStatus(result: AgentChatCommandResult, blocked: boolean) {
  if (blocked) {
    return 'blocked' as const;
  }

  return result.ok === false ? 'failed' as const : 'completed' as const;
}

export function formatAgentVisibleGoal(goal: string, maxLength = 54) {
  const compactGoal = compactAgentPersonaPromptText(goal, maxLength);
  return compactGoal ? `“${compactGoal}”` : '这一步';
}

export function createAgentProductionSessionInitialVisibleText() {
  return '我先看清楚，再一步步来。';
}

export function createAgentProductionSessionProgressVisibleText(event: AgentRuntimeProgressEvent) {
  switch (event.type) {
    case 'model-thinking':
      return event.continuation.steps.length
        ? '我在看刚才的结果，判断下一步。'
        : '我在理解你的需求，先判断要看哪些信息。';
    case 'model-decision':
      if (event.continuation.steps[event.continuation.steps.length - 1]?.action === 'tool_calls') {
        return '我先并行看几项只读信息，这样会快一点。';
      }

      if (event.continuation.steps[event.continuation.steps.length - 1]?.action === 'tool_call') {
        return '我选好了下一步，正在准备执行。';
      }

      return '我已经判断出下一步，正在整理结果。';
    case 'tools-running': {
      const commandCount = event.commands?.length ?? (event.command ? 1 : 0);
      if (commandCount > 1) {
        return `我正在并行读取 ${commandCount} 项本机状态。`;
      }

      return '我正在执行这一步。';
    }
    case 'tool-result':
      return '这一步有结果了，我继续判断。';
    default:
      return event.message || '我正在继续处理。';
  }
}

export function createAgentProductionSessionResultVisibleText(result: AgentProductionSessionResult) {
  switch (result.status) {
    case 'budget-exceeded':
      return '这次跑太久了，我先停下，别让它一直卡着。';
    case 'needs-approval':
      return '我已经准备好要执行的操作了，确认后会直接继续。';
    case 'needs-user':
      return '这里还差一点信息，你补一句我就接着来。';
    case 'completed':
      return '这一段有结果了。';
    default:
      return '这一步没走通，我先停下，免得乱动。';
  }
}

export function createAgentPendingApprovalVisibleText(goal: string) {
  return `已准备好执行${formatAgentVisibleGoal(goal)}，确认后会直接操作电脑并继续。`;
}

export function createAgentApprovalDeniedVisibleText() {
  return '好，这次我不动。';
}

export function createAgentApprovalAcceptedVisibleText() {
  return '好，我继续。';
}

export function createAgentUnsupportedApprovalVisibleText() {
  return '这张旧确认卡已经接不上了，重新用 / 发我一次吧。';
}

export function createAgentApprovalContinuationVisibleText(result: AgentProductionSessionResult) {
  return isAgentTaskRuntimeWaitingApproval(result)
    ? '已准备好下一步，确认后会直接继续。'
    : '这一步处理完了。';
}

export function createAgentApprovalNextStepVisibleText(goal: string) {
  return `已准备好继续执行${formatAgentVisibleGoal(goal)}，确认后会直接操作电脑。`;
}

export function createAgentApprovalFailureVisibleText(errorText: string) {
  return `这一步没走通：${compactAgentPersonaPromptText(errorText, 140)}`;
}
