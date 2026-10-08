import { normalizePlannerDisplayMoveTarget, extractPlannerOpenAndMoveTargetFromText, createPlannerOpenAndMoveSequenceInput, extractAbsoluteLocalPathCandidate } from './plannerRequestText';
export { compactPlannerSourceText, PLANNER_OPEN_VERB_PATTERN, PLANNER_MOVE_VERB_PATTERN, normalizePlannerDisplayMoveTarget, extractPlannerExistingWindowMoveTargetFromText, extractPlannerOpenAndMoveTargetFromText, shouldPlannerToolOpenOrSearchTarget, createPlannerOpenAndMoveSequenceInput, extractAbsoluteLocalPathCandidate, isPlannerVideoSummaryIntentWithoutSearch } from './plannerRequestText';

import {
  type AgentChatCommand,
  type AgentDesktopIconPlacementDirection,
  type AgentPlannerCommandStep,
  type AgentToolCallName,
} from '../agentChatCommand';

import {
  isAgentToolName,
} from '../agentToolRegistry';

import {
  resolveSafeDesktopOrganizationScope,
} from '../desktopOrganizationScopePolicy';

type AgentPlannerIntent = 'tool' | 'chat' | 'clarify' | 'unsupported';

interface AgentPlannerToolStep {
  args?: Record<string, unknown>;
  reason?: string;
  tool?: string | null;
}

export interface AgentPlannerDecision {
  args?: Record<string, unknown>;
  confidence?: number;
  goal?: string;
  intent?: AgentPlannerIntent;
  message?: string;
  reason?: string;
  steps?: AgentPlannerToolStep[];
  tool?: string | null;
}

export function normalizePlannerIntent(value: unknown): AgentPlannerIntent {
  return value === 'tool' || value === 'chat' || value === 'clarify' || value === 'unsupported'
    ? value
    : 'unsupported';
}

export function normalizeToolName(value: unknown): AgentToolCallName | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedName = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  return isAgentToolName(normalizedName)
    ? normalizedName as AgentToolCallName
    : null;
}

export function resolvePrimaryPlannerToolStep(decision: AgentPlannerDecision) {
  const step = decision.steps?.find((candidate) => normalizeToolName(candidate.tool)) ?? null;
  if (!step) {
    return null;
  }

  return {
    args: step.args && typeof step.args === 'object' && !Array.isArray(step.args)
      ? step.args
      : {},
    toolName: normalizeToolName(step.tool),
  };
}

function inferPlannerCommandStepPhase(
  toolName: AgentToolCallName,
  reason: string | undefined,
): AgentPlannerCommandStep['phase'] {
  const normalizedReason = reason?.trim().toLowerCase() ?? '';
  if (/(verify|验证|复查|确认结果|检查结果)/iu.test(normalizedReason)) {
    return 'verify';
  }
  if (/(recover|重试|恢复|失败后|重新)/iu.test(normalizedReason)) {
    return 'recover';
  }

  if (
    toolName === 'get_system_info'
    || toolName === 'get_display_info'
    || toolName === 'get_voice_status'
    || toolName === 'inspect_local_project'
  ) {
    return 'observe';
  }

  if (toolName === 'organize_desktop_icons') {
    return 'plan';
  }

  return 'execute';
}

export function normalizePlannerCommandSteps(
  sourceText: string,
  decision: AgentPlannerDecision,
): AgentPlannerCommandStep[] {
  const rawSteps = decision.steps?.length
    ? decision.steps
    : decision.tool
      ? [{
          args: decision.args,
          reason: decision.reason,
          tool: decision.tool,
        }]
      : [];

  return rawSteps
    .map((step, rawIndex): AgentPlannerCommandStep | null => {
      const toolName = normalizeToolName(step.tool);
      if (!toolName) {
        return null;
      }

      const rawArgs = step.args && typeof step.args === 'object' && !Array.isArray(step.args)
        ? step.args
        : {};
      return {
        args: normalizePlannerToolArgs(sourceText, toolName, rawArgs),
        index: rawIndex + 1,
        phase: inferPlannerCommandStepPhase(toolName, step.reason),
        reason: step.reason?.trim() || null,
        tool: toolName,
      } satisfies AgentPlannerCommandStep;
    })
    .filter((step): step is AgentPlannerCommandStep => Boolean(step));
}

export function withPlannerCommandSteps(
  command: AgentChatCommand,
  plannerSteps: AgentPlannerCommandStep[],
) {
  return plannerSteps.length
    ? {
        ...command,
        plannerSteps,
      }
    : command;
}

export function shouldComposePlannerStepsIntoDesktopSequence(
  plannerSteps: AgentPlannerCommandStep[],
) {
  return plannerSteps.length >= 2
    && plannerSteps.every((step) => (
      step.tool === 'execute_desktop_action'
      || step.tool === 'execute_desktop_input'
    ));
}

export function createPlannerStepsDesktopSequenceInput(
  plannerSteps: AgentPlannerCommandStep[],
  goal?: string,
) {
  return {
    postVerify: true,
    postVerifyQuery: goal?.trim() || undefined,
    stepsJson: JSON.stringify(plannerSteps.map((step) => ({
      args: step.args,
      reason: step.reason ?? undefined,
      tool: step.tool,
    }))),
    stopOnError: true,
  };
}

export function getStringArg(args: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function getBooleanArg(args: Record<string, unknown>, key: string) {
  return typeof args[key] === 'boolean' ? args[key] : undefined;
}

export function getNumberArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function normalizeDirection(value: unknown): AgentDesktopIconPlacementDirection | null {
  if (value === 'above' || value === 'below' || value === 'left-of' || value === 'right-of') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const compactValue = value.trim().toLowerCase();
  if (/上|above|top/u.test(compactValue)) {
    return 'above';
  }
  if (/下|below|bottom/u.test(compactValue)) {
    return 'below';
  }
  if (/左|left/u.test(compactValue)) {
    return 'left-of';
  }
  if (/右|right/u.test(compactValue)) {
    return 'right-of';
  }

  return null;
}

export function normalizeDesktopItemGroupBy(value: unknown) {
  return value === 'none' || value === 'kind' || value === 'category' || value === 'extension'
    ? value
    : undefined;
}

export function createToolCallCommand(
  sourceText: string,
  toolName: AgentToolCallName,
  input: Record<string, unknown>,
  goal?: string,
): AgentChatCommand {
  const capabilityId = toolName === 'execute_memory_action'
    ? 'agent-memory'
    : toolName === 'launch_local_app'
      || toolName === 'browser_search'
      || toolName === 'observe_windows_and_apps'
      || toolName === 'execute_desktop_action'
      || toolName === 'execute_desktop_input'
      || toolName === 'control_browser'
      || toolName === 'remember_local_app'
    ? 'app-launcher'
    : toolName === 'execute_file_management_action' || toolName === 'execute_local_file_action'
      ? 'local-file-system'
    : toolName === 'analyze_game_screen' || toolName === 'manage_game_companion_loop'
      ? 'game-companion'
    : toolName === 'locate_screen_elements'
      ? 'desktop-observation'
    : toolName === 'inspect_local_project' || toolName === 'run_local_project_action'
      ? 'local-project-inspector'
    : toolName === 'organize_desktop_icons' || toolName === 'place_desktop_icon'
      ? 'desktop-organization'
    : toolName === 'get_voice_status'
      || toolName === 'switch_tts_provider'
      || toolName === 'warmup_local_voice'
      || toolName === 'set_voice_input'
      || toolName === 'start_voice_input_session'
      || toolName === 'stop_voice_input_session'
      ? 'voice-control'
      : 'system-inspector';

  return {
    capabilityId,
    instruction: sourceText,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: goal?.trim() || undefined,
      input,
      name: toolName,
    },
  };
}

export function normalizePlannerToolArgs(
  sourceText: string,
  toolName: AgentToolCallName,
  args: Record<string, unknown>,
) {
  if (toolName === 'browser_search' || toolName === 'search_web') {
    return {
      ...args,
      forceNewPage: getBooleanArg(args, 'forceNewPage') || undefined,
      query: getStringArg(args, ['query', 'keyword', 'keywords', 'url', 'website', 'site', 'target']),
    };
  }

  if (toolName === 'launch_local_app') {
    return {
      ...args,
      forceNew: getBooleanArg(args, 'forceNew') || undefined,
      query: getStringArg(args, ['query', 'appName', 'name']),
    };
  }

  if (toolName === 'execute_desktop_sequence') {
    const targetDisplay = normalizePlannerDisplayMoveTarget(sourceText);
    const target = extractPlannerOpenAndMoveTargetFromText(sourceText)
      || getStringArg(args, ['target', 'query', 'appName', 'name', 'url', 'website', 'site']);
    if (targetDisplay && target) {
      return {
        ...args,
        ...createPlannerOpenAndMoveSequenceInput({
          forceNew: getBooleanArg(args, 'forceNew'),
          sourceText,
          target,
          targetDisplay,
        }),
      };
    }

    return args;
  }

  if (toolName === 'remember_local_app') {
    return {
      ...args,
      alias: getStringArg(args, ['alias', 'name']),
      path: getStringArg(args, ['path', 'appPath']),
    };
  }

  if (toolName === 'execute_memory_action') {
    return {
      ...args,
      action: getStringArg(args, ['action', 'memoryAction', 'operation']),
      category: getStringArg(args, ['category', 'type', 'topic']) || undefined,
      key: getStringArg(args, ['key', 'name', 'preferenceKey']) || undefined,
      query: getStringArg(args, ['query', 'keyword', 'keywords', 'target']) || undefined,
      value: getStringArg(args, ['value', 'content', 'text', 'fact', 'preference']) || undefined,
    };
  }

  if (toolName === 'execute_file_management_action') {
    return {
      ...args,
      action: getStringArg(args, ['action', 'fileAction', 'operation']),
      destinationDirectory: getStringArg(args, [
        'destinationDirectory',
        'targetDirectory',
        'folderPath',
        'directoryPath',
        'parentPath',
      ]) || undefined,
      destinationPath: getStringArg(args, ['destinationPath', 'targetPath', 'newPath', 'destination', 'dest', 'to']) || undefined,
      desktopPath: getStringArg(args, ['desktopPath', 'desktop', 'desktopDirectory', 'desktopFolder']) || undefined,
      groupBy: getStringArg(args, ['groupBy', 'group', 'grouping', 'groupStrategy']) || undefined,
      includeDirectories: getBooleanArg(args, 'includeDirectories') || undefined,
      includeHidden: getBooleanArg(args, 'includeHidden') || undefined,
      includeShortcuts: getBooleanArg(args, 'includeShortcuts') || undefined,
      intendedAction: getStringArg(args, ['intendedAction', 'previewAction', 'targetAction', 'operationType']) || undefined,
      limit: getNumberArg(args, 'limit') || undefined,
      mode: getStringArg(args, ['mode']) || undefined,
      newName: getStringArg(args, ['newName', 'name', 'fileName', 'folderName']) || undefined,
      sourcePath: getStringArg(args, ['sourcePath', 'path', 'source', 'from', 'query']) || undefined,
    };
  }

  if (toolName === 'analyze_game_screen') {
    return {
      ...args,
      focus: getStringArg(args, ['focus', 'analysisFocus', 'topic']) || undefined,
      forceRefresh: getBooleanArg(args, 'forceRefresh') || undefined,
      gameHint: getStringArg(args, ['gameHint', 'gameName', 'game']) || undefined,
      query: getStringArg(args, ['query', 'target', 'sourceName', 'name', 'windowTitle', 'title']) || undefined,
      question: getStringArg(args, ['question', 'goal', 'prompt']) || sourceText,
      sourceId: getStringArg(args, ['sourceId', 'id']) || undefined,
      sourceType: getStringArg(args, ['sourceType', 'captureSourceTypes', 'type']) || undefined,
    };
  }

  if (toolName === 'place_desktop_icon') {
    return {
      ...args,
      anchorName: getStringArg(args, ['anchorName', 'anchor']),
      direction: normalizeDirection(args.direction) ?? undefined,
      targetName: getStringArg(args, ['targetName', 'target']),
    };
  }

  if (toolName === 'organize_desktop_icons') {
    const displayTarget = getStringArg(args, ['targetDisplay', 'displayTarget', 'display']);
    const sourceDisplay = getStringArg(args, ['sourceDisplay', 'sourceDisplayTarget']);
    const groupBy = getStringArg(args, ['groupBy', 'group', 'grouping', 'groupStrategy']);
    const mode = getStringArg(args, ['mode', 'actionMode']);
    const placementIntent = getStringArg(args, ['placementIntent', 'layoutIntent', 'placementGoal', 'arrangementIntent', 'intent']) || sourceText;
    const scope = getStringArg(args, ['sourceScope', 'scope', 'iconScope']);
    const normalizedDisplayTarget = displayTarget;
    const requestedScope = scope;
    const structuredIntent = Boolean(args.targetDisplay || args.sourceDisplay || args.sourceScope);
    const safeScope = resolveSafeDesktopOrganizationScope({
      displayTarget: normalizedDisplayTarget === 'primary'
        || normalizedDisplayTarget === 'secondary'
        || normalizedDisplayTarget === 'current'
        || normalizedDisplayTarget === 'all'
        ? normalizedDisplayTarget
        : undefined,
      requestedScope: requestedScope === 'all-icons' || requestedScope === 'display-icons'
        ? requestedScope
        : undefined,
      sourceText,
      structuredIntent,
    });
    return {
      ...args,
      displayTarget: normalizedDisplayTarget,
      groupBy: normalizeDesktopItemGroupBy(groupBy),
      mode: mode || 'preview',
      placementIntent,
      scope: safeScope,
      sourceDisplay,
      sourceScope: safeScope,
      targetDisplay: normalizedDisplayTarget,
    };
  }

  if (toolName === 'get_system_info') {
    return {
      ...args,
      includeDisplays: args.includeDisplays !== false,
    };
  }

  if (toolName === 'get_voice_status') {
    return {
      ...args,
      includeLocalHealth: args.includeLocalHealth !== false,
    };
  }

  if (toolName === 'switch_tts_provider') {
    return {
      ...args,
      autoSpeak: getBooleanArg(args, 'autoSpeak'),
      enableVoice: getBooleanArg(args, 'enableVoice'),
      provider: getStringArg(args, ['provider', 'ttsProvider']) || undefined,
    };
  }

  if (toolName === 'set_voice_input') {
    return {
      ...args,
      enabled: getBooleanArg(args, 'enabled'),
    };
  }

  if (toolName === 'start_voice_input_session') {
    return {
      ...args,
      agentPrefix: getBooleanArg(args, 'agentPrefix'),
    };
  }

  if (toolName === 'inspect_local_project') {
    return {
      ...args,
      path: getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']) || extractAbsoluteLocalPathCandidate(sourceText),
      question: getStringArg(args, ['question']) || sourceText,
    };
  }

  if (toolName === 'run_local_project_action') {
    return {
      ...args,
      actionIndex: getNumberArg(args, 'actionIndex') ?? getNumberArg(args, 'index'),
      command: getStringArg(args, ['command']),
      label: getStringArg(args, ['label']),
      path: getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']) || undefined,
      question: getStringArg(args, ['question']) || sourceText,
    };
  }

  return args;
}
