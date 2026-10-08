import { type AgentChatCommand, type AgentToolCallName } from '../agentChatCommand';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import {
  extractPlannerExistingWindowMoveTargetFromText,
  extractPlannerOpenAndMoveTargetFromText,
  normalizePlannerDisplayMoveTarget,
} from '../agentPlanner';
import { createAgentRuntimeCoreOpenMoveSequenceInput } from '../agentRuntimeCore';
import {
  type AgentRuntimeToolResultEntry as AgentProductionToolResultEntry,
  type AgentRuntimePendingApproval as AgentProductionPendingApproval,
} from '../runtime/agentRuntimeContract';
import { hasAgentDisplayObservationEvidence as hasAgentSessionV2DisplayObservationEvidence } from '../runtime/agentCommandEvidencePredicates';
import { resolveAgentObservedWindowTargetEvidence } from '../runtime/agentTargetResolutionContext';
import { createAgentToolCommand } from '../runtime/agentToolCommandFactory';
import { createAgentApprovalRequiredToolReason } from '../runtime/agentApprovalReasonSignals';

interface AgentProductionDesktopRequestRoutingDependencies {
  getDesktopActionName: (args: Record<string, unknown> | undefined) => string;
}

export function createAgentProductionDesktopRequestRouting(dependencies: AgentProductionDesktopRequestRoutingDependencies) {
  const { getDesktopActionName: getAgentSessionV2DesktopActionName } = dependencies;

  const AGENT_PRODUCTION_DESKTOP_ORGANIZATION_REQUEST_PATTERN = /(?=.*(?:\bdesktop\b|\u684c\u9762|\u56fe\u6807))(?=.*(?:\borganize\b|\barrange\b|\bsort\b|\bgroup\b|\bclassify\b|\u6574\u7406|\u6392\u5217|\u6446\u653e|\u5f52\u6574|\u5f52\u7c7b|\u5206\u7c7b|\u6536\u62fe))/iu;
  const AGENT_PRODUCTION_DESKTOP_ITEM_REFERENCE_PATTERN = /(?:\b(?:desktop|icons?|shortcuts?)\b|\u684c\u9762|\u56fe\u6807|\u5feb\u6377\u65b9\u5f0f)/iu;
  const AGENT_PRODUCTION_SCREEN_ITEM_REFERENCE_PATTERN = /(?:\b(?:files?|items?|shortcuts?|icons?)\b|\u6587\u4ef6|\u9879\u76ee|\u4e1c\u897f|\u5feb\u6377\u65b9\u5f0f|\u56fe\u6807)/iu;
  const AGENT_PRODUCTION_ORGANIZATION_ACTION_PATTERN = /(?:\b(?:organize|arrange|sort|group|classify|tidy|clean\s*up)\b|\u6574\u7406|\u6392\u5217|\u6446\u653e|\u5f52\u6574|\u5f52\u7c7b|\u5206\u7c7b|\u6536\u62fe)/iu;
  const AGENT_PRODUCTION_DISPLAY_REFERENCE_PATTERN = /(?:\b(?:displays?|screens?|monitors?)\b|\u5c4f\u5e55|\u663e\u793a\u5668|\u4e3b\u5c4f|\u526f\u5c4f|\u7b2c\u4e8c\u5c4f)/iu;
  const AGENT_PRODUCTION_WINDOW_MOVE_ACTION_PATTERN = /(?:\b(?:move|send|put|place|shift|transfer|drag)\b|\u79fb\u52a8|\u79fb\u5230|\u632a\u5230|\u653e\u5230|\u653e\u5728|\u62d6\u5230|\u642c\u5230)/iu;
  const AGENT_PRODUCTION_WINDOW_REFERENCE_PATTERN = /(?:\b(?:window|app|application|program|browser|chrome|edge|firefox|notepad|photoshop|ps)\b|\u7a97\u53e3|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f|\u6d4f\u89c8\u5668)/iu;
  const AGENT_PRODUCTION_DESKTOP_ITEM_INVENTORY_PATTERN = /(?:\b(?:how\s*many|count|list|show|inspect|check|see|what|which)\b|\u591a\u5c11|\u51e0\u4e2a|\u51e0\u9879|\u54ea\u4e9b|\u4ec0\u4e48|\u5217\u8868|\u5217\u51fa|\u770b\u770b|\u67e5\u770b|\u68c0\u6d4b|\u8bfb\u53d6|\u8bc6\u522b)/iu;
  const AGENT_PRODUCTION_DISPLAY_INFO_ACTION_PATTERN = /^(?:get_display_info|display_info|screen_info|list_displays)$/iu;

  function hasAgentProductionDesktopOrganizationRequest(text: string) {
    if (AGENT_PRODUCTION_DESKTOP_ORGANIZATION_REQUEST_PATTERN.test(text)) {
      return true;
    }

    return AGENT_PRODUCTION_ORGANIZATION_ACTION_PATTERN.test(text)
      && (
        AGENT_PRODUCTION_DESKTOP_ITEM_REFERENCE_PATTERN.test(text)
        || (
          AGENT_PRODUCTION_DISPLAY_REFERENCE_PATTERN.test(text)
          && AGENT_PRODUCTION_SCREEN_ITEM_REFERENCE_PATTERN.test(text)
        )
      );
  }

  function hasAgentProductionDesktopItemInventoryRequest(text: string) {
    const normalizedText = text.normalize('NFKC');
    const hasDesktopOrDisplayContext = AGENT_PRODUCTION_DESKTOP_ITEM_REFERENCE_PATTERN.test(normalizedText)
      || AGENT_PRODUCTION_DISPLAY_REFERENCE_PATTERN.test(normalizedText);
    return hasDesktopOrDisplayContext
      && AGENT_PRODUCTION_SCREEN_ITEM_REFERENCE_PATTERN.test(normalizedText)
      && AGENT_PRODUCTION_DESKTOP_ITEM_INVENTORY_PATTERN.test(normalizedText);
  }

  function hasAgentProductionWindowMoveToDisplayRequest(text: string) {
    const normalizedText = text.normalize('NFKC');
    return AGENT_PRODUCTION_WINDOW_MOVE_ACTION_PATTERN.test(normalizedText)
      && AGENT_PRODUCTION_DISPLAY_REFERENCE_PATTERN.test(normalizedText)
      && AGENT_PRODUCTION_WINDOW_REFERENCE_PATTERN.test(normalizedText);
  }

  function inferAgentProductionDisplayTargetFromText(text: string) {
    const normalizedText = text.normalize('NFKC').toLowerCase();
    if (/(?:\bsecondary\b|\bsecond\s+screen\b|\u526f\u5c4f|\u7b2c\u4e8c\u5c4f)/iu.test(normalizedText)) {
      return 'secondary';
    }
    if (/(?:\bprimary\b|\bmain\s+screen\b|\u4e3b\u5c4f)/iu.test(normalizedText)) {
      return 'primary';
    }
    return undefined;
  }

  function getAgentProductionOpenWindowTarget(args: Record<string, unknown>) {
    for (const key of ['target', 'query', 'url', 'website', 'site', 'appName', 'name']) {
      const value = args[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  function hasAgentProductionMaximizeWindowRequest(text: string) {
    return /(?:\bmaximi[sz]e(?:d)?\b|\bfull\s*screen\b|\u6700\u5927\u5316|\u5168\u5c4f)/iu.test(text);
  }

  function createAgentProductionOpenMoveSequenceRedirect(options: {
    args: Record<string, unknown>;
    sourceText: string;
    toolName: AgentToolCallName;
    userGoal: string;
  }) {
    if (options.toolName !== 'execute_desktop_action') {
      return null;
    }

    const action = getAgentSessionV2DesktopActionName(options.args);
    if (!['launch_local_app', 'open_resource', 'search_web'].includes(action)) {
      return null;
    }

    const text = `${options.sourceText} ${options.userGoal}`.trim();
    if (!hasAgentProductionWindowMoveToDisplayRequest(text)) {
      return null;
    }

    const target = getAgentProductionOpenWindowTarget(options.args);
    const targetDisplay = typeof options.args.targetDisplay === 'string' && options.args.targetDisplay.trim()
      ? options.args.targetDisplay.trim()
      : inferAgentProductionDisplayTargetFromText(text);
    if (!target || !targetDisplay) {
      return null;
    }

    const sequenceInput = createAgentRuntimeCoreOpenMoveSequenceInput({
      forceNew: options.args.forceNew === true,
      sourceText: options.sourceText,
      target,
      targetDisplay,
      toolName: action === 'search_web' ? 'search_web' : 'execute_desktop_action',
    });
    if (!hasAgentProductionMaximizeWindowRequest(text)) {
      return sequenceInput;
    }

    const steps = JSON.parse(sequenceInput.stepsJson) as Array<Record<string, unknown>>;
    steps.push({
      args: {
        action: 'control_window',
        windowState: 'maximized',
      },
      reason: `Maximize the resulting window after moving it to ${targetDisplay}.`,
      tool: 'execute_desktop_action',
    });
    return {
      ...sequenceInput,
      stepsJson: JSON.stringify(steps),
    };
  }

  function createAgentProductionObservedDisplayOpenMoveApproval(options: {
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }): AgentProductionPendingApproval | null {
    const displayEvidenceEntry = [...options.toolResults]
      .reverse()
      .find(hasAgentSessionV2DisplayObservationEvidence);
    if (!displayEvidenceEntry) {
      return null;
    }

    const previousDispatchExists = options.toolResults.slice(0, -1).some((entry) => {
      const toolName = entry.command.toolCall?.name;
      if (toolName === 'execute_desktop_sequence') {
        return true;
      }
      if (toolName !== 'execute_desktop_action') {
        return false;
      }
      return [
        'launch_local_app',
        'open_resource',
        'search_web',
        'move_window_to_display',
      ].includes(getAgentSessionV2DesktopActionName(entry.command.toolCall?.input));
    });
    if (previousDispatchExists) {
      return null;
    }

    const intentText = `${options.sourceText} ${options.userGoal}`.trim();
    if (!hasAgentProductionWindowMoveToDisplayRequest(intentText)) {
      return null;
    }

    const sourceExistingWindowTarget = extractPlannerExistingWindowMoveTargetFromText(options.sourceText);
    const goalExistingWindowTarget = extractPlannerExistingWindowMoveTargetFromText(options.userGoal);
    const existingWindowTarget = sourceExistingWindowTarget || goalExistingWindowTarget;
    const textWindowQueryCandidates = [
      sourceExistingWindowTarget,
      goalExistingWindowTarget,
    ].filter((candidate, index, candidates): candidate is string => (
      Boolean(candidate)
      && candidates.findIndex((value) => value.toLowerCase() === candidate.toLowerCase()) === index
    ));
    const observedWindowTarget = resolveAgentObservedWindowTargetEvidence({
      queryCandidates: textWindowQueryCandidates,
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    });
    const existingWindowQueryCandidates = [
      ...textWindowQueryCandidates,
      observedWindowTarget?.processName,
      observedWindowTarget?.title,
    ].filter((candidate, index, candidates): candidate is string => (
      Boolean(candidate)
      && candidates.findIndex((value) => value?.toLowerCase() === candidate.toLowerCase()) === index
    ));
    const target = existingWindowTarget
      || extractPlannerOpenAndMoveTargetFromText(options.sourceText)
      || extractPlannerOpenAndMoveTargetFromText(options.userGoal);
    const targetDisplay = normalizePlannerDisplayMoveTarget(options.sourceText)
      || normalizePlannerDisplayMoveTarget(options.userGoal)
      || inferAgentProductionDisplayTargetFromText(intentText);
    if (!target || !targetDisplay) {
      return null;
    }
    const resolvedExistingWindowTarget = observedWindowTarget?.processName?.trim()
      || observedWindowTarget?.title?.trim()
      || existingWindowTarget;

    const sequenceInput = existingWindowTarget
      ? {
          action: 'move_window_to_display',
          fallbackToActiveWindow: false,
          ...(observedWindowTarget?.hwnd ? { hwnd: observedWindowTarget.hwnd } : {}),
          ...(observedWindowTarget?.pid ? { pid: observedWindowTarget.pid } : {}),
          ...(observedWindowTarget?.processName?.trim()
            ? { processName: observedWindowTarget.processName.trim() }
            : {}),
          ...(observedWindowTarget?.title?.trim()
            ? { title: observedWindowTarget.title.trim() }
            : {}),
          queryCandidates: existingWindowQueryCandidates,
          target: resolvedExistingWindowTarget,
          targetDisplay,
        }
      : createAgentRuntimeCoreOpenMoveSequenceInput({
          sourceText: options.sourceText,
          target,
          targetDisplay,
          toolName: /(?:\bbrowser\b|\u6d4f\u89c8\u5668)/iu.test(intentText)
            ? 'search_web'
            : 'execute_desktop_action',
        });
    const command = createAgentToolCommand({
      args: sequenceInput,
      sourceText: options.sourceText,
      toolName: existingWindowTarget ? 'execute_desktop_action' : 'execute_desktop_sequence',
      userGoal: options.userGoal,
    });
    const route = buildAgentPermissionRoute(command);
    if (!route.plan || route.blockedStep || !route.requiresApproval) {
      return null;
    }

    return {
      command,
      plan: route.plan,
      reason: createAgentApprovalRequiredToolReason({
        decisionReason: existingWindowTarget
          ? `Display evidence is ready; move the existing window for ${target}.`
          : `Display evidence is ready; continue the open-and-move task for ${target}.`,
        permissionSummary: route.summary,
      }),
      routeSummary: route.summary,
    };
  }

  function isAgentProductionDisplayInfoObservationArgs(args: Record<string, unknown> | undefined) {
    const action = typeof args?.action === 'string' ? args.action.trim() : '';
    return AGENT_PRODUCTION_DISPLAY_INFO_ACTION_PATTERN.test(action);
  }

  function shouldRedirectAgentProductionDisplayInfoToDesktopItems(options: {
    args: Record<string, unknown> | undefined;
    sourceText: string;
    toolName: string;
    userGoal: string;
  }) {
    const text = `${options.sourceText} ${options.userGoal}`;
    if (!hasAgentProductionDesktopItemInventoryRequest(text)) {
      return false;
    }

    return options.toolName === 'get_display_info'
      || (
        options.toolName === 'execute_desktop_observation'
        && isAgentProductionDisplayInfoObservationArgs(options.args)
      );
  }

  const AGENT_PRODUCTION_READ_ONLY_DESKTOP_ACTION_REDIRECTS = new Set([
    'list_running_apps',
  ]);

  function shouldRedirectAgentProductionReadOnlyDesktopActionToObservation(options: {
    args: Record<string, unknown> | undefined;
    toolName: string;
  }) {
    return options.toolName === 'execute_desktop_action'
      && AGENT_PRODUCTION_READ_ONLY_DESKTOP_ACTION_REDIRECTS.has(getAgentSessionV2DesktopActionName(options.args));
  }

  function createAgentProductionReadOnlyDesktopActionObservationRedirectArgs(options: {
    args: Record<string, unknown> | undefined;
  }) {
    return {
      ...(options.args ?? {}),
      action: getAgentSessionV2DesktopActionName(options.args),
    };
  }

  function createAgentProductionDesktopItemObservationRedirectArgs(options: {
    args: Record<string, unknown> | undefined;
    sourceText: string;
    userGoal: string;
  }) {
    const displayTarget = typeof options.args?.displayTarget === 'string' && options.args.displayTarget.trim()
      ? options.args.displayTarget.trim()
      : inferAgentProductionDisplayTargetFromText(`${options.sourceText} ${options.userGoal}`) ?? 'all';

    return {
      ...(options.args ?? {}),
      action: 'list_desktop_items',
      displayTarget,
    };
  }

  return {
    hasAgentProductionDesktopOrganizationRequest,
    hasAgentProductionWindowMoveToDisplayRequest,
    inferAgentProductionDisplayTargetFromText,
    getAgentProductionOpenWindowTarget,
    createAgentProductionOpenMoveSequenceRedirect,
    createAgentProductionObservedDisplayOpenMoveApproval,
    shouldRedirectAgentProductionDisplayInfoToDesktopItems,
    shouldRedirectAgentProductionReadOnlyDesktopActionToObservation,
    createAgentProductionReadOnlyDesktopActionObservationRedirectArgs,
    createAgentProductionDesktopItemObservationRedirectArgs,
  };
}
