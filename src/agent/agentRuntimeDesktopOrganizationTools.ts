import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentChatFollowUpAction,
  type AgentDesktopObservationStats,
  type AgentDesktopOrganizationCommand,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { resolveSafeDesktopOrganizationScope } from './desktopOrganizationScopePolicy';
import { type DesktopIconArrangementPlan } from './desktopIconArrangementPlan';

export interface AgentRuntimeDesktopOrganizationResult {
  errorText?: string | null;
  followUp?: string | null;
  observations?: string[];
  ok?: boolean;
  observationStats?: AgentDesktopObservationStats | null;
  plan?: DesktopIconArrangementPlan | null;
  previewSummaryLines?: string[];
  previewWarning?: string | null;
  responseText: string;
  started: boolean;
  verification?: string | null;
}

export interface AgentDesktopOrganizationAdapter {
  preview: (organization?: AgentDesktopOrganizationCommand) => (
    Promise<AgentRuntimeDesktopOrganizationResult> | AgentRuntimeDesktopOrganizationResult
  );
  start: (
    organization?: AgentDesktopOrganizationCommand,
    existingPlan?: DesktopIconArrangementPlan | null,
  ) => Promise<AgentRuntimeDesktopOrganizationResult> | AgentRuntimeDesktopOrganizationResult;
}

export interface AgentRuntimeDesktopIconPlacementResult {
  errorText?: string | null;
  followUp?: string | null;
  observations?: string[];
  ok?: boolean;
  plan?: DesktopIconArrangementPlan | null;
  responseText: string;
  started: boolean;
  verification?: string | null;
}

export interface AgentRuntimeDesktopOrganizationContext {
  desktopOrganizationRef: { current: AgentDesktopOrganizationAdapter | null };
  lastDesktopOrganizationPlanRef: { current: DesktopIconArrangementPlan | null };
  startDesktopIconPlacementRef: {
    current: (
      ((placement: NonNullable<AgentChatCommand['desktopIconPlacement']>) => (
        Promise<AgentRuntimeDesktopIconPlacementResult> | AgentRuntimeDesktopIconPlacementResult
      ))
      | null
    );
  };
}

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeToolDisplayTargetValue(value: string): AgentDesktopOrganizationCommand['displayTarget'] | undefined {
  return value === 'primary' || value === 'secondary' || value === 'current' || value === 'all'
    ? value
    : undefined;
}

function getToolDisplayTargetInput(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand['displayTarget'] | undefined {
  return normalizeToolDisplayTargetValue(getToolStringInput(toolCall, ['targetDisplay', 'displayTarget', 'display']));
}

function getToolSourceDisplayInput(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand['sourceDisplay'] | undefined {
  return normalizeToolDisplayTargetValue(getToolStringInput(toolCall, ['sourceDisplay', 'sourceDisplayTarget']));
}

function normalizeToolDesktopOrganizationScopeValue(value: string): AgentDesktopOrganizationCommand['scope'] | undefined {
  return value === 'all-icons' || value === 'display-icons'
    ? value
    : undefined;
}

function getToolDesktopOrganizationScopeInput(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand['scope'] | undefined {
  return normalizeToolDesktopOrganizationScopeValue(getToolStringInput(toolCall, ['sourceScope', 'scope', 'iconScope']));
}

function getToolDesktopOrganizationModeInput(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand['mode'] | undefined {
  const value = getToolStringInput(toolCall, ['mode', 'actionMode']);
  return value === 'execute' || value === 'preview'
    ? value
    : undefined;
}

function getToolDesktopOrganizationGroupByInput(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand['groupBy'] | undefined {
  const value = getToolStringInput(toolCall, ['groupBy', 'group', 'grouping', 'groupStrategy']);
  return value === 'none' || value === 'kind' || value === 'category' || value === 'extension'
    ? value
    : undefined;
}

function getToolDesktopOrganizationPlacementIntentInput(toolCall: AgentToolCallCommand): string | undefined {
  return getToolStringInput(toolCall, [
    'placementIntent',
    'layoutIntent',
    'placementGoal',
    'arrangementIntent',
    'intent',
  ]) || undefined;
}

function createDesktopOrganizationExecutionReceipt(options: {
  commandName: string;
  placementIntent?: string;
  responseText: string;
  started: boolean;
  ok?: boolean;
  verification?: string | null;
}): AgentChatExecutionReceipt {
  const status: AgentChatExecutionReceipt['status'] = !options.started
    ? 'failed'
    : options.ok === false
      ? 'unverified'
      : 'success';

  return {
    evidenceLines: [
      options.started ? '工具阶段：已调用桌面图标移动流程。' : '工具阶段：未启动桌面图标移动流程。',
      options.placementIntent ? `Placement intent: ${options.placementIntent}` : '',
      options.verification ? `验证：${options.verification}` : '',
    ].filter(Boolean),
    status,
    summaryLines: [
      `调用：${options.commandName}`,
      options.started
        ? '结果：工具已返回执行结果'
        : '结果：工具未能启动',
      options.ok === false && options.started
        ? '验证：执行后复查未通过'
        : '',
      options.placementIntent ? `Intent: ${options.placementIntent.slice(0, 160)}` : '',
      options.responseText ? `回复依据：${options.responseText.slice(0, 160)}` : '',
    ].filter(Boolean),
    title: '执行回执',
    toolName: options.commandName,
    verification: options.verification ?? null,
  };
}

function createDesktopOrganizationPreviewStateSummary(
  hasPlan: boolean,
  placementIntent?: string,
): NonNullable<AgentChatCommandResult['stateSummary']> {
  return {
    missingEvidence: hasPlan
      ? ['missing:desktop-organization-execution']
      : ['missing:desktop-organization-plan'],
    observedState: hasPlan
      ? [
          'Desktop organization preview prepared a plan without moving icons.',
          placementIntent ? `Desktop organization placement intent: ${placementIntent}` : '',
        ].filter(Boolean)
      : ['Desktop organization preview did not produce an executable plan.'],
    recommendedRecovery: hasPlan
      ? ['tool:organize_desktop_icons mode=execute']
      : ['tool:organize_desktop_icons mode=preview'],
    verificationEvidence: hasPlan
      ? ['Preview mode is preflight evidence only; icon positions have not been changed.']
      : ['Preview mode completed without an executable move plan.'],
  };
}

function createDesktopOrganizationPreviewReceipt(options: {
  hasPlan: boolean;
  placementIntent?: string;
  responseText: string;
  verification?: string | null;
}): AgentChatExecutionReceipt {
  const stateSummary = createDesktopOrganizationPreviewStateSummary(options.hasPlan, options.placementIntent);

  return {
    evidenceLines: [
      options.hasPlan
        ? 'Desktop organization preview prepared a plan but did not move icons.'
        : 'Desktop organization preview did not prepare an executable plan.',
      options.placementIntent ? `Placement intent: ${options.placementIntent}` : '',
      options.verification ? `Verification: ${options.verification}` : '',
    ].filter(Boolean),
    stateSummary,
    status: 'unverified',
    summaryLines: [
      'Call: organize_desktop_icons preview',
      options.hasPlan
        ? 'Result: plan prepared; execution still requires approval.'
        : 'Result: no executable organization plan was prepared.',
      options.placementIntent ? `Intent: ${options.placementIntent.slice(0, 160)}` : '',
      options.responseText ? `Response evidence: ${options.responseText.slice(0, 160)}` : '',
    ].filter(Boolean),
    title: 'Desktop organization preview receipt',
    toolName: 'organize_desktop_icons',
    verification: options.verification ?? null,
  };
}

function createDesktopOrganizationExecuteCommand(
  sourceText: string,
  organization?: AgentDesktopOrganizationCommand,
): AgentChatCommand {
  const displayTarget = organization?.targetDisplay ?? organization?.displayTarget;
  const scope = organization?.sourceScope ?? organization?.scope;
  return {
    capabilityId: 'desktop-organization',
    desktopOrganization: {
      displayTarget,
      groupBy: organization?.groupBy,
      mode: 'execute',
      placementIntent: organization?.placementIntent,
      scope,
      sourceDisplay: organization?.sourceDisplay,
      sourceScope: scope,
      targetDisplay: displayTarget,
    },
    instruction: '执行刚才的桌面整理计划',
    kind: 'desktop-organization',
    sourceText,
  };
}

function createDesktopOrganizationPreviewCommand(
  sourceText: string,
  organization?: AgentDesktopOrganizationCommand,
): AgentChatCommand {
  const displayTarget = organization?.targetDisplay ?? organization?.displayTarget;
  const scope = organization?.sourceScope ?? organization?.scope;
  return {
    capabilityId: 'desktop-organization',
    desktopOrganization: {
      displayTarget,
      groupBy: organization?.groupBy,
      mode: 'preview',
      placementIntent: organization?.placementIntent,
      scope,
      sourceDisplay: organization?.sourceDisplay,
      sourceScope: scope,
      targetDisplay: displayTarget,
    },
    instruction: '重新观察桌面并生成整理计划',
    kind: 'desktop-organization',
    sourceText,
  };
}

function createDesktopOrganizationFollowUpActions(
  organization: AgentDesktopOrganizationCommand,
): AgentChatFollowUpAction[] {
  return [
    {
      command: createDesktopOrganizationExecuteCommand('继续：执行刚才的桌面整理计划', organization),
      kind: 'run-command',
      label: '执行计划',
      requiresApproval: true,
    },
    {
      command: createDesktopOrganizationPreviewCommand('继续：重新观察桌面并生成整理计划', organization),
      kind: 'run-command',
      label: '重新观察',
    },
  ];
}

function createDesktopOrganizationCommandFromToolCall(toolCall: AgentToolCallCommand): AgentDesktopOrganizationCommand {
  const scope = getToolDesktopOrganizationScopeInput(toolCall);
  const displayTarget = getToolDisplayTargetInput(toolCall);
  return {
    displayTarget,
    groupBy: getToolDesktopOrganizationGroupByInput(toolCall),
    mode: getToolDesktopOrganizationModeInput(toolCall),
    placementIntent: getToolDesktopOrganizationPlacementIntentInput(toolCall),
    scope,
    sourceDisplay: getToolSourceDisplayInput(toolCall),
    sourceScope: scope,
    targetDisplay: displayTarget,
  };
}

export function createDesktopOrganizationFollowUpActionFromToolCall(
  toolCall: AgentToolCallCommand,
): AgentChatFollowUpAction | null {
  if (getToolDesktopOrganizationModeInput(toolCall) === 'execute') {
    return null;
  }

  return createDesktopOrganizationFollowUpActions(createDesktopOrganizationCommandFromToolCall(toolCall))[0] ?? null;
}

export async function executeDesktopOrganization(
  context: AgentRuntimeDesktopOrganizationContext,
  organization: AgentDesktopOrganizationCommand,
  sourceText = '',
): Promise<AgentChatCommandResult> {
  const desktopOrganization = context.desktopOrganizationRef.current;

  if (!desktopOrganization) {
    return {
      errorText: '桌面整理还没有准备好，请稍后再试。',
      ok: false,
      responseText: '桌面整理还没有准备好，请稍后再试。',
    };
  }

  const displayTarget = organization.targetDisplay ?? organization.displayTarget;
  const requestedScope = organization.sourceScope ?? organization.scope;
  const structuredIntent = Boolean(
    organization.targetDisplay
    || organization.sourceDisplay
    || organization.sourceScope,
  );
  const safeScope = resolveSafeDesktopOrganizationScope({
    displayTarget,
    requestedScope,
    sourceText,
    structuredIntent,
  });
  const safeOrganization: AgentDesktopOrganizationCommand = {
    ...organization,
    displayTarget,
    scope: safeScope,
    sourceScope: safeScope,
    targetDisplay: displayTarget,
  };

  if (organization.mode === 'execute') {
    if (!context.lastDesktopOrganizationPlanRef.current) {
      return {
        errorText: '我这里还没有上一份可执行的桌面整理计划。',
        ok: false,
        responseText: '我这里还没有上一份可执行的桌面整理计划。先让我观察并列出计划，再说“执行刚才的整理计划”。',
      };
    }

    const result = await desktopOrganization.start(safeOrganization, context.lastDesktopOrganizationPlanRef.current);
    if (result.started) {
      context.lastDesktopOrganizationPlanRef.current = null;
    }

    return {
      errorText: result.errorText ?? null,
      followUp: result.followUp ?? (result.ok === false ? '可以重新观察桌面后再生成一份新计划。' : null),
      observations: result.observations,
      ok: result.ok,
      receipt: createDesktopOrganizationExecutionReceipt({
        commandName: 'desktop-organization',
        ok: result.ok,
        placementIntent: safeOrganization.placementIntent,
        responseText: result.responseText,
        started: result.started,
        verification: result.verification,
      }),
      responseText: result.responseText,
      verification: result.verification,
    };
  }

  const result = await desktopOrganization.preview({
    ...safeOrganization,
    mode: 'preview',
  });
  context.lastDesktopOrganizationPlanRef.current = result.plan ?? null;
  const previewOk = result.ok ?? Boolean(result.plan);
  const followUpActions = result.plan
    ? createDesktopOrganizationFollowUpActions(safeOrganization)
    : null;

  return {
    errorText: previewOk ? null : result.errorText ?? result.responseText,
    followUp: result.plan
      ? '如果这个整理计划没问题，可以继续执行；如果桌面状态变了，也可以重新观察。'
      : null,
    followUpAction: followUpActions?.[0] ?? null,
    followUpActions,
    observations: result.observations,
    ok: previewOk,
    observationStats: result.observationStats,
    previewSummaryLines: result.previewSummaryLines,
    previewWarning: result.previewWarning,
    receipt: createDesktopOrganizationPreviewReceipt({
      hasPlan: Boolean(result.plan),
      placementIntent: safeOrganization.placementIntent,
      responseText: result.responseText,
      verification: result.verification,
    }),
    responseText: result.responseText,
    stateSummary: createDesktopOrganizationPreviewStateSummary(Boolean(result.plan), safeOrganization.placementIntent),
    verification: result.verification,
  };
}

export function executeDesktopOrganizationToolCall(
  context: AgentRuntimeDesktopOrganizationContext,
  toolCall: AgentToolCallCommand,
  sourceText = '',
) {
  return executeDesktopOrganization(
    context,
    createDesktopOrganizationCommandFromToolCall(toolCall),
    sourceText,
  );
}

export async function executeDesktopIconPlacement(
  context: AgentRuntimeDesktopOrganizationContext,
  placement: NonNullable<AgentChatCommand['desktopIconPlacement']>,
): Promise<AgentChatCommandResult> {
  const startDesktopIconPlacement = context.startDesktopIconPlacementRef.current;

  if (!startDesktopIconPlacement) {
    return {
      errorText: '单图标整理还没有准备好，请稍后再试。',
      ok: false,
      responseText: '单图标整理还没有准备好，请稍后再试。',
    };
  }

  const result = await startDesktopIconPlacement(placement);

  return {
    errorText: result.errorText ?? null,
    followUp: result.followUp ?? (result.ok === false ? '可以重新观察桌面图标后再试一次。' : null),
    observations: result.observations,
    ok: result.ok,
    receipt: createDesktopOrganizationExecutionReceipt({
      commandName: 'desktop-icon-placement',
      ok: result.ok,
      responseText: result.responseText,
      started: result.started,
      verification: result.verification,
    }),
    responseText: result.responseText,
    verification: result.verification,
  };
}

export function executeDesktopIconPlacementToolCall(
  context: AgentRuntimeDesktopOrganizationContext,
  toolCall: AgentToolCallCommand,
) {
  const direction = toolCall.input.direction;
  const placement = {
    anchorName: getToolStringInput(toolCall, ['anchorName', 'anchor']),
    direction,
    targetName: getToolStringInput(toolCall, ['targetName', 'target']),
  };

  if (
    !placement.anchorName
    || !placement.targetName
    || (
      placement.direction !== 'above'
      && placement.direction !== 'below'
      && placement.direction !== 'left-of'
      && placement.direction !== 'right-of'
    )
  ) {
    return {
      responseText: '移动单个桌面图标时，需要目标图标、参照图标和上下左右方向。',
    };
  }

  return executeDesktopIconPlacement(context, {
    anchorName: placement.anchorName,
    direction: placement.direction,
    targetName: placement.targetName,
  });
}
