import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentActionCoverageDependencies } from './agentActionCoverage';
import {
  AGENT_RUNTIME_TARGET_RESOLUTION_MARKER,
  createAgentTargetResolutionContext,
  type AgentTargetResolutionContext,
} from './agentTargetResolutionContext';
import {
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';
import {
  selectAgentTaskRuntimeNextTransition,
  type AgentTaskRuntimeTransitionState,
} from './agentTaskRuntime';

export {
  AGENT_RUNTIME_TARGET_RESOLUTION_MARKER,
  type AgentTargetResolutionContext,
} from './agentTargetResolutionContext';

export type AgentTargetResolutionOutcome =
  | {
      command: AgentChatCommand;
      kind: 'command';
      reason: string;
    }
  | {
      command: null;
      kind: 'not-selected' | 'blocked';
      reason: string;
    };

export function resolveAgentTargetResolutionCommand(options: {
  context: AgentTargetResolutionContext;
  sourceText: string;
  taskState?: AgentTaskRuntimeTransitionState | null;
  userGoal: string;
}): AgentTargetResolutionOutcome {
  const { context } = options;
  const transition = selectAgentTaskRuntimeNextTransition({ taskState: options.taskState });
  const resumeRequiresTargetResolution = transition.kind === 'resume'
    && context.missingInAppActionCoverage
    && !context.alreadyResolvedSinceLastDispatch;
  if (
    transition.kind !== 'compatibility'
    && transition.kind !== 'target-resolution'
    && !resumeRequiresTargetResolution
  ) {
    return {
      command: null,
      kind: 'not-selected',
      reason: `${transition.reason} Target resolution was not selected.`,
    };
  }
  if (!context.directActionRequested) {
    return { command: null, kind: 'not-selected', reason: 'The task does not request a direct action.' };
  }
  if (context.alreadyResolvedSinceLastDispatch) {
    return {
      command: null,
      kind: 'not-selected',
      reason: 'The current dispatch cycle already contains target-resolution evidence.',
    };
  }
  if (!context.missingInAppActionCoverage) {
    return {
      command: null,
      kind: 'not-selected',
      reason: 'The requested in-app action is not missing from current coverage.',
    };
  }

  const sourceQuery = context.sourceQuery?.trim() ?? '';
  const targetText = context.targetText?.trim() ?? '';
  if (!context.windowEvidenceAvailable || !sourceQuery || !targetText) {
    return {
      command: null,
      kind: 'blocked',
      reason: 'Target resolution requires source-window evidence, source query, and target text.',
    };
  }

  const sourceHwnd = Number(context.sourceHwnd);
  const validSourceHwnd = Number.isFinite(sourceHwnd) && sourceHwnd > 0
    ? Math.round(sourceHwnd)
    : null;
  const isAuthenticationTarget = /(?:登录|登陆|login|sign\s*in|continue|继续)/iu.test(targetText);
  return {
    command: {
      capabilityId: 'desktop-observation',
      instruction: options.userGoal,
      kind: 'tool-call',
      sourceText: options.sourceText,
      toolCall: {
        goal: options.userGoal,
        input: {
          action: isAuthenticationTarget ? 'describe_elements' : 'locate_element',
          allowScreenFallback: false,
          forceRefresh: true,
          ...(validSourceHwnd ? { hwnd: validSourceHwnd, sourceId: `window:${validSourceHwnd}:` } : {}),
          question: [
            AGENT_RUNTIME_TARGET_RESOLUTION_MARKER,
            'The source app/window is available, but the selected task subgoal is still unresolved.',
            `Source app/window: ${sourceQuery}.`,
            validSourceHwnd
              ? `Prefer exact source HWND ${validSourceHwnd} and window capture before any screen/display fallback.`
              : '',
            `Target inside that app/window: ${targetText}.`,
            'Identify the target, its associated primary action, their relation, and a usable native-screen coordinate.',
            'Do not report actionable readiness unless the primary action belongs to the requested target.',
          ].filter(Boolean).join(' '),
          sourceQuery,
          sourceType: 'window',
          targetDescription: `${targetText} and its primary action inside ${sourceQuery}`,
          targetText,
        },
        name: 'locate_screen_elements',
      },
    },
    kind: 'command',
    reason: 'Task Runtime selected the unresolved target for version-neutral target resolution.',
  };
}

export function resolveAgentTargetResolution(options: {
  actionCoverageDependencies: AgentActionCoverageDependencies;
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  taskState?: AgentTaskRuntimeTransitionState | null;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentTargetResolutionOutcome {
  return resolveAgentTargetResolutionCommand({
    context: createAgentTargetResolutionContext(options),
    sourceText: options.sourceText,
    taskState: options.taskState,
    userGoal: options.userGoal,
  });
}

export function isAgentTargetResolutionAvailable(options: {
  actionCoverageDependencies: AgentActionCoverageDependencies;
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  taskState?: AgentTaskRuntimeTransitionState | null;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}) {
  return resolveAgentTargetResolution(options).kind === 'command';
}
