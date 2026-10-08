import {
  type WindowUiActionResultLike,
  createWindowUiMissingValueResult,
  createWindowUiInteractionStructuredEvidence,
} from './windowUiInteractionEvidence';
import {
  desktopPetShellRuntime,
} from '../../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  getToolStringInput,
  getToolNumberInput,
} from './desktopToolInput';

function normalizeWindowUiAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'click':
    case 'invoke':
    case 'invoke_pattern':
      return 'invoke';
    case 'select':
    case 'select_item':
      return 'select';
    case 'toggle':
    case 'check':
    case 'uncheck':
      return 'toggle';
    case 'expand':
    case 'expand_control':
      return 'expand';
    case 'collapse':
    case 'collapse_control':
      return 'collapse';
    case 'focus':
    case 'set_focus':
    case 'focus_control':
    case 'focus_window_ui':
    case 'keyboard_focus':
      return 'focus';
    case 'scroll':
    case 'scroll_into_view':
    case 'scroll_item':
    case 'scroll_item_into_view':
      return 'scroll_into_view';
    case 'set_text':
    case 'set_value':
    case 'value':
      return 'set_value';
    case 'auto':
      return 'auto';
    default:
      return '';
  }
}

function resolveWindowUiAction(toolCall: AgentToolCallCommand, normalizedDesktopAction: string) {
  const explicitUiAction = normalizeWindowUiAction(getToolStringInput(toolCall, [
    'uiAction',
    'uiaAction',
    'controlAction',
    'pattern',
  ]));
  if (explicitUiAction) {
    return explicitUiAction;
  }

  const rawDesktopAction = getToolStringInput(toolCall, ['action', 'desktopAction', 'operation'])
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/gu, '_');
  if (rawDesktopAction.includes('select')) {
    return 'select';
  }
  if (rawDesktopAction.includes('toggle')) {
    return 'toggle';
  }
  if (rawDesktopAction.includes('expand')) {
    return 'expand';
  }
  if (rawDesktopAction.includes('collapse')) {
    return 'collapse';
  }
  if (rawDesktopAction.includes('focus')) {
    return 'focus';
  }
  if (rawDesktopAction.includes('scroll')) {
    return 'scroll_into_view';
  }
  if (rawDesktopAction.includes('value') || rawDesktopAction.includes('text')) {
    return 'set_value';
  }
  if (rawDesktopAction.includes('invoke') || rawDesktopAction.includes('click')) {
    return 'invoke';
  }

  return normalizedDesktopAction === 'invoke_window_ui' ? 'invoke' : 'auto';
}

export async function executeWindowUiInteraction(
  toolCall: AgentToolCallCommand,
  normalizedDesktopAction: string,
): Promise<AgentChatCommandResult> {
  const targetText = getToolStringInput(toolCall, ['targetText', 'text', 'label', 'name', 'target']);
  const automationId = getToolStringInput(toolCall, ['automationId', 'id']);
  const controlType = getToolStringInput(toolCall, ['controlType', 'type']);
  const query = getToolStringInput(toolCall, ['query', 'windowTitle', 'title', 'processName', 'target']);
  const uiAction = resolveWindowUiAction(toolCall, normalizedDesktopAction);
  const value = getToolStringInput(toolCall, ['value', 'textValue', 'inputValue']);
  const x = getToolNumberInput(toolCall, 'x');
  const y = getToolNumberInput(toolCall, 'y');
  if (!targetText && !automationId && (!Number.isFinite(x) || !Number.isFinite(y))) {
    return {
      errorText: 'Missing invoke_window_ui target.',
      observations: [`Desktop action: ${normalizedDesktopAction}`, 'Missing targetText, automationId, or x/y point.'],
      ok: false,
      responseText: 'invoke_window_ui needs UI Automation target evidence such as targetText, automationId, or a native-screen point. controlType is only supporting evidence.',
    };
  }
  if (uiAction === 'set_value' && !value) {
    return createWindowUiMissingValueResult({
      automationId,
      controlType,
      normalizedDesktopAction,
      query,
      targetText,
      uiAction,
    });
  }

  const result = await desktopPetShellRuntime.invokeWindowUi({
    automationId,
    controlType,
    fallbackX: getToolNumberInput(toolCall, 'fallbackX'),
    fallbackY: getToolNumberInput(toolCall, 'fallbackY'),
    hwnd: getToolNumberInput(toolCall, 'hwnd') ?? getToolNumberInput(toolCall, 'windowHandle'),
    limit: getToolNumberInput(toolCall, 'limit'),
    maxDepth: getToolNumberInput(toolCall, 'maxDepth'),
    name: getToolStringInput(toolCall, ['name']),
    query,
    target: getToolStringInput(toolCall, ['target']),
    targetDescription: getToolStringInput(toolCall, ['targetDescription', 'description', 'element']),
    targetText,
    title: getToolStringInput(toolCall, ['title', 'windowTitle']),
    uiAction,
    value,
    x,
    y,
  }) as WindowUiActionResultLike;
  const control = result?.control ?? null;
  const windowLabel = result?.window?.title || result?.window?.processName || query || 'target window';
  const controlLabel = control?.name || control?.automationId || targetText || automationId || 'target control';
  const candidateCount = Array.isArray(result?.candidates) ? result.candidates.length : 0;
  const structuredEvidence = createWindowUiInteractionStructuredEvidence(result ?? {}, {
    automationId,
    controlType,
    normalizedDesktopAction,
    targetText,
    uiAction,
  });
  const recoveryLine = structuredEvidence?.postActionRecovery?.nextTool
    ? `Recovery: ${structuredEvidence.postActionRecovery.strategy ?? 'none'} -> ${structuredEvidence.postActionRecovery.nextTool}`
    : '';
  const observations = [
    `Desktop action: ${normalizedDesktopAction}`,
    `Window: ${windowLabel}`,
    typeof result?.window?.hwnd === 'number' ? `Window hwnd: ${result.window.hwnd}` : '',
    `Control: ${controlLabel}`,
    control?.automationId ? `AutomationId: ${control.automationId}` : '',
    control?.controlType ? `Control type: ${control.controlType}` : '',
    control?.selectionItem ? `Selection item: true` : '',
    control?.selectionItem ? `Selected after action: ${control.selected === true}` : '',
    Number.isFinite(Number(control?.matchScore)) ? `Match score: ${Math.round(Number(control?.matchScore))}` : '',
    `Requested UI action: ${result?.uiAction || uiAction || 'auto'}`,
    result?.resolvedAction ? `Resolved UI action: ${result.resolvedAction}` : '',
    result?.method ? `Method: ${result.method}` : '',
    `Candidate count: ${candidateCount}`,
    recoveryLine,
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const stateSummary = structuredEvidence
    ? {
        missingEvidence: result?.ok
          ? structuredEvidence.selectionVerificationStatus === 'visible-only'
            ? ['UI Automation action was applied, but the target control was not confirmed as selected afterward.']
            : []
          : [
              result?.error || 'UI Automation interaction failed.',
            ],
        observedState: observations,
        recommendedRecovery: structuredEvidence.postActionRecovery
          ? [
              [
                `postActionRecoveryStrategy=${structuredEvidence.postActionRecovery.strategy}`,
                structuredEvidence.postActionRecovery.nextTool ? `nextTool=${structuredEvidence.postActionRecovery.nextTool}` : '',
                structuredEvidence.postActionRecovery.nextArgs ? `nextArgs=${JSON.stringify(structuredEvidence.postActionRecovery.nextArgs)}` : '',
                structuredEvidence.postActionRecovery.reason ? `reason=${structuredEvidence.postActionRecovery.reason}` : '',
              ].filter(Boolean).join(' | '),
            ]
          : [],
        structuredEvidence,
        verificationEvidence: [
          result?.ok
            ? structuredEvidence.selectionVerificationStatus === 'selected'
              ? 'UI Automation reported the control action as applied and selection state is selected.'
              : 'UI Automation reported the control action as applied.'
            : 'UI Automation returned matched control evidence and recovery details.',
        ],
      }
    : undefined;

  return {
    errorText: result?.ok ? null : result?.error || 'Window UI invoke failed.',
    observations,
    ok: Boolean(result?.ok),
    receipt: {
      evidenceLines: observations,
      status: result?.ok && structuredEvidence?.selectionVerificationStatus !== 'visible-only' ? 'success' : result?.ok ? 'unverified' : 'failed',
      summaryLines: [
        `Call: execute_desktop_action ${normalizedDesktopAction}`,
        `Window: ${windowLabel}`,
        `Control: ${controlLabel}`,
        `UI action: ${result?.resolvedAction || result?.uiAction || uiAction || 'auto'}`,
      ],
      title: 'Agent window UI invoke',
      toolName: 'execute_desktop_action',
      verification: result?.ok
        ? structuredEvidence?.selectionVerificationStatus === 'visible-only'
          ? 'UI Automation control action returned success, but selected state was not confirmed.'
          : 'UI Automation control action returned success.'
        : result?.error ?? null,
      stateSummary,
    },
    responseText: result?.ok
      ? `Applied UI Automation action "${result?.resolvedAction || result?.uiAction || uiAction || 'auto'}" to "${controlLabel}" in ${windowLabel}.`
      : `Window UI interaction failed: ${result?.error || 'unknown error'}.`,
    stateSummary,
    verification: result?.ok
      ? structuredEvidence?.selectionVerificationStatus === 'visible-only'
        ? `UI Automation applied ${result?.resolvedAction || result?.uiAction || uiAction || 'auto'} to ${controlLabel} in ${windowLabel}, but selected state was not confirmed.`
        : `UI Automation applied ${result?.resolvedAction || result?.uiAction || uiAction || 'auto'} to ${controlLabel} in ${windowLabel}.`
      : result?.error || null,
  };
}
