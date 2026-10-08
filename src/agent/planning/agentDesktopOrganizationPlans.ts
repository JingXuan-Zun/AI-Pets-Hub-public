import {
  type AgentChatCommand,
  type AgentDesktopOrganizationCommand,
  type AgentDesktopOrganizationDisplayTarget,
  type AgentDesktopOrganizationMode,
  type AgentDesktopOrganizationScope,
} from '../agentChatCommand';
import { type AgentExecutionPlan, createPlanStep, getToolCallTargetDescription } from './agentPlanShared';

function normalizeDesktopOrganizationDisplayTarget(value: unknown): AgentDesktopOrganizationDisplayTarget | undefined {
  return value === 'primary' || value === 'secondary' || value === 'current' || value === 'all'
    ? value
    : undefined;
}

function normalizeDesktopOrganizationScope(value: unknown): AgentDesktopOrganizationScope | undefined {
  return value === 'all-icons' || value === 'display-icons'
    ? value
    : undefined;
}

function normalizeDesktopOrganizationMode(value: unknown): AgentDesktopOrganizationMode {
  return value === 'execute' ? 'execute' : 'preview';
}

function normalizeDesktopOrganizationGroupBy(value: unknown): AgentDesktopOrganizationCommand['groupBy'] | undefined {
  return value === 'none' || value === 'kind' || value === 'category' || value === 'extension'
    ? value
    : undefined;
}

function getDesktopOrganizationOptions(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const displayTarget = normalizeDesktopOrganizationDisplayTarget(
    command.desktopOrganization?.targetDisplay
      ?? command.desktopOrganization?.displayTarget
      ?? input.targetDisplay
      ?? input.displayTarget
      ?? input.display,
  );
  const groupBy = normalizeDesktopOrganizationGroupBy(
    command.desktopOrganization?.groupBy ?? input.groupBy ?? input.group ?? input.grouping ?? input.groupStrategy,
  );
  const scope = normalizeDesktopOrganizationScope(
    command.desktopOrganization?.sourceScope
      ?? command.desktopOrganization?.scope
      ?? input.sourceScope
      ?? input.scope
      ?? input.iconScope,
  );
  const mode = normalizeDesktopOrganizationMode(
    command.desktopOrganization?.mode ?? input.mode ?? input.actionMode,
  );

  return {
    displayTarget,
    groupBy,
    mode,
    scope,
  };
}

function getDesktopOrganizationGroupText(groupBy?: AgentDesktopOrganizationCommand['groupBy']) {
  if (groupBy === 'category') {
    return '按类别分组';
  }

  if (groupBy === 'kind') {
    return '按项目类型分组';
  }

  if (groupBy === 'extension') {
    return '按扩展名分组';
  }

  return '不额外分组';
}

function getDisplayTargetText(displayTarget?: AgentDesktopOrganizationDisplayTarget) {
  if (displayTarget === 'secondary') {
    return '副屏';
  }

  if (displayTarget === 'primary') {
    return '主屏';
  }

  if (displayTarget === 'current') {
    return '当前屏幕';
  }

  return '桌面';
}

function getDesktopOrganizationScopeText(scope?: AgentDesktopOrganizationScope, displayTarget?: AgentDesktopOrganizationDisplayTarget) {
  if (scope === 'display-icons') {
    return `只整理当前位于${getDisplayTargetText(displayTarget)}范围内的图标`;
  }

  if (scope === 'all-icons' && displayTarget && displayTarget !== 'all') {
    return `把桌面图标整理到${getDisplayTargetText(displayTarget)}工作区内`;
  }

  return '整理桌面图标';
}

export function buildDesktopOrganizationPlan(command: AgentChatCommand): AgentExecutionPlan {
  const options = getDesktopOrganizationOptions(command);
  const displayTargetText = getDisplayTargetText(options.displayTarget);
  const scopeText = getDesktopOrganizationScopeText(options.scope, options.displayTarget);
  const isExecuteMode = options.mode === 'execute';
  const groupText = options.groupBy && options.groupBy !== 'none'
    ? getDesktopOrganizationGroupText(options.groupBy)
    : null;
  const details = [
    groupText ? `分组策略：${groupText}` : '',
    isExecuteMode
      ? '模式：执行刚才预览过的桌面整理计划，会移动图标。'
      : '模式：先观察并生成整理计划，不移动图标。',
    options.displayTarget ? `目标显示器：${displayTargetText}` : '',
    options.scope ? `整理范围：${scopeText}` : '',
    options.displayTarget === 'secondary' ? '如果没有检测到副屏，会停止并提示原因。' : '',
  ].filter(Boolean);

  return {
    commandKind: command.kind,
    goal: isExecuteMode
      ? '执行刚才的桌面整理计划'
      : `预览${scopeText}`,
    instruction: command.instruction,
    steps: [
      ...(options.displayTarget ? [
        createPlanStep(
          'read-display-info',
          'read-display-info',
          `读取显示器布局并定位${displayTargetText}`,
          {
            details,
            requiresDesktopMode: true,
            targetDescription: displayTargetText,
          },
        ),
      ] : []),
      createPlanStep(
        'list-desktop-icons',
        'list-desktop-icons',
        '读取桌面图标列表和当前位置',
        {
          details,
          requiresDesktopMode: true,
          targetDescription: '桌面图标',
        },
      ),
      isExecuteMode
        ? createPlanStep(
            'move-desktop-icon',
            'move-desktop-icon',
            '按上一份预览计划移动桌面图标',
            {
              details,
              estimatedItemCount: 20,
              requiresDesktopMode: true,
              reversible: true,
              targetDescription: options.displayTarget ? `${displayTargetText}图标位置` : '桌面图标位置',
            },
          )
        : createPlanStep(
            'preview-desktop-icon-arrangement',
            'preview-desktop-icon-arrangement',
            '生成图标排列预览计划',
            {
              details,
              requiresDesktopMode: true,
              targetDescription: options.displayTarget ? `${displayTargetText}图标排列计划` : '桌面图标排列计划',
            },
          ),
    ],
  };
}

export function buildDesktopIconPlacementPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const placement = command.desktopIconPlacement;
  if (!placement) {
    return null;
  }

  return {
    commandKind: command.kind,
    goal: `移动桌面图标：${placement.targetName}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'list-desktop-icons',
        'list-desktop-icons',
        `读取「${placement.targetName}」和「${placement.anchorName}」的桌面位置`,
        {
          requiresDesktopMode: true,
          targetDescription: `${placement.targetName}, ${placement.anchorName}`,
        },
      ),
      createPlanStep(
        'move-desktop-icon',
        'move-desktop-icon',
        `把「${placement.targetName}」移动到「${placement.anchorName}」附近`,
        {
          estimatedItemCount: 1,
          requiresDesktopMode: true,
          reversible: true,
          targetDescription: placement.targetName,
        },
      ),
    ],
  };
}

export function buildDesktopOrganizationToolPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const toolName = command.toolCall?.name;
  if (!toolName) return null;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  switch (toolName) {
    case 'organize_desktop_icons':
      return buildDesktopOrganizationPlan(command);

    case 'place_desktop_icon':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `移动桌面图标：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'list-desktop-icons',
            'list-desktop-icons',
            `读取目标桌面图标位置：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
          createPlanStep(
            'move-desktop-icon',
            'move-desktop-icon',
            `按请求移动桌面图标：${targetDescription}`,
            {
              estimatedItemCount: 1,
              requiresDesktopMode: true,
              reversible: true,
              targetDescription,
            },
          ),
        ],
      };
    default: return null;
  }
}
