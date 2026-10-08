import { buildExecuteDesktopActionPlan } from './executeDesktopActionPlan';
import { type AgentChatCommand } from '../agentChatCommand';
import {
  getToolCallStringInput,
  type AgentExecutionPlan,
  getToolCallTargetDescription,
  createPlanStep,
  ExecuteDesktopSequenceVisibleClickSummary,
  ExecuteDesktopSequencePlanStepSummary,
} from './agentPlanShared';

function getExecuteDesktopInputAction(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.inputAction ?? input.operation;
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_') : '';
}

function buildExecuteDesktopInputPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = getExecuteDesktopInputAction(command);
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || `Execute desktop input primitive: ${action}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        `execute-desktop-input:${action}`,
        'execute-desktop-input',
        targetDescription
          ? `Execute desktop input ${action}: ${targetDescription}`
          : `Execute desktop input ${action}`,
        {
          details: [
            'This may click, type, press keys, or drag in the active desktop session.',
            'Use only after the target coordinate/window/input field is clear.',
          ],
          requiresDesktopMode: true,
          reversible: false,
          targetDescription: targetDescription || action,
        },
      ),
    ],
  };
}

const EXECUTE_DESKTOP_SEQUENCE_MAX_STEPS = 8;

function getExecuteDesktopSequenceVisibleClickSummary(
  command: AgentChatCommand,
): ExecuteDesktopSequenceVisibleClickSummary | null {
  const input = command.toolCall?.input ?? {};
  const mode = typeof input.mode === 'string' ? input.mode.trim().toLowerCase() : '';
  const rawJson = typeof input.visibleClickJson === 'string' ? input.visibleClickJson.trim() : '';
  let parsed: unknown = null;
  if (rawJson) {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = null;
    }
  }
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : input;
  if (!rawJson && mode !== 'visible_click' && mode !== 'visibleclick') {
    return null;
  }

  const app = typeof source.app === 'string' ? source.app.trim() : '';
  const target = typeof source.target === 'string' ? source.target.trim() : '';
  return app && target ? { app, target } : null;
}

function getExecuteDesktopSequenceStepSummaries(command: AgentChatCommand) {
  const rawStepsJson = command.toolCall?.input?.stepsJson;
  if (typeof rawStepsJson !== 'string' || !rawStepsJson.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawStepsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.slice(0, EXECUTE_DESKTOP_SEQUENCE_MAX_STEPS).map((value): ExecuteDesktopSequencePlanStepSummary => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {
          tool: 'invalid-step',
        };
      }

      const source = value as Record<string, unknown>;
      return {
        reason: typeof source.reason === 'string' ? source.reason.trim() : undefined,
        tool: typeof source.tool === 'string' ? source.tool.trim() : 'missing-tool',
      };
    });
  } catch {
    return null;
  }
}

function buildExecuteDesktopSequencePlan(command: AgentChatCommand): AgentExecutionPlan {
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const steps = getExecuteDesktopSequenceStepSummaries(command);
  const visibleClick = getExecuteDesktopSequenceVisibleClickSummary(command);
  const stepCount = steps?.length ?? 0;
  const details = [
    `Max steps: ${EXECUTE_DESKTOP_SEQUENCE_MAX_STEPS}`,
    visibleClick ? 'Mode: visible_click' : '',
    visibleClick ? `App/window: ${visibleClick.app}` : '',
    visibleClick ? `Visible target: ${visibleClick.target}` : '',
    stepCount
      ? `Requested steps: ${stepCount}`
      : visibleClick
        ? 'Runtime will focus the app, locate an actionable target in that window, click once with the visible pointer, and verify afterward.'
        : 'stepsJson will be validated by the runtime before any step runs.',
    ...(steps ?? []).map((step, index) => {
      const reasonText = step.reason ? ` - ${step.reason}` : '';
      return `${index + 1}. ${step.tool}${reasonText}`;
    }),
    'Allowed nested tools: execute_desktop_action, execute_desktop_input.',
    'Runtime executes steps in order and stops on first failure by default.',
  ];

  return {
    commandKind: command.kind,
    goal: explicitGoal || `Execute desktop sequence${targetDescription ? `: ${targetDescription}` : ''}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'execute-desktop-sequence',
        'execute-desktop-sequence',
        visibleClick
          ? `Visible click "${visibleClick.target}" in "${visibleClick.app}" with one approval`
          : stepCount
          ? `Execute ${stepCount} desktop primitive step(s) with one approval`
          : 'Execute a desktop primitive sequence with one approval',
        {
          details,
          requiresDesktopMode: true,
          targetDescription: visibleClick
            ? `${visibleClick.app}: ${visibleClick.target}`
            : targetDescription || 'desktop primitive sequence',
        },
      ),
    ],
  };
}

export function buildDesktopActionToolPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const toolName = command.toolCall?.name;
  if (!toolName) return null;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  switch (toolName) {
    case 'execute_desktop_action':
      return buildExecuteDesktopActionPlan(command);

    case 'execute_desktop_input':
      return buildExecuteDesktopInputPlan(command);

    case 'execute_desktop_sequence':
      return buildExecuteDesktopSequencePlan(command);

    case 'focus_window':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `唤出已有窗口：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'focus-window',
            'focus-window',
            `把匹配的已有窗口切到前台：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'close_window':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `关闭已有窗口：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'close-window',
            'close-window',
            `向匹配的已有窗口发送关闭请求：${targetDescription}`,
            {
              details: [
                '这不是强制结束进程；如果目标应用有未保存内容，可能会弹出保存确认并保持窗口打开。',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };
    default: return null;
  }
}
