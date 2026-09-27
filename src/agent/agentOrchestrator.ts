import {
  createAgentActionRequest,
  evaluateAgentToolAction,
} from './agentActionPolicy';
import {
  type AgentToolActionDecision,
  type AgentToolActionKind,
  type AgentToolActionRequest,
} from './agentCapabilityTypes';
import {
  type AgentChatCommand,
  type AgentDesktopOrganizationCommand,
  type AgentDesktopOrganizationDisplayTarget,
  type AgentDesktopOrganizationMode,
  type AgentDesktopOrganizationScope,
  type AgentToolCallName,
} from './agentChatCommand';

export interface AgentExecutionPlanStep {
  action: AgentToolActionRequest;
  decision: AgentToolActionDecision;
  details?: string[];
  id: string;
  summary: string;
}

export interface AgentExecutionPlan {
  commandKind: AgentChatCommand['kind'];
  goal: string;
  instruction: string;
  steps: AgentExecutionPlanStep[];
}

function createPlanStep(
  id: string,
  kind: AgentToolActionKind,
  summary: string,
  options: Omit<AgentToolActionRequest, 'kind' | 'label' | 'risk'> & { details?: string[]; label?: string },
): AgentExecutionPlanStep {
  const { details, label, ...actionOptions } = options;
  const action = createAgentActionRequest(kind, {
    ...actionOptions,
    label: label ?? summary,
    userInitiated: actionOptions.userInitiated ?? true,
  });

  return {
    action,
    decision: evaluateAgentToolAction(action),
    details,
    id,
    summary,
  };
}

function buildAppLaunchPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const appName = command.appLaunch?.appName?.trim();
  if (!appName) {
    return null;
  }

  return {
    commandKind: command.kind,
    goal: command.appLaunch?.forceNew
      ? `新打开应用：${appName}`
      : `打开或唤出应用：${appName}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'search-local-app',
        'search-local-app',
        `查找本机应用、快捷方式、任务栏固定项和用户应用记忆：${appName}`,
        {
          requiresDesktopMode: true,
          targetDescription: appName,
        },
      ),
      createPlanStep(
        'launch-local-app',
        'launch-local-app',
        command.appLaunch?.forceNew
          ? `新启动应用：${appName}`
          : `优先唤出现有窗口，找不到再启动应用：${appName}`,
        {
          requiresDesktopMode: true,
          targetDescription: appName,
        },
      ),
    ],
  };
}

function buildAppAliasSavePlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const alias = command.appAliasSave?.alias?.trim();
  const appPath = command.appAliasSave?.appPath?.trim();
  if (!alias || !appPath) {
    return null;
  }

  return {
    commandKind: command.kind,
    goal: `记住应用别名：${alias}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'remember-local-app',
        'remember-local-app',
        `把「${alias}」绑定到本机应用路径`,
        {
          requiresDesktopMode: true,
          targetDescription: appPath,
        },
      ),
    ],
  };
}

function buildContextQueryPlan(command: AgentChatCommand): AgentExecutionPlan {
  return {
    commandKind: command.kind,
    goal: '回答上一轮 Agent 观察结果追问',
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'answer-agent-context-query',
        'answer-agent-context-query',
        '读取聊天里的最近 Agent 观察记录并回答',
        {
          targetDescription: '最近一次桌面观察上下文',
        },
      ),
    ],
  };
}

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

function buildDesktopOrganizationPlan(command: AgentChatCommand): AgentExecutionPlan {
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

function buildDesktopIconPlacementPlan(command: AgentChatCommand): AgentExecutionPlan | null {
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

function getToolCallTargetDescription(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const appName = typeof input.appName === 'string' ? input.appName.trim() : '';
  const target = typeof input.target === 'string' ? input.target.trim() : '';
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const hotkey = typeof input.hotkey === 'string' ? input.hotkey.trim() : '';
  const keys = typeof input.keys === 'string' ? input.keys.trim() : '';
  const targetText = typeof input.targetText === 'string' ? input.targetText.trim() : '';
  const sourceId = typeof input.sourceId === 'string' ? input.sourceId.trim() : '';
  const pid = Number(input.pid);
  const hwnd = Number(input.hwnd ?? input.windowHandle);
  const alias = typeof input.alias === 'string' ? input.alias.trim() : '';
  const uriScheme = typeof input.uriScheme === 'string' ? input.uriScheme.trim() : '';
  const localPath = typeof input.path === 'string' ? input.path.trim() : '';
  const sourcePath = typeof input.sourcePath === 'string' ? input.sourcePath.trim() : '';
  const destinationPath = typeof input.destinationPath === 'string' ? input.destinationPath.trim() : '';
  const destinationDirectory = typeof input.destinationDirectory === 'string' ? input.destinationDirectory.trim() : '';
  const newName = typeof input.newName === 'string' ? input.newName.trim() : '';
  const projectPath = typeof input.projectPath === 'string' ? input.projectPath.trim() : '';
  const folderPath = typeof input.folderPath === 'string' ? input.folderPath.trim() : '';
  const filePath = typeof input.filePath === 'string' ? input.filePath.trim() : '';
  const actionIndex = Number(input.actionIndex ?? input.index);
  const actionCommand = typeof input.command === 'string' ? input.command.trim() : '';
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const targetName = typeof input.targetName === 'string' ? input.targetName.trim() : '';
  const anchorName = typeof input.anchorName === 'string' ? input.anchorName.trim() : '';
  const nameQuery = typeof input.nameQuery === 'string' ? input.nameQuery.trim() : '';
  const pattern = typeof input.pattern === 'string' ? input.pattern.trim() : '';
  const memoryKey = typeof input.key === 'string' ? input.key.trim() : '';
  const memoryValue = typeof input.value === 'string' ? input.value.trim() : '';
  const memoryCategory = typeof input.category === 'string' ? input.category.trim() : '';
  const skillId = typeof input.skillId === 'string' ? input.skillId.trim() : '';
  const serverId = typeof input.serverId === 'string' ? input.serverId.trim() : '';
  const mcpToolName = typeof input.name === 'string' ? input.name.trim() : (
    typeof input.toolName === 'string' ? input.toolName.trim() : ''
  );
  const searchQuery = nameQuery || pattern || query;
  const actionDescription = Number.isFinite(actionIndex) && actionIndex > 0
    ? `第 ${Math.round(actionIndex)} 个候选动作`
    : actionCommand || label;

  if (command.toolCall?.name === 'search_files') {
    return [
      searchQuery,
      localPath || folderPath || projectPath || filePath,
    ].filter(Boolean).join(' @ ') || command.instruction;
  }

  return query
    || appName
    || target
    || url
    || title
    || hotkey
    || keys
    || targetText
    || sourceId
    || (Number.isFinite(pid) && pid > 0 ? `pid=${Math.round(pid)}` : '')
    || (Number.isFinite(hwnd) && hwnd > 0 ? `hwnd=${Math.round(hwnd)}` : '')
    || alias
    || uriScheme
    || [sourcePath || localPath, destinationPath || destinationDirectory, newName].filter(Boolean).join(' -> ')
    || localPath
    || projectPath
    || folderPath
    || filePath
    || actionDescription
    || [targetName, anchorName].filter(Boolean).join(', ')
    || [memoryCategory, memoryKey, memoryValue].filter(Boolean).join(': ')
    || skillId
    || [serverId, mcpToolName].filter(Boolean).join('/')
    || command.instruction;
}

function getToolCallStringInput(command: AgentChatCommand, keys: string[]) {
  const input = command.toolCall?.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getLocalProjectRunPlanDetails(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const localPath = [
    input.path,
    input.projectPath,
    input.folderPath,
    input.filePath,
    input.query,
  ].find((value) => typeof value === 'string' && value.trim());
  const actionIndex = Number(input.actionIndex ?? input.index);
  const actionCommand = typeof input.command === 'string' ? input.command.trim() : '';
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const details = [
    typeof localPath === 'string' && localPath.trim()
      ? `路径：${localPath.trim()}`
      : '路径：使用上一轮项目分析结果',
    Number.isFinite(actionIndex) && actionIndex > 0
      ? `候选：第 ${Math.round(actionIndex)} 个`
      : '',
    actionCommand ? `命令匹配：${actionCommand}` : '',
    label ? `名称匹配：${label}` : '',
    '限制：只会运行项目分析器识别出的候选动作，不会执行任意临时命令。',
  ].filter(Boolean);

  return details;
}

function explicitlyRequestsProjectRun(command: AgentChatCommand) {
  const text = [command.sourceText, command.instruction, command.toolCall?.input?.goal]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return /(?:启动|运行|打开|执行|开始|run|start|launch|open|execute)/iu.test(text);
}

function getVoiceProviderText(value: unknown) {
  if (value === 'api') {
    return 'API 语音';
  }

  if (value === 'local') {
    return '本地语音模型';
  }

  if (value === 'browser') {
    return 'Edge-TTS 本地';
  }

  return '未指定语音来源';
}

function getVoiceInputEnabledText(value: unknown) {
  return value === false ? '关闭语音输入' : '开启语音输入';
}

function buildSkillMcpToolCallPlan(
  command: AgentChatCommand,
  kind: AgentToolActionKind,
  summary: string,
) {
  const explicitGoal = command.toolCall?.goal?.trim();
  const targetDescription = getToolCallTargetDescription(command);

  return {
    commandKind: command.kind,
    goal: explicitGoal || summary,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        kind,
        kind,
        targetDescription ? `${summary}: ${targetDescription}` : summary,
        {
          targetDescription,
        },
      ),
    ],
  };
}

function getExecuteDesktopActionInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.desktopAction ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteDesktopAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'list_windows':
      return 'list_running_apps';
    case 'get_default_browser':
      return 'get_default_app_for_uri';
    case 'focus_browser_window':
      return 'focus_window';
    case 'resize_window':
    case 'snap_window':
    case 'maximize_window':
    case 'minimize_window':
    case 'restore_window':
      return 'control_window';
    case 'open_then_control_window':
    case 'launch_then_control_window':
    case 'focus_then_control_window':
      return 'open_or_focus_then_control_window';
    case 'open_then_move_window_to_display':
    case 'launch_then_move_window_to_display':
      return 'open_or_focus_then_move_window_to_display';
    case 'move_window':
    case 'move_window_to_screen':
    case 'move_window_to_monitor':
      return 'move_window_to_display';
    case 'close_app':
      return 'close_window';
    case 'open_url':
      return 'open_resource';
    case 'open_app':
      return 'launch_local_app';
    case 'invoke_ui':
    case 'invoke_control':
    case 'invoke_button':
    case 'click_window_ui':
      return 'invoke_window_ui';
    case 'ui_action':
    case 'uia_action':
    case 'interact_ui':
    case 'interact_control':
    case 'select_ui':
    case 'select_window_ui':
    case 'toggle_ui':
    case 'toggle_window_ui':
    case 'expand_ui':
    case 'expand_window_ui':
    case 'collapse_ui':
    case 'collapse_window_ui':
    case 'set_ui_value':
    case 'set_window_ui_value':
      return 'interact_window_ui';
    case 'list_running_apps':
    case 'get_default_app_for_uri':
    case 'get_active_window_info':
    case 'focus_window':
    case 'control_window':
    case 'open_or_focus_then_control_window':
    case 'open_or_focus_then_move_window_to_display':
    case 'move_window_to_display':
    case 'close_window':
    case 'open_resource':
    case 'launch_local_app':
    case 'interact_window_ui':
    case 'invoke_window_ui':
    case 'search_web':
      return normalizedValue;
    default:
      return '';
  }
}

function getWindowUiInteractionPlanKind(command: AgentChatCommand): AgentToolActionKind {
  const action = normalizeExecuteDesktopAction(getExecuteDesktopActionInput(command));
  const uiAction = getToolCallStringInput(command, [
    'uiAction',
    'uiaAction',
    'controlAction',
    'pattern',
  ]).trim().toLowerCase().replace(/[-\s]+/gu, '_');

  return action === 'interact_window_ui' && uiAction !== 'invoke'
    ? 'interact-window-ui'
    : 'invoke-window-ui';
}

function getWindowUiInteractionPlanLabel(kind: AgentToolActionKind) {
  return kind === 'interact-window-ui'
    ? 'Interact with a UI Automation control in a window'
    : 'Invoke a UI Automation control in a window';
}

function buildExecuteDesktopActionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteDesktopAction(getExecuteDesktopActionInput(command));
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute desktop action: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  switch (action) {
    case 'list_running_apps':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:list-running-apps',
            'list-running-apps',
            targetDescription
              ? `List and filter running apps/windows: ${targetDescription}`
              : 'List current running apps/windows',
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_default_app_for_uri':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:get-default-app-for-uri',
            'get-default-app-for-uri',
            `Read OS default URI handler: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_active_window_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:get-active-window-info',
            'get-active-window-info',
            'Read the current foreground window',
            {
              requiresDesktopMode: true,
              targetDescription: 'current foreground window',
            },
          ),
        ],
      };

    case 'focus_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:focus-window',
            'focus-window',
            `Bring a matching existing window to the foreground: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'control_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:control-window',
            'control-window',
            `Control a matching existing window state or bounds: ${targetDescription || 'active or matching window'}`,
            {
              details: [
                'This can maximize, minimize, restore, snap, resize, or set window coordinates.',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'open_or_focus_then_control_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:open-or-focus-then-control-window',
            'open-or-focus-then-control-window',
            `Open or focus a target, then control the resulting window state or bounds: ${targetDescription}`,
            {
              details: [
                'This may open/focus an app or resource and then maximize, minimize, restore, snap, resize, or set window coordinates.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'open_or_focus_then_move_window_to_display':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:open-or-focus-then-move-window-to-display',
            'open-or-focus-then-move-window-to-display',
            `Open or focus a target, then move the resulting window to the requested display: ${targetDescription}`,
            {
              details: [
                'This may open/focus an app or resource and then change the resulting window bounds.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'move_window_to_display':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:move-window-to-display',
            'move-window-to-display',
            `Move a matching existing window to the requested display: ${targetDescription}`,
            {
              details: [
                'This changes only the window bounds and should preserve the window size unless requested otherwise.',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'close_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:close-window',
            'close-window',
            `Send a normal close request to a matching existing window: ${targetDescription}`,
            {
              details: [
                'This is not a forced kill. Apps with unsaved content may show their own confirmation dialog.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'open_resource':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:open-resource',
            'open-resource',
            `Ask the OS to open a URL, file, folder, or app target: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'launch_local_app':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:search-local-app',
            'search-local-app',
            `Find a local app, shortcut, pinned item, or remembered app: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
          createPlanStep(
            'execute-desktop-action:launch-local-app',
            'launch-local-app',
            `Focus an existing window first, or launch the app if needed: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'interact_window_ui':
    case 'invoke_window_ui': {
      const actionKind = getWindowUiInteractionPlanKind(command);
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            `execute-desktop-action:${action.replace(/_/gu, '-')}`,
            actionKind,
            `${getWindowUiInteractionPlanLabel(actionKind)}: ${targetDescription || 'matched window control'}`,
            {
              details: [
                'This triggers an in-app control through Windows UI Automation patterns such as Invoke, SelectionItem, Toggle, ExpandCollapse, or Value.',
                'Use only after read-only UI Automation or visual evidence identifies the intended control.',
              ],
              requiresDesktopMode: true,
              reversible: false,
              targetDescription,
            },
          ),
        ],
      };
    }

    case 'search_web':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:search-web',
            'search-web',
            `Open or reuse a browser to search the web: ${targetDescription}`,
            {
              details: [
                'If the target is a direct URL/domain, use action open_resource/open_url instead.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    default:
      return null;
  }
}

function buildObserveWindowsAndAppsPlan(command: AgentChatCommand): AgentExecutionPlan {
  const targetDescription = getToolCallTargetDescription(command);
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || 'Observe current windows and app launch surfaces',
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'observe-windows-and-apps',
        'observe-windows-and-apps',
        targetDescription
          ? `Observe apps/windows/taskbar/display ownership: ${targetDescription}`
          : 'Observe installed apps, taskbar pinned apps, running windows, active window, and display ownership',
        {
          requiresDesktopMode: true,
          targetDescription,
        },
      ),
    ],
  };
}

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

interface ExecuteDesktopSequencePlanStepSummary {
  reason?: string;
  tool: string;
}

interface ExecuteDesktopSequenceVisibleClickSummary {
  app: string;
  target: string;
}

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

function buildRunControlledCommandPlan(command: AgentChatCommand): AgentExecutionPlan {
  const targetDescription = getToolCallTargetDescription(command);
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || 'Run one controlled local command',
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'run-controlled-command',
        'run-controlled-command',
        targetDescription
          ? `Run controlled command: ${targetDescription}`
          : 'Run controlled command',
        {
          details: [
            'The command runtime blocks destructive patterns, shell chaining, redirection, and pipes in v1.',
            'stdout, stderr, exitCode, cwd, and timeout status will be returned to the Agent loop.',
          ],
          requiresDesktopMode: true,
          targetDescription: targetDescription || 'controlled command',
        },
      ),
    ],
  };
}

function getControlBrowserAction(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.browserAction ?? input.operation;
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_') : '';
}

function isReadOnlyBrowserControlAction(action: string) {
  return action === 'read_page' || action === 'list_tabs' || action === 'status';
}

function buildControlBrowserPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = getControlBrowserAction(command);
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const actionKind = isReadOnlyBrowserControlAction(action)
    ? 'control-browser-read'
    : 'control-browser-open';
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || `Control browser: ${action}`,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        `control-browser:${action}`,
        actionKind,
        targetDescription
          ? `Browser control ${action}: ${targetDescription}`
          : `Browser control ${action}`,
        {
          details: isReadOnlyBrowserControlAction(action)
            ? ['Read controlled browser session/tab/page state.']
            : ['This may open, navigate, search, or focus a controlled browser tab.'],
          requiresDesktopMode: true,
          targetDescription: targetDescription || action,
        },
      ),
    ],
  };
}

function buildLocateScreenElementsPlan(command: AgentChatCommand): AgentExecutionPlan {
  const targetDescription = getToolCallTargetDescription(command);
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || 'Locate visible screen elements with vision',
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'locate-screen-elements',
        'locate-screen-elements',
        targetDescription
          ? `Capture and locate visible text/elements: ${targetDescription}`
          : 'Capture and locate visible text/elements',
        {
          details: [
            'v1 returns approximate vision evidence, not pixel-perfect OCR coordinates.',
          ],
          requiresDesktopMode: true,
          targetDescription,
        },
      ),
    ],
  };
}

function getExecuteLocalFileActionInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.fileAction ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteLocalFileAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'path_info':
    case 'inspect_path':
      return 'get_path_info';
    case 'list_dir':
    case 'list_folder':
      return 'list_directory';
    case 'search_file':
    case 'find_file':
    case 'find_files':
      return 'search_files';
    case 'read_file':
    case 'read_text':
      return 'read_text_file';
    case 'get_path_info':
    case 'list_directory':
    case 'search_files':
    case 'read_text_file':
      return normalizedValue;
    default:
      return '';
  }
}

function buildExecuteLocalFileActionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteLocalFileAction(getExecuteLocalFileActionInput(command));
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute local file action: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  switch (action) {
    case 'get_path_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:get-path-info',
            'get-path-info',
            `Read-only inspect local path metadata: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'list_directory':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:list-directory',
            'list-directory',
            `Read-only list local directory entries: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'search_files':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:search-files',
            'search-files',
            `Read-only search local file names: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'read_text_file':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:read-text-file',
            'read-text-file',
            `Read-only read a small local text file snippet: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    default:
      return null;
  }
}

function getExecuteMemoryActionInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.memoryAction ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteMemoryAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'list':
    case 'read':
    case 'recall':
    case 'search':
      return 'recall';
    case 'remember':
    case 'add':
    case 'set':
      return 'remember';
    case 'forget':
    case 'delete':
    case 'remove':
      return 'forget';
    default:
      return '';
  }
}

function buildExecuteMemoryActionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteMemoryAction(getExecuteMemoryActionInput(command));
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute Agent memory action: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  switch (action) {
    case 'recall':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-memory-action:recall',
            'read-agent-memory',
            targetDescription
              ? `Read Agent memory matching: ${targetDescription}`
              : 'Read Agent memory',
            {
              targetDescription: targetDescription || 'Agent memory',
            },
          ),
        ],
      };

    case 'remember':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-memory-action:remember',
            'remember-agent-memory',
            targetDescription
              ? `Remember a user-approved Agent memory item: ${targetDescription}`
              : 'Remember a user-approved Agent memory item',
            {
              reversible: true,
              targetDescription: targetDescription || 'Agent memory',
            },
          ),
        ],
      };

    case 'forget':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-memory-action:forget',
            'forget-agent-memory',
            targetDescription
              ? `Forget matching Agent-managed memory: ${targetDescription}`
              : 'Forget matching Agent-managed memory',
            {
              reversible: true,
              targetDescription: targetDescription || 'Agent memory',
            },
          ),
        ],
      };

    default:
      return null;
  }
}

function getExecuteFileManagementActionInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.fileAction ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteFileManagementAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'plan':
    case 'preview':
    case 'dry_run':
      return 'preview';
    case 'move':
    case 'move_file':
    case 'move_folder':
    case 'move_path':
      return 'move_path';
    case 'organize_desktop':
    case 'organize_desktop_file':
    case 'organize_desktop_files':
    case 'organize_desktop_items':
    case 'desktop_file_organization':
      return 'organize_desktop_files';
    case 'copy':
    case 'copy_file':
    case 'copy_folder':
    case 'copy_path':
      return 'copy_path';
    case 'rename':
    case 'rename_file':
    case 'rename_folder':
    case 'rename_path':
      return 'rename_path';
    case 'mkdir':
    case 'new_folder':
    case 'create_folder':
    case 'create_directory':
      return 'create_directory';
    case 'trash':
    case 'trash_path':
    case 'recycle':
    case 'recycle_path':
      return 'trash_path';
    default:
      return '';
  }
}

function getExecuteFileManagementIntendedAction(command: AgentChatCommand, action: string) {
  if (action !== 'preview') {
    return action;
  }

  const input = command.toolCall?.input ?? {};
  const value = input.intendedAction ?? input.previewAction ?? input.targetAction ?? input.operationType;
  return typeof value === 'string' ? normalizeExecuteFileManagementAction(value) : '';
}

function buildExecuteFileManagementActionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteFileManagementAction(getExecuteFileManagementActionInput(command));
  const intendedAction = getExecuteFileManagementIntendedAction(command, action);
  if (!action || (action === 'preview' && !intendedAction)) {
    return null;
  }

  const effectiveAction = action === 'preview' ? intendedAction : action;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute file management action: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  if (action === 'preview' || command.toolCall?.input?.dryRun === true || command.toolCall?.input?.mode === 'preview') {
    const previewActionKind = effectiveAction === 'organize_desktop_files'
      ? 'propose-desktop-file-organization'
      : 'preview-file-management-action';
    return {
      commandKind: command.kind,
      goal,
      instruction: command.instruction,
      steps: [
        createPlanStep(
          'execute-file-management-action:preview',
          previewActionKind,
          targetDescription
            ? `Preview local file management action ${effectiveAction}: ${targetDescription}`
            : `Preview local file management action ${effectiveAction}`,
          {
            requiresDesktopMode: true,
            targetDescription: targetDescription || 'local file management preview',
          },
        ),
      ],
    };
  }

  const actionKind = (() => {
    switch (effectiveAction) {
      case 'move_path':
        return 'move-local-path' as const;
      case 'organize_desktop_files':
        return 'execute-desktop-file-organization' as const;
      case 'copy_path':
        return 'copy-local-path' as const;
      case 'rename_path':
        return 'rename-local-path' as const;
      case 'create_directory':
        return 'create-local-directory' as const;
      case 'trash_path':
        return 'trash-local-path' as const;
      default:
        return null;
    }
  })();
  if (!actionKind) {
    return null;
  }

  return {
    commandKind: command.kind,
    goal,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        `execute-file-management-action:${effectiveAction}`,
        actionKind,
        targetDescription
          ? `Execute local file management action ${effectiveAction}: ${targetDescription}`
          : `Execute local file management action ${effectiveAction}`,
        {
          details: [
            'This tool does not overwrite existing paths and does not permanently delete files.',
            effectiveAction === 'trash_path' ? 'Trash uses the operating system recycle bin when available.' : '',
          ].filter(Boolean),
          requiresDesktopMode: true,
          reversible: true,
          targetDescription: targetDescription || 'local file management action',
        },
      ),
    ],
  };
}

function getExecuteDesktopObservationInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.observationAction ?? input.desktopObservation ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteDesktopObservationAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'display_info':
    case 'screen_info':
    case 'list_displays':
      return 'get_display_info';
    case 'system_info':
    case 'computer_info':
      return 'get_system_info';
    case 'active_window':
    case 'foreground_window':
      return 'get_active_window_info';
    case 'window_ui':
    case 'ui_automation':
    case 'inspect_controls':
    case 'inspect_window_controls':
      return 'inspect_window_ui';
    case 'running_apps':
    case 'list_windows':
      return 'list_running_apps';
    case 'desktop_items':
    case 'desktop_icons':
    case 'list_desktop_icons':
      return 'list_desktop_items';
    case 'desktop_icon_diagnostics':
    case 'desktop_icon_status':
      return 'diagnose_desktop_icons';
    case 'capture_sources':
    case 'screen_sources':
      return 'list_capture_sources';
    case 'visual_snapshot':
    case 'screen_snapshot':
    case 'window_snapshot':
    case 'summarize_screen':
      return 'summarize_visual_snapshot';
    case 'wait_for_ui_state':
    case 'wait_then_observe':
    case 'wait_and_observe':
      return 'wait_and_observe';
    case 'cursor_position':
      return 'get_cursor_position';
    case 'get_display_info':
    case 'get_system_info':
    case 'get_active_window_info':
    case 'inspect_window_ui':
    case 'list_desktop_items':
    case 'diagnose_desktop_icons':
    case 'list_running_apps':
    case 'list_capture_sources':
    case 'summarize_visual_snapshot':
    case 'get_cursor_position':
      return normalizedValue;
    default:
      return '';
  }
}

function buildExecuteDesktopObservationPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteDesktopObservationAction(getExecuteDesktopObservationInput(command));
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute desktop observation: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  switch (action) {
    case 'get_display_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:get-display-info',
            'read-display-info',
            'Read current display count, bounds, work areas, and scale factors',
            {
              requiresDesktopMode: true,
              targetDescription: 'display information',
            },
          ),
        ],
      };

    case 'get_system_info': {
      const includeDisplays = command.toolCall?.input?.includeDisplays !== false;
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:read-system-info',
            'read-system-info',
            'Read current OS, CPU, memory, GPU, and runtime summary',
            {
              requiresDesktopMode: true,
              targetDescription: 'system information',
            },
          ),
          ...(includeDisplays ? [
            createPlanStep(
              'execute-desktop-observation:read-display-info',
              'read-display-info',
              'Read current display information with the system summary',
              {
                requiresDesktopMode: true,
                targetDescription: 'display information',
              },
            ),
          ] : []),
        ],
      };
    }

    case 'get_active_window_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:get-active-window-info',
            'get-active-window-info',
            'Read the current foreground window process, title, pid, and path',
            {
              requiresDesktopMode: true,
              targetDescription: 'current foreground window',
            },
          ),
        ],
      };

    case 'list_desktop_items':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:list-desktop-items',
            'list-desktop-icons',
            targetDescription
              ? `List and classify desktop items: ${targetDescription}`
              : 'List and classify desktop items/icons',
            {
              requiresDesktopMode: true,
              targetDescription: targetDescription || 'desktop items',
            },
          ),
        ],
      };

    case 'diagnose_desktop_icons':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:diagnose-desktop-icons',
            'list-desktop-icons',
            'Diagnose desktop icon reader source, movable coordinates, and display ownership',
            {
              requiresDesktopMode: true,
              targetDescription: targetDescription || 'desktop icon diagnostics',
            },
          ),
        ],
      };

    case 'list_running_apps':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:list-running-apps',
            'list-running-apps',
            targetDescription
              ? `List and filter running apps/windows: ${targetDescription}`
              : 'List current running apps/windows',
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'list_capture_sources':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:list-capture-sources',
            'list-capture-sources',
            targetDescription
              ? `List available visual capture sources: ${targetDescription}`
              : 'List available screen/window capture sources',
            {
              details: [
                'This is visual context and may include screen/window thumbnail availability.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'summarize_visual_snapshot':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:summarize-visual-snapshot',
            'capture-screen-context',
            targetDescription
              ? `Capture and summarize one visual source: ${targetDescription}`
              : 'Capture and summarize one screen/window visual snapshot',
            {
              details: [
                'The runtime returns text evidence to the Agent loop and does not store raw image data in AgentSessionV2 history.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_cursor_position':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:get-cursor-position',
            'get-cursor-position',
            'Read the current mouse cursor DIP coordinates',
            {
              requiresDesktopMode: true,
              targetDescription: 'mouse cursor position',
            },
          ),
        ],
      };

    case 'inspect_window_ui':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:inspect-window-ui',
            'inspect-window-ui',
            targetDescription
              ? `Inspect UI Automation controls in a window: ${targetDescription}`
              : 'Inspect UI Automation controls in the active or named window',
            {
              details: [
                'This is read-only UI structure evidence for controls, labels, supported actions, and screen bounds.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'wait_and_observe': {
      const waitMs = typeof command.toolCall?.input?.waitMs === 'number'
        ? command.toolCall.input.waitMs
        : typeof command.toolCall?.input?.waitMs === 'string'
          ? Number(command.toolCall.input.waitMs)
          : null;
      const includeVisual = command.toolCall?.input?.includeVisual === true;
      const waitText = Number.isFinite(Number(waitMs)) ? `${Math.round(Number(waitMs))}ms` : 'a short interval';
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:wait-and-observe',
            'observe-windows-and-apps',
            `Wait ${waitText}, then refresh current windows/apps/displays`,
            {
              details: [
                'This is a delayed read-only observation used after loading, updating, or uncertain UI transitions.',
              ],
              requiresDesktopMode: true,
              targetDescription: targetDescription || 'current desktop state after waiting',
            },
          ),
          ...(includeVisual ? [
            createPlanStep(
              'execute-desktop-observation:wait-and-observe-visual',
              'capture-screen-context',
              'Capture one visual snapshot after the wait to summarize visible UI state',
              {
                details: [
                  'The runtime returns text evidence to the Agent loop and does not store raw image data in AgentSessionV2 history.',
                ],
                requiresDesktopMode: true,
                targetDescription: targetDescription || 'visible UI state after waiting',
              },
            ),
          ] : []),
        ],
      };
    }

    default:
      return null;
  }
}

function buildToolCallPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const toolName = command.toolCall?.name;
  if (!toolName) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  switch (toolName) {
    case 'observe_windows_and_apps':
      return buildObserveWindowsAndAppsPlan(command);

    case 'execute_desktop_action':
      return buildExecuteDesktopActionPlan(command);

    case 'execute_desktop_input':
      return buildExecuteDesktopInputPlan(command);

    case 'execute_desktop_sequence':
      return buildExecuteDesktopSequencePlan(command);

    case 'execute_desktop_observation':
      return buildExecuteDesktopObservationPlan(command);

    case 'run_controlled_command':
      return buildRunControlledCommandPlan(command);

    case 'control_browser':
      return buildControlBrowserPlan(command);

    case 'locate_screen_elements':
      return buildLocateScreenElementsPlan(command);

    case 'execute_local_file_action':
      return buildExecuteLocalFileActionPlan(command);

    case 'execute_file_management_action':
      return buildExecuteFileManagementActionPlan(command);

    case 'execute_memory_action':
      return buildExecuteMemoryActionPlan(command);

    case 'list_agent_skills':
      return buildSkillMcpToolCallPlan(command, 'list-agent-skills', 'List Agent skills');

    case 'execute_agent_skill':
      return buildSkillMcpToolCallPlan(command, command.toolCall.input?.dryRun === true ? 'read-agent-skill' : 'execute-agent-skill', 'Resolve Agent skill');

    case 'list_mcp_tools':
      return buildSkillMcpToolCallPlan(command, 'list-mcp-tools', 'List MCP tools');

    case 'call_mcp_tool':
      return buildSkillMcpToolCallPlan(command, 'call-mcp-tool', 'Call MCP tool');

    case 'get_system_info': {
      const includeDisplays = command.toolCall?.input?.includeDisplays !== false;
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前电脑基础配置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-system-info',
            'read-system-info',
            '读取本机操作系统、CPU、内存和图形设备摘要',
            {
              requiresDesktopMode: true,
              targetDescription: '本机基础配置',
            },
          ),
          ...(includeDisplays ? [
            createPlanStep(
              'read-display-info',
              'read-display-info',
              '读取当前屏幕数量、分辨率、工作区和缩放比例',
              {
                requiresDesktopMode: true,
                targetDescription: '显示器信息',
              },
            ),
          ] : []),
        ],
      };
    }

    case 'get_display_info':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前屏幕信息',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-display-info',
            'read-display-info',
            '读取当前屏幕数量、分辨率、工作区和缩放比例',
            {
              requiresDesktopMode: true,
              targetDescription: '显示器信息',
            },
          ),
        ],
      };

    case 'get_pet_settings':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取桌宠配置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-pet-settings',
            'read-pet-settings',
            '读取当前桌宠配置路径和值；敏感值会隐藏',
            {
              requiresDesktopMode: true,
              targetDescription: typeof command.toolCall?.input?.path === 'string'
                ? command.toolCall.input.path
                : typeof command.toolCall?.input?.query === 'string'
                  ? command.toolCall.input.query
                  : '桌宠配置',
            },
          ),
        ],
      };

    case 'update_pet_settings':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '更新桌宠配置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'update-pet-settings',
            'update-pet-settings',
            '按请求更新桌宠配置，并在保存后回读规范化值',
            {
              details: [
                '将保留未在本次请求中提及的配置。',
                '敏感字段的值不会显示在聊天记录中。',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription: '桌宠配置',
            },
          ),
        ],
      };

    case 'get_voice_status':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前语音状态',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-voice-status',
            'read-voice-status',
            '读取语音播报、语音输入、TTS/STT 来源和本地语音健康状态',
            {
              requiresDesktopMode: true,
              targetDescription: '语音设置',
            },
          ),
        ],
      };

    case 'switch_tts_provider': {
      const provider = command.toolCall?.input?.provider ?? command.toolCall?.input?.ttsProvider;
      return {
        commandKind: command.kind,
        goal: explicitGoal || `切换语音播报来源：${getVoiceProviderText(provider)}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'switch-tts-provider',
            'switch-tts-provider',
            `修改语音播报来源为${getVoiceProviderText(provider)}`,
            {
              details: [
                typeof command.toolCall?.input?.enableVoice === 'boolean'
                  ? `播报总开关：${command.toolCall.input.enableVoice ? '开启' : '关闭'}`
                  : '',
                typeof command.toolCall?.input?.autoSpeak === 'boolean'
                  ? `自动播报：${command.toolCall.input.autoSpeak ? '开启' : '关闭'}`
                  : '',
              ].filter(Boolean),
              requiresDesktopMode: true,
              reversible: true,
              targetDescription: getVoiceProviderText(provider),
            },
          ),
        ],
      };
    }

    case 'warmup_local_voice':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '预热本地语音模型',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'warmup-local-voice',
            'warmup-local-voice',
            '启动或唤醒本地语音运行时并加载所需模型',
            {
              details: [
                '可能会占用本机 CPU/GPU 和一点启动时间。',
              ],
              requiresDesktopMode: true,
              targetDescription: '本地语音运行时',
            },
          ),
        ],
      };

    case 'set_voice_input':
      return {
        commandKind: command.kind,
        goal: explicitGoal || getVoiceInputEnabledText(command.toolCall?.input?.enabled),
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'set-voice-input',
            'set-voice-input',
            getVoiceInputEnabledText(command.toolCall?.input?.enabled),
            {
              details: [
                'v1 只修改语音输入开关，不会直接启动麦克风监听。',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription: '语音输入设置',
            },
          ),
        ],
      };

    case 'start_voice_input_session':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '开始一次语音输入监听',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'start-voice-input-session',
            'start-voice-input-session',
            '打开麦克风并开始一次语音输入监听',
            {
              details: [
                '会停止当前角色语音播报，以减少回声。',
                '识别到最终文本后会按聊天输入发送。',
              ],
              requiresDesktopMode: true,
              targetDescription: '麦克风语音输入',
            },
          ),
        ],
      };

    case 'stop_voice_input_session':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '停止当前语音输入监听',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'stop-voice-input-session',
            'stop-voice-input-session',
            '停止当前正在进行的语音输入监听',
            {
              requiresDesktopMode: true,
              targetDescription: '麦克风语音输入',
            },
          ),
        ],
      };

    case 'get_default_app_for_uri':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `读取默认 URI 处理应用：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-default-app-for-uri',
            'get-default-app-for-uri',
            `读取系统默认应用关联：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'list_running_apps':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '观察当前运行中的应用和窗口',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'list-running-apps',
            'list-running-apps',
            targetDescription
              ? `列出并筛选当前窗口/进程：${targetDescription}`
              : '列出当前可见窗口和运行应用',
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_active_window_info':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前活动窗口信息',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-active-window-info',
            'get-active-window-info',
            '只读读取当前前台窗口的进程、标题和路径',
            {
              requiresDesktopMode: true,
              targetDescription: '当前活动窗口',
            },
          ),
        ],
      };

    case 'list_capture_sources':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '列出当前可捕获的屏幕和窗口源',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'list-capture-sources',
            'list-capture-sources',
            '读取可用屏幕/窗口捕获源列表',
            {
              details: [
                '可能包含屏幕或窗口缩略图可用性，因此按视觉观察处理。',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'summarize_visual_snapshot':
      return {
        commandKind: command.kind,
        goal: explicitGoal || 'Summarize visible content from one screen or window snapshot',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'capture-screen-context',
            'capture-screen-context',
            targetDescription
              ? `Capture and summarize one visual source: ${targetDescription}`
              : 'Capture and summarize one screen/window visual snapshot',
            {
              details: [
                'The runtime returns a concise text summary to AgentSessionV2 and does not put raw image data into the Agent loop.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'analyze_game_screen':
      return {
        commandKind: command.kind,
        goal: explicitGoal || 'Analyze visible gameplay content from one game screen or window snapshot',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'observe-game-window',
            'observe-game-window',
            targetDescription
              ? `Capture and analyze one game visual source: ${targetDescription}`
              : 'Capture and analyze one game screen/window snapshot',
            {
              details: [
                'The runtime returns text evidence about visible game content, HUD, player situation, and uncertainty; it does not put raw image data into the Agent loop.',
                'This is a single observation step, not continuous companion mode.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'manage_game_companion_loop': {
      const action = command.toolCall?.input?.action;
      const actionSummary = action === 'stop'
        ? 'Stop the low-frequency game companion loop'
        : action === 'status'
          ? 'Read the current game companion loop status'
          : 'Start the low-frequency game companion loop';
      return {
        commandKind: command.kind,
        goal: explicitGoal || actionSummary,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'manage-game-companion-loop',
            'manage-game-companion-loop',
            actionSummary,
            {
              details: [
                'The runtime may capture game screen/window thumbnails at a low frequency and send short companion comments.',
                'It does not read game memory, inject into the game process, or perform gameplay input.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };
    }

    case 'get_cursor_position':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前鼠标光标位置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-cursor-position',
            'get-cursor-position',
            '只读读取当前鼠标光标的屏幕坐标',
            {
              requiresDesktopMode: true,
              targetDescription: '鼠标光标位置',
            },
          ),
        ],
      };

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

    case 'open_resource':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `打开资源：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'open-resource',
            'open-resource',
            `交给系统打开 URL、文件、文件夹或应用：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'search_web':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `搜索网页：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'search-web',
            'search-web',
            `打开或复用浏览器搜索：${targetDescription}`,
            {
              details: [
                '这是搜索动作；如果目标是明确网址，应改用 open_resource。',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'browser_search':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `打开浏览器搜索：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'browser-search',
            'browser-search',
            `打开或聚焦浏览器并搜索：${targetDescription}`,
            {
              details: [
                '会使用系统设置里的浏览器搜索配置。',
                '如果已有受控浏览器窗口，会优先复用当前页面。',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'launch_local_app':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `打开或唤出应用：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'search-local-app',
            'search-local-app',
            `查找本机应用、快捷方式、任务栏固定项和用户应用记忆：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
          createPlanStep(
            'launch-local-app',
            'launch-local-app',
            `优先唤出现有窗口，找不到再启动应用：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'remember_local_app':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `记住应用位置：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'remember-local-app',
            'remember-local-app',
            `把 ${targetDescription} 绑定到用户提供的本机应用路径`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_path_info':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `读取本机路径信息：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-path-info',
            'get-path-info',
            `只读检查路径是否存在及类型：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'list_directory':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `列出本机目录：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'list-directory',
            'list-directory',
            `只读列出目录内容：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'search_files':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `搜索本机文件名：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'search-files',
            'search-files',
            `只读按文件名搜索：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'read_text_file':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `读取本机文本文件：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-text-file',
            'read-text-file',
            `只读读取文本文件片段：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'inspect_local_project':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `分析本机项目或程序目录：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'inspect-local-project',
            'inspect-local-project',
            `只读检查目录结构和关键配置文件：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'run_local_project_action':
      if (!explicitlyRequestsProjectRun(command)) {
        return buildToolCallPlan({
          ...command,
          kind: 'tool-call',
          toolCall: {
            ...command.toolCall,
            name: 'execute_local_file_action',
            input: { action: 'list_directory', path: command.toolCall?.input?.path ?? command.toolCall?.input?.projectPath ?? '.' },
          },
        });
      }
      const runDetails = getLocalProjectRunPlanDetails(command);
      return {
        commandKind: command.kind,
        goal: explicitGoal || `运行本机项目启动候选：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'inspect-local-project',
            'inspect-local-project',
            `确认本机项目候选启动动作：${targetDescription}`,
            {
              details: runDetails,
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
          createPlanStep(
            'run-local-project-action',
            'run-local-project-action',
            `启动或打开受限候选动作：${targetDescription}`,
            {
              details: runDetails,
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

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

    default:
      return null;
  }
}

export function buildAgentExecutionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  if (command.kind === 'tool-call') {
    return buildToolCallPlan(command);
  }

  if (command.kind === 'app-launch') {
    return buildAppLaunchPlan(command);
  }

  if (command.kind === 'app-alias-save') {
    return buildAppAliasSavePlan(command);
  }

  if (command.kind === 'context-query') {
    return buildContextQueryPlan(command);
  }

  if (command.kind === 'desktop-icon-placement') {
    return buildDesktopIconPlacementPlan(command);
  }

  if (command.kind === 'desktop-organization') {
    return buildDesktopOrganizationPlan(command);
  }

  return null;
}

export function shouldRequestAgentExecutionApproval(plan: AgentExecutionPlan | null) {
  if (!plan) {
    return false;
  }

  return plan.steps.some((step) => step.decision.mode === 'confirm' || step.decision.mode === 'blocked');
}

export function createAgentExecutionApprovalText(plan: AgentExecutionPlan) {
  const lines = [
    `Agent 准备执行：${plan.goal}`,
    '',
    '计划步骤：',
    ...plan.steps.map((step, index) => {
      const permissionLabel = step.decision.mode === 'silent'
        ? '自动'
        : step.decision.mode === 'notify'
          ? '提示'
          : step.decision.mode === 'confirm'
            ? '需要确认'
            : '禁止';
      const details = step.details?.length
        ? `\n   ${step.details.join('\n   ')}`
        : '';
      return `${index + 1}. [${permissionLabel}] ${step.summary}${details}`;
    }),
    '',
    '是否允许这次操作？',
  ];

  return lines.join('\n');
}
