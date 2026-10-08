import { type AgentToolCallName } from '../agentChatCommand';
import { type AgentToolInputParamSpec } from '../agentToolInputSchema';
import {
  AGENT_TOOL_DISPLAY_TARGET_VALUES,
  AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
  AGENT_TOOL_DESKTOP_ORGANIZATION_MODE_VALUES,
  AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
  AGENT_TOOL_DESKTOP_ICON_DIRECTION_VALUES,
  AGENT_TOOL_OPEN_RESOURCE_TYPE_VALUES,
  AGENT_TOOL_WINDOW_CONTROL_STATE_VALUES,
  AGENT_TOOL_WINDOW_CONTROL_SNAP_VALUES,
  AGENT_TOOL_WINDOW_COORDINATE_SPACE_VALUES,
  AGENT_TOOL_DESKTOP_INPUT_COORDINATE_SPACE_VALUES,
  AGENT_TOOL_DESKTOP_ACTION_VALUES,
  AGENT_TOOL_WINDOW_UI_ACTION_VALUES,
  AGENT_TOOL_DESKTOP_INPUT_ACTION_VALUES,
  AGENT_TOOL_CONTROLLED_COMMAND_SHELL_VALUES,
  AGENT_TOOL_BROWSER_CONTROL_ACTION_VALUES,
} from './parameterValues';

export const AGENT_DESKTOP_ACTION_INPUT_SPECS = {
  execute_desktop_action: [
    {
      aliases: ['desktopAction', 'operation'],
      enumValues: AGENT_TOOL_DESKTOP_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['url', 'path', 'website', 'site', 'appName', 'name', 'title', 'processName'],
      key: 'target',
      type: 'string',
    },
    {
      aliases: ['keyword', 'keywords'],
      key: 'query',
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_OPEN_RESOURCE_TYPE_VALUES,
      key: 'resourceType',
      type: 'string',
    },
    {
      aliases: ['scheme', 'protocol'],
      key: 'uriScheme',
      type: 'string',
    },
    {
      key: 'forceNew',
      type: 'boolean',
    },
    {
      key: 'forceNewPage',
      type: 'boolean',
    },
    {
      key: 'includeWindows',
      type: 'boolean',
    },
    {
      aliases: ['text', 'label', 'targetElement'],
      key: 'targetText',
      type: 'string',
    },
    {
      aliases: ['description', 'element'],
      key: 'targetDescription',
      type: 'string',
    },
    {
      aliases: ['id'],
      key: 'automationId',
      type: 'string',
    },
    {
      aliases: ['type'],
      key: 'controlType',
      type: 'string',
    },
    {
      aliases: ['uiaAction', 'controlAction', 'pattern'],
      enumValues: AGENT_TOOL_WINDOW_UI_ACTION_VALUES,
      key: 'uiAction',
      type: 'string',
    },
    {
      aliases: ['textValue', 'inputValue'],
      key: 'value',
      type: 'string',
    },
    {
      aliases: ['display', 'displayTarget', 'screen', 'screenTarget'],
      key: 'targetDisplay',
      type: 'string',
    },
    {
      aliases: ['targetDisplayId', 'screenId'],
      key: 'displayId',
      type: 'string',
    },
    {
      aliases: ['placement'],
      enumValues: ['center', 'top-left'],
      key: 'position',
      type: 'string',
    },
    {
      key: 'preserveSize',
      type: 'boolean',
    },
    {
      key: 'fallbackToActiveWindow',
      type: 'boolean',
    },
    {
      aliases: ['state', 'mode'],
      enumValues: AGENT_TOOL_WINDOW_CONTROL_STATE_VALUES,
      key: 'windowState',
      type: 'string',
    },
    {
      aliases: ['snapPosition'],
      enumValues: AGENT_TOOL_WINDOW_CONTROL_SNAP_VALUES,
      key: 'snap',
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_WINDOW_COORDINATE_SPACE_VALUES,
      key: 'coordinateSpace',
      type: 'string',
    },
    {
      aliases: ['left'],
      key: 'x',
      type: 'number',
    },
    {
      aliases: ['top'],
      key: 'y',
      type: 'number',
    },
    {
      aliases: ['w'],
      key: 'width',
      type: 'number',
    },
    {
      aliases: ['h'],
      key: 'height',
      type: 'number',
    },
    {
      key: 'pid',
      type: 'number',
    },
    {
      aliases: ['windowHandle'],
      key: 'hwnd',
      type: 'number',
    },
  ],
  execute_desktop_input: [
    {
      aliases: ['inputAction', 'operation'],
      enumValues: AGENT_TOOL_DESKTOP_INPUT_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      enumValues: ['left', 'right', 'middle'],
      key: 'button',
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_DESKTOP_INPUT_COORDINATE_SPACE_VALUES,
      key: 'coordinateSpace',
      type: 'string',
    },
    {
      key: 'x',
      type: 'number',
    },
    {
      key: 'y',
      type: 'number',
    },
    {
      key: 'fromX',
      type: 'number',
    },
    {
      key: 'fromY',
      type: 'number',
    },
    {
      aliases: ['targetX'],
      key: 'toX',
      type: 'number',
    },
    {
      aliases: ['targetY'],
      key: 'toY',
      type: 'number',
    },
    {
      key: 'steps',
      type: 'number',
    },
    {
      aliases: ['value'],
      key: 'text',
      type: 'string',
    },
    {
      aliases: ['sequence'],
      key: 'keys',
      type: 'string',
    },
    {
      key: 'hotkey',
      type: 'string',
    },
    {
      aliases: ['expectedHwnd', 'hwnd', 'windowHandle'],
      key: 'expectedForegroundHwnd',
      type: 'number',
    },
    {
      aliases: ['expectedPid', 'pid'],
      key: 'expectedForegroundPid',
      type: 'number',
    },
    {
      aliases: ['windowTitle', 'title'],
      key: 'expectedForegroundTitle',
      type: 'string',
    },
    {
      aliases: ['processName'],
      key: 'expectedForegroundProcessName',
      type: 'string',
    },
    {
      key: 'forceMouseEventFallback',
      type: 'boolean',
    },
    {
      key: 'forceTouchInjectionFallback',
      type: 'boolean',
    },
    {
      key: 'preClickDelayMs',
      type: 'number',
    },
    {
      key: 'holdMs',
      type: 'number',
    },
    {
      key: 'intervalMs',
      type: 'number',
    },
    {
      key: 'repeat',
      type: 'number',
    },
  ],
  execute_desktop_sequence: [
    {
      aliases: ['sequenceJson'],
      key: 'stepsJson',
      required: true,
      type: 'string',
    },
    {
      key: 'mode',
      type: 'string',
    },
    {
      key: 'visibleClickJson',
      type: 'string',
    },
    {
      aliases: ['sourceQuery', 'windowQuery'],
      key: 'app',
      type: 'string',
    },
    {
      aliases: ['targetText', 'targetDescription'],
      key: 'target',
      type: 'string',
    },
    {
      key: 'requireSameHwnd',
      type: 'boolean',
    },
    {
      key: 'requireActionable',
      type: 'boolean',
    },
    {
      aliases: ['hwnd', 'windowHandle'],
      key: 'sourceHwnd',
      type: 'number',
    },
    {
      aliases: ['windowTitle'],
      key: 'sourceWindowTitle',
      type: 'string',
    },
    {
      key: 'targetRole',
      type: 'string',
    },
    {
      key: 'targetX',
      type: 'number',
    },
    {
      key: 'targetY',
      type: 'number',
    },
    {
      aliases: ['verifyQuery', 'target', 'query'],
      key: 'postVerifyQuery',
      type: 'string',
    },
    {
      aliases: ['visualVerifyQuery', 'visualQuery'],
      key: 'postVerifyVisualQuery',
      type: 'string',
    },
    {
      key: 'postVerify',
      type: 'boolean',
    },
    {
      key: 'postVerifyRequired',
      type: 'boolean',
    },
    {
      key: 'stopOnError',
      type: 'boolean',
    },
  ],
  run_controlled_command: [
    {
      aliases: ['script', 'query'],
      key: 'command',
      required: true,
      type: 'string',
    },
    {
      key: 'cwd',
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_CONTROLLED_COMMAND_SHELL_VALUES,
      key: 'shell',
      type: 'string',
    },
    {
      key: 'timeoutMs',
      type: 'number',
    },
  ],
  control_browser: [
    {
      aliases: ['browserAction', 'operation'],
      enumValues: AGENT_TOOL_BROWSER_CONTROL_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['target', 'site', 'website'],
      key: 'url',
      type: 'string',
    },
    {
      aliases: ['target', 'keyword', 'keywords'],
      key: 'query',
      type: 'string',
    },
    {
      key: 'tabId',
      type: 'string',
    },
    {
      key: 'title',
      type: 'string',
    },
    {
      key: 'forceNewPage',
      type: 'boolean',
    },
    {
      key: 'forceOpen',
      type: 'boolean',
    },
    {
      key: 'readPage',
      type: 'boolean',
    },
  ],
  focus_window: [
    {
      aliases: ['target', 'title', 'processName', 'name'],
      key: 'query',
      required: true,
      type: 'string',
    },
  ],
  close_window: [
    {
      aliases: ['target', 'title', 'processName', 'name'],
      key: 'query',
      type: 'string',
    },
    {
      key: 'pid',
      type: 'number',
    },
    {
      aliases: ['windowHandle'],
      key: 'hwnd',
      type: 'number',
    },
  ],
  open_resource: [
    {
      aliases: ['query', 'url', 'path', 'website', 'site', 'targetUrl'],
      key: 'target',
      required: true,
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_OPEN_RESOURCE_TYPE_VALUES,
      key: 'resourceType',
      type: 'string',
    },
    {
      key: 'forceNew',
      type: 'boolean',
    },
  ],
  launch_local_app: [
    {
      aliases: ['appName', 'name'],
      key: 'query',
      required: true,
      type: 'string',
    },
    {
      key: 'forceNew',
      type: 'boolean',
    },
    {
      key: 'forceRefresh',
      type: 'boolean',
    },
  ],
  organize_desktop_icons: [
    {
      aliases: ['display', 'targetDisplay'],
      enumValues: AGENT_TOOL_DISPLAY_TARGET_VALUES,
      key: 'displayTarget',
      type: 'string',
    },
    {
      aliases: ['target', 'displayTarget'],
      enumValues: AGENT_TOOL_DISPLAY_TARGET_VALUES,
      key: 'targetDisplay',
      type: 'string',
    },
    {
      aliases: ['source', 'sourceDisplayTarget'],
      enumValues: AGENT_TOOL_DISPLAY_TARGET_VALUES,
      key: 'sourceDisplay',
      type: 'string',
    },
    {
      aliases: ['iconScope'],
      enumValues: AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
      key: 'scope',
      type: 'string',
    },
    {
      aliases: ['iconScope', 'scope'],
      enumValues: AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
      key: 'sourceScope',
      type: 'string',
    },
    {
      aliases: ['actionMode'],
      enumValues: AGENT_TOOL_DESKTOP_ORGANIZATION_MODE_VALUES,
      key: 'mode',
      type: 'string',
    },
    {
      aliases: ['group', 'grouping', 'groupStrategy', 'sortGroup'],
      enumValues: AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
      key: 'groupBy',
      type: 'string',
    },
    {
      aliases: ['layoutIntent', 'placementGoal', 'arrangementIntent', 'intent'],
      key: 'placementIntent',
      type: 'string',
    },
  ],
  place_desktop_icon: [
    {
      aliases: ['target'],
      key: 'targetName',
      required: true,
      type: 'string',
    },
    {
      aliases: ['anchor'],
      key: 'anchorName',
      required: true,
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_DESKTOP_ICON_DIRECTION_VALUES,
      key: 'direction',
      required: true,
      type: 'string',
    },
  ],
  remember_local_app: [
    {
      aliases: ['name'],
      key: 'alias',
      required: true,
      type: 'string',
    },
    {
      aliases: ['appPath'],
      key: 'path',
      required: true,
      type: 'string',
    },
  ]
} satisfies Partial<Record<AgentToolCallName, readonly AgentToolInputParamSpec[]>>;
