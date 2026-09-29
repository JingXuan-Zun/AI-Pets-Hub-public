import { type AgentToolCallName } from './agentChatCommand';

export type AgentToolInputParamType = 'boolean' | 'number' | 'string';

export interface AgentToolInputParamSpec {
  aliases?: readonly string[];
  enumValues?: readonly string[];
  key: string;
  required?: boolean;
  type: AgentToolInputParamType;
}

export type AgentToolInputPrepareResult =
  | {
      input: Record<string, unknown>;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

const AGENT_TOOL_DISPLAY_TARGET_VALUES = ['primary', 'secondary', 'current', 'all'] as const;
const AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES = ['all-icons', 'display-icons'] as const;
const AGENT_TOOL_DESKTOP_ORGANIZATION_MODE_VALUES = ['execute', 'preview'] as const;
const AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES = ['none', 'kind', 'category', 'extension'] as const;
const AGENT_TOOL_DESKTOP_ICON_DIRECTION_VALUES = ['above', 'below', 'left-of', 'right-of'] as const;
const AGENT_TOOL_OPEN_RESOURCE_TYPE_VALUES = ['auto', 'url', 'file', 'folder', 'app'] as const;
const AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES = ['all', 'screen', 'window'] as const;
const AGENT_TOOL_GAME_COMPANION_LOOP_ACTION_VALUES = ['start', 'stop', 'status'] as const;
const AGENT_TOOL_VOICE_PROVIDER_VALUES = ['browser', 'api', 'local'] as const;
const AGENT_TOOL_WINDOW_CONTROL_STATE_VALUES = ['minimized', 'maximized', 'normal'] as const;
const AGENT_TOOL_WINDOW_CONTROL_SNAP_VALUES = [
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
] as const;
const AGENT_TOOL_WINDOW_COORDINATE_SPACE_VALUES = ['native-screen', 'display'] as const;
const AGENT_TOOL_DESKTOP_INPUT_COORDINATE_SPACE_VALUES = ['native-screen', 'dip'] as const;
const AGENT_TOOL_DESKTOP_ACTION_VALUES = [
  'list_running_apps',
  'list_windows',
  'get_default_app_for_uri',
  'get_default_browser',
  'get_active_window_info',
  'focus_window',
  'focus_browser_window',
  'control_window',
  'resize_window',
  'snap_window',
  'maximize_window',
  'minimize_window',
  'restore_window',
  'open_or_focus_then_control_window',
  'open_then_control_window',
  'launch_then_control_window',
  'focus_then_control_window',
  'open_or_focus_then_move_window_to_display',
  'open_then_move_window_to_display',
  'launch_then_move_window_to_display',
  'move_window',
  'move_window_to_display',
  'move_window_to_screen',
  'move_window_to_monitor',
  'close_window',
  'close_app',
  'open_resource',
  'open_url',
  'launch_local_app',
  'open_app',
  'interact_window_ui',
  'invoke_window_ui',
  'select_window_ui',
  'toggle_window_ui',
  'expand_window_ui',
  'collapse_window_ui',
  'set_window_ui_value',
  'search_web',
] as const;
const AGENT_TOOL_WINDOW_UI_ACTION_VALUES = [
  'auto',
  'invoke',
  'select',
  'toggle',
  'expand',
  'collapse',
  'scroll_into_view',
  'focus',
  'set_value',
] as const;
const AGENT_TOOL_DESKTOP_INPUT_ACTION_VALUES = [
  'move_mouse',
  'click',
  'double_click',
  'right_click',
  'type_text',
  'send_keys',
  'hotkey',
  'drag',
] as const;
const AGENT_TOOL_DESKTOP_OBSERVATION_ACTION_VALUES = [
  'get_display_info',
  'display_info',
  'screen_info',
  'list_displays',
  'get_system_info',
  'system_info',
  'computer_info',
  'get_active_window_info',
  'active_window',
  'foreground_window',
  'inspect_window_ui',
  'window_ui',
  'ui_automation',
  'inspect_controls',
  'list_desktop_items',
  'desktop_items',
  'desktop_icons',
  'list_desktop_icons',
  'diagnose_desktop_icons',
  'desktop_icon_diagnostics',
  'desktop_icon_status',
  'list_running_apps',
  'running_apps',
  'list_windows',
  'list_capture_sources',
  'capture_sources',
  'screen_sources',
  'summarize_visual_snapshot',
  'visual_snapshot',
  'screen_snapshot',
  'window_snapshot',
  'summarize_screen',
  'get_cursor_position',
  'cursor_position',
  'observe_windows_and_apps',
  'windows_and_apps',
  'wait_and_observe',
  'wait_for_ui_state',
  'wait_then_observe',
] as const;
const AGENT_TOOL_CONTROLLED_COMMAND_SHELL_VALUES = ['powershell', 'cmd'] as const;
const AGENT_TOOL_BROWSER_CONTROL_ACTION_VALUES = [
  'open_url',
  'search_web',
  'read_page',
  'focus_tab',
  'list_tabs',
  'status',
] as const;
const AGENT_TOOL_SCREEN_LOCATE_ACTION_VALUES = [
  'ocr_screen',
  'locate_text',
  'locate_element',
  'describe_elements',
] as const;
const AGENT_TOOL_LOCAL_FILE_ACTION_VALUES = [
  'get_path_info',
  'path_info',
  'inspect_path',
  'list_directory',
  'list_dir',
  'list_folder',
  'search_files',
  'search_file',
  'find_file',
  'find_files',
  'read_text_file',
  'read_file',
  'read_text',
] as const;
const AGENT_TOOL_FILE_MANAGEMENT_ACTION_VALUES = [
  'preview',
  'plan',
  'move',
  'move_path',
  'organize_desktop',
  'organize_desktop_file',
  'organize_desktop_files',
  'organize_desktop_items',
  'desktop_file_organization',
  'copy',
  'copy_path',
  'rename',
  'rename_path',
  'mkdir',
  'new_folder',
  'create_folder',
  'create_directory',
  'trash',
  'trash_path',
  'recycle',
  'recycle_path',
] as const;
const AGENT_TOOL_FILE_MANAGEMENT_MODE_VALUES = ['execute', 'preview'] as const;
const AGENT_TOOL_MEMORY_ACTION_VALUES = [
  'list',
  'read',
  'recall',
  'search',
  'remember',
  'add',
  'set',
  'forget',
  'delete',
  'remove',
] as const;
const AGENT_TOOL_MEMORY_SCOPE_VALUES = ['global'] as const;

export const AGENT_TOOL_INPUT_PARAM_SPECS: Record<AgentToolCallName, readonly AgentToolInputParamSpec[]> = {
  browser_search: [
    {
      aliases: ['keyword', 'keywords', 'url', 'website', 'site', 'target'],
      key: 'query',
      required: true,
      type: 'string',
    },
    {
      key: 'forceNewPage',
      type: 'boolean',
    },
  ],
  observe_windows_and_apps: [
    {
      aliases: ['target', 'name', 'title', 'processName'],
      key: 'query',
      type: 'string',
    },
    {
      key: 'includeInstalledApps',
      type: 'boolean',
    },
    {
      key: 'includeTaskbarPinned',
      type: 'boolean',
    },
    {
      key: 'includeRunningApps',
      type: 'boolean',
    },
    {
      key: 'includeActiveWindow',
      type: 'boolean',
    },
    {
      key: 'includeDisplays',
      type: 'boolean',
    },
    {
      key: 'forceRefresh',
      type: 'boolean',
    },
    {
      key: 'limit',
      type: 'number',
    },
  ],
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
  execute_desktop_observation: [
    {
      aliases: ['observationAction', 'desktopObservation', 'operation'],
      enumValues: AGENT_TOOL_DESKTOP_OBSERVATION_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['target', 'sourceName', 'name', 'title', 'processName'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['text', 'label', 'targetElement'],
      key: 'targetText',
      type: 'string',
    },
    {
      aliases: ['targetDescription', 'element', 'description'],
      key: 'targetDescription',
      type: 'string',
    },
    {
      aliases: ['windowHandle', 'handle'],
      key: 'hwnd',
      type: 'number',
    },
    {
      key: 'maxDepth',
      type: 'number',
    },
    {
      aliases: ['display', 'targetDisplay'],
      enumValues: AGENT_TOOL_DISPLAY_TARGET_VALUES,
      key: 'displayTarget',
      type: 'string',
    },
    {
      aliases: ['iconScope'],
      enumValues: AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
      key: 'scope',
      type: 'string',
    },
    {
      aliases: ['group', 'grouping', 'groupStrategy', 'sortGroup'],
      enumValues: AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
      key: 'groupBy',
      type: 'string',
    },
    {
      aliases: ['itemCategory'],
      key: 'category',
      type: 'string',
    },
    {
      aliases: ['itemKind'],
      key: 'kind',
      type: 'string',
    },
    {
      aliases: ['fileExtension', 'suffix'],
      key: 'extension',
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      aliases: ['delayMs', 'durationMs', 'timeoutMs'],
      key: 'waitMs',
      type: 'number',
    },
    {
      aliases: ['captureSourceTypes', 'type'],
      enumValues: AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
      key: 'sourceType',
      type: 'string',
    },
    {
      aliases: ['id'],
      key: 'sourceId',
      type: 'string',
    },
    {
      aliases: ['goal', 'prompt'],
      key: 'question',
      type: 'string',
    },
    {
      key: 'includeDisplays',
      type: 'boolean',
    },
    {
      key: 'includeWindows',
      type: 'boolean',
    },
    {
      aliases: ['includeVisualSnapshot', 'visual'],
      key: 'includeVisual',
      type: 'boolean',
    },
    {
      key: 'includeCaptureThumbnails',
      type: 'boolean',
    },
    {
      key: 'forceRefresh',
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
  locate_screen_elements: [
    {
      aliases: ['visionAction', 'operation'],
      enumValues: AGENT_TOOL_SCREEN_LOCATE_ACTION_VALUES,
      key: 'action',
      type: 'string',
    },
    {
      aliases: ['captureSourceTypes', 'type'],
      enumValues: AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
      key: 'sourceType',
      type: 'string',
    },
    {
      aliases: ['id'],
      key: 'sourceId',
      type: 'string',
    },
    {
      aliases: ['sourceName', 'windowQuery', 'windowTitle', 'source'],
      key: 'sourceQuery',
      type: 'string',
    },
    {
      aliases: ['target', 'sourceName', 'name'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['text', 'label'],
      key: 'targetText',
      type: 'string',
    },
    {
      aliases: ['target', 'targetElement', 'element', 'description'],
      key: 'targetDescription',
      type: 'string',
    },
    {
      aliases: ['goal', 'prompt'],
      key: 'question',
      type: 'string',
    },
    {
      aliases: ['cropCoordinateSpace', 'coordinateSpace'],
      key: 'focusCoordinateSpace',
      type: 'string',
    },
    {
      aliases: ['cropCenterRatioX', 'centerRatioX'],
      key: 'focusCenterRatioX',
      type: 'number',
    },
    {
      aliases: ['cropCenterRatioY', 'centerRatioY'],
      key: 'focusCenterRatioY',
      type: 'number',
    },
    {
      aliases: ['cropWidthRatio', 'widthRatio'],
      key: 'focusWidthRatio',
      type: 'number',
    },
    {
      aliases: ['cropHeightRatio', 'heightRatio'],
      key: 'focusHeightRatio',
      type: 'number',
    },
    {
      aliases: ['cropX', 'x'],
      key: 'focusX',
      type: 'number',
    },
    {
      aliases: ['cropY', 'y'],
      key: 'focusY',
      type: 'number',
    },
    {
      aliases: ['cropWidth', 'width'],
      key: 'focusWidth',
      type: 'number',
    },
    {
      aliases: ['cropHeight', 'height'],
      key: 'focusHeight',
      type: 'number',
    },
    {
      aliases: ['cropPaddingRatio', 'paddingRatio'],
      key: 'focusPaddingRatio',
      type: 'number',
    },
    {
      aliases: ['cropScale', 'magnification', 'zoomScale'],
      key: 'focusScale',
      type: 'number',
    },
    {
      key: 'forceRefresh',
      type: 'boolean',
    },
    {
      aliases: ['fallbackToScreen', 'allowSourceFallback'],
      key: 'allowScreenFallback',
      type: 'boolean',
    },
  ],
  execute_local_file_action: [
    {
      aliases: ['fileAction', 'operation'],
      enumValues: AGENT_TOOL_LOCAL_FILE_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['target', 'folderPath', 'filePath', 'rootPath', 'queryRoot'],
      key: 'path',
      type: 'string',
    },
    {
      aliases: ['nameQuery', 'fileName', 'pattern'],
      key: 'query',
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      key: 'maxDepth',
      type: 'number',
    },
    {
      key: 'maxBytes',
      type: 'number',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
    {
      aliases: ['extension'],
      key: 'extensions',
      type: 'string',
    },
  ],
  execute_file_management_action: [
    {
      aliases: ['fileAction', 'operation'],
      enumValues: AGENT_TOOL_FILE_MANAGEMENT_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['previewAction', 'targetAction'],
      enumValues: AGENT_TOOL_FILE_MANAGEMENT_ACTION_VALUES,
      key: 'intendedAction',
      type: 'string',
    },
    {
      aliases: ['path', 'source', 'from', 'query'],
      key: 'sourcePath',
      type: 'string',
    },
    {
      aliases: ['desktop', 'desktopDirectory', 'desktopFolder'],
      key: 'desktopPath',
      type: 'string',
    },
    {
      aliases: ['targetPath', 'newPath', 'destination', 'dest', 'to'],
      key: 'destinationPath',
      type: 'string',
    },
    {
      aliases: ['targetDirectory', 'folderPath', 'directoryPath', 'parentPath'],
      key: 'destinationDirectory',
      type: 'string',
    },
    {
      aliases: ['name', 'fileName', 'folderName'],
      key: 'newName',
      type: 'string',
    },
    {
      key: 'dryRun',
      type: 'boolean',
    },
    {
      aliases: ['group', 'grouping', 'groupStrategy'],
      enumValues: AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
      key: 'groupBy',
      type: 'string',
    },
    {
      key: 'includeDirectories',
      type: 'boolean',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
    {
      key: 'includeShortcuts',
      type: 'boolean',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      enumValues: AGENT_TOOL_FILE_MANAGEMENT_MODE_VALUES,
      key: 'mode',
      type: 'string',
    },
  ],
  execute_memory_action: [
    {
      aliases: ['memoryAction', 'operation'],
      enumValues: AGENT_TOOL_MEMORY_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['keyword', 'keywords', 'target'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['name', 'preferenceKey'],
      key: 'key',
      type: 'string',
    },
    {
      aliases: ['content', 'text', 'fact', 'preference'],
      key: 'value',
      type: 'string',
    },
    {
      aliases: ['type', 'topic'],
      key: 'category',
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_MEMORY_SCOPE_VALUES,
      key: 'scope',
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
  ],
  get_default_app_for_uri: [
    {
      aliases: ['scheme', 'protocol'],
      key: 'uriScheme',
      type: 'string',
    },
  ],
  get_display_info: [],
  get_system_info: [
    {
      key: 'includeDisplays',
      type: 'boolean',
    },
  ],
  get_pet_settings: [
    {
      key: 'path',
      type: 'string',
    },
    {
      key: 'query',
      type: 'string',
    },
  ],
  update_pet_settings: [
    {
      aliases: ['changes', 'updates'],
      key: 'changesJson',
      required: true,
      type: 'string',
    },
  ],
  get_voice_status: [
    {
      key: 'includeLocalHealth',
      type: 'boolean',
    },
  ],
  list_running_apps: [
    {
      aliases: ['target', 'name'],
      key: 'query',
      type: 'string',
    },
    {
      key: 'includeWindows',
      type: 'boolean',
    },
  ],
  get_active_window_info: [],
  list_capture_sources: [
    {
      aliases: ['sourceType', 'type'],
      enumValues: AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
      key: 'captureSourceTypes',
      type: 'string',
    },
    {
      key: 'includeCaptureThumbnails',
      type: 'boolean',
    },
    {
      key: 'forceRefresh',
      type: 'boolean',
    },
  ],
  summarize_visual_snapshot: [
    {
      aliases: ['captureSourceTypes', 'type'],
      enumValues: AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
      key: 'sourceType',
      type: 'string',
    },
    {
      aliases: ['id'],
      key: 'sourceId',
      type: 'string',
    },
    {
      aliases: ['target', 'sourceName', 'name'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['goal', 'prompt'],
      key: 'question',
      type: 'string',
    },
    {
      aliases: ['cropCoordinateSpace', 'coordinateSpace'],
      key: 'focusCoordinateSpace',
      type: 'string',
    },
    {
      aliases: ['cropCenterRatioX', 'centerRatioX'],
      key: 'focusCenterRatioX',
      type: 'number',
    },
    {
      aliases: ['cropCenterRatioY', 'centerRatioY'],
      key: 'focusCenterRatioY',
      type: 'number',
    },
    {
      aliases: ['cropWidthRatio', 'widthRatio'],
      key: 'focusWidthRatio',
      type: 'number',
    },
    {
      aliases: ['cropHeightRatio', 'heightRatio'],
      key: 'focusHeightRatio',
      type: 'number',
    },
    {
      aliases: ['cropX', 'x'],
      key: 'focusX',
      type: 'number',
    },
    {
      aliases: ['cropY', 'y'],
      key: 'focusY',
      type: 'number',
    },
    {
      aliases: ['cropWidth', 'width'],
      key: 'focusWidth',
      type: 'number',
    },
    {
      aliases: ['cropHeight', 'height'],
      key: 'focusHeight',
      type: 'number',
    },
    {
      aliases: ['cropPaddingRatio', 'paddingRatio'],
      key: 'focusPaddingRatio',
      type: 'number',
    },
    {
      aliases: ['cropScale', 'magnification', 'zoomScale'],
      key: 'focusScale',
      type: 'number',
    },
    {
      key: 'forceRefresh',
      type: 'boolean',
    },
    {
      aliases: ['fallbackToScreen', 'allowSourceFallback'],
      key: 'allowScreenFallback',
      type: 'boolean',
    },
  ],
  analyze_game_screen: [
    {
      aliases: ['captureSourceTypes', 'type'],
      enumValues: AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
      key: 'sourceType',
      type: 'string',
    },
    {
      aliases: ['id'],
      key: 'sourceId',
      type: 'string',
    },
    {
      aliases: ['target', 'sourceName', 'name', 'windowTitle', 'title'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['goal', 'prompt'],
      key: 'question',
      type: 'string',
    },
    {
      aliases: ['gameName', 'game'],
      key: 'gameHint',
      type: 'string',
    },
    {
      aliases: ['analysisFocus', 'topic'],
      key: 'focus',
      type: 'string',
    },
    {
      key: 'forceRefresh',
      type: 'boolean',
    },
  ],
  manage_game_companion_loop: [
    {
      aliases: ['mode', 'operation'],
      enumValues: AGENT_TOOL_GAME_COMPANION_LOOP_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['captureSourceTypes', 'type'],
      enumValues: AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
      key: 'sourceType',
      type: 'string',
    },
    {
      aliases: ['id'],
      key: 'sourceId',
      type: 'string',
    },
    {
      aliases: ['target', 'sourceName', 'name', 'windowTitle', 'title'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['gameName', 'game'],
      key: 'gameHint',
      type: 'string',
    },
    {
      aliases: ['analysisFocus', 'topic'],
      key: 'focus',
      type: 'string',
    },
    {
      aliases: ['sampleEveryMs'],
      key: 'intervalMs',
      type: 'number',
    },
    {
      aliases: ['commentCooldownMs', 'minSpeakIntervalMs'],
      key: 'minCommentIntervalMs',
      type: 'number',
    },
    {
      key: 'maxSamples',
      type: 'number',
    },
  ],
  get_cursor_position: [],
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
  inspect_local_project: [
    {
      aliases: ['projectPath', 'folderPath', 'filePath', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      key: 'question',
      type: 'string',
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
  search_web: [
    {
      aliases: ['keyword', 'keywords', 'target'],
      key: 'query',
      required: true,
      type: 'string',
    },
    {
      key: 'forceNewPage',
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
  ],
  get_path_info: [
    {
      aliases: ['target', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
  ],
  list_directory: [
    {
      aliases: ['folderPath', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
  ],
  search_files: [
    {
      aliases: ['folderPath', 'rootPath', 'queryRoot'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      aliases: ['nameQuery', 'fileName', 'pattern'],
      key: 'query',
      required: true,
      type: 'string',
    },
    {
      key: 'maxDepth',
      type: 'number',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
    {
      aliases: ['extension'],
      key: 'extensions',
      type: 'string',
    },
  ],
  read_text_file: [
    {
      aliases: ['filePath', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      key: 'maxBytes',
      type: 'number',
    },
  ],
  set_voice_input: [
    {
      key: 'enabled',
      required: true,
      type: 'boolean',
    },
  ],
  start_voice_input_session: [
    {
      key: 'agentPrefix',
      type: 'boolean',
    },
  ],
  stop_voice_input_session: [],
  switch_tts_provider: [
    {
      aliases: ['ttsProvider'],
      enumValues: AGENT_TOOL_VOICE_PROVIDER_VALUES,
      key: 'provider',
      required: true,
      type: 'string',
    },
    {
      key: 'enableVoice',
      type: 'boolean',
    },
    {
      key: 'autoSpeak',
      type: 'boolean',
    },
  ],
  warmup_local_voice: [],
  run_local_project_action: [
    {
      aliases: ['projectPath', 'folderPath', 'filePath', 'query'],
      key: 'path',
      type: 'string',
    },
    {
      aliases: ['index'],
      key: 'actionIndex',
      type: 'number',
    },
    {
      key: 'command',
      type: 'string',
    },
    {
      key: 'label',
      type: 'string',
    },
    {
      key: 'question',
      type: 'string',
    },
  ],
  list_agent_skills: [
    {
      key: 'query',
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
  ],
  execute_agent_skill: [
    {
      key: 'skillId',
      required: true,
      type: 'string',
    },
    {
      key: 'intent',
      type: 'string',
    },
    {
      key: 'target',
      type: 'string',
    },
    {
      key: 'inputJson',
      type: 'string',
    },
    {
      key: 'dryRun',
      type: 'boolean',
    },
  ],
  list_mcp_tools: [
    {
      key: 'serverId',
      type: 'string',
    },
  ],
  call_mcp_tool: [
    {
      key: 'serverId',
      required: true,
      type: 'string',
    },
    {
      aliases: ['toolName'],
      key: 'name',
      required: true,
      type: 'string',
    },
    {
      key: 'argumentsJson',
      type: 'string',
    },
  ],
};

export function getAgentToolInputParamSpecs(toolName: AgentToolCallName) {
  return AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
}

export function getAgentToolInputParamRawValue(
  input: Record<string, unknown>,
  spec: AgentToolInputParamSpec,
) {
  const keys = [spec.key, ...(spec.aliases ?? [])];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return input[key];
    }
  }

  return undefined;
}

export function formatAgentToolInputParamType(type: AgentToolInputParamType) {
  if (type === 'string') {
    return 'string';
  }

  if (type === 'number') {
    return 'number';
  }

  return 'boolean';
}

function isAgentToolInputRequired(
  toolName: AgentToolCallName,
  spec: AgentToolInputParamSpec,
  input: Record<string, unknown>,
) {
  if (!spec.required) {
    return false;
  }

  if (toolName !== 'execute_desktop_sequence' || spec.key !== 'stepsJson') {
    return true;
  }

  const mode = typeof input.mode === 'string' ? input.mode.trim().toLowerCase() : '';
  const visibleClickJson = typeof input.visibleClickJson === 'string' ? input.visibleClickJson.trim() : '';
  return !(mode === 'visible_click' || mode === 'visibleclick' || Boolean(visibleClickJson));
}

export function prepareAgentToolInput(
  toolName: AgentToolCallName,
  input: Record<string, unknown>,
): AgentToolInputPrepareResult {
  const normalizedInput: Record<string, unknown> = {};
  const specs = getAgentToolInputParamSpecs(toolName);

  for (const spec of specs) {
    const rawValue = getAgentToolInputParamRawValue(input, spec);
    const normalizedRawValue = toolName === 'update_pet_settings'
      && spec.key === 'changesJson'
      && rawValue
      && typeof rawValue === 'object'
      && !Array.isArray(rawValue)
      ? JSON.stringify(rawValue)
      : rawValue;
    const isMissing = normalizedRawValue === undefined || normalizedRawValue === null || (
      typeof normalizedRawValue === 'string' && !normalizedRawValue.trim()
    );

    if (isMissing) {
      if (isAgentToolInputRequired(toolName, spec, input)) {
        return {
          error: `Agent tool "${toolName}" is missing required parameter "${spec.key}".`,
          ok: false,
        };
      }

      continue;
    }

    if (spec.type === 'string') {
      if (typeof normalizedRawValue !== 'string') {
        return {
          error: `Agent tool "${toolName}" parameter "${spec.key}" must be ${formatAgentToolInputParamType(spec.type)}.`,
          ok: false,
        };
      }

      const normalizedValue = normalizedRawValue.trim();
      if (spec.enumValues && !spec.enumValues.includes(normalizedValue)) {
        return {
          error: `Agent tool "${toolName}" parameter "${spec.key}" must be one of: ${spec.enumValues.join(', ')}.`,
          ok: false,
        };
      }

      normalizedInput[spec.key] = normalizedValue;
      continue;
    }

    if (spec.type === 'boolean') {
      if (typeof normalizedRawValue !== 'boolean') {
        return {
          error: `Agent tool "${toolName}" parameter "${spec.key}" must be ${formatAgentToolInputParamType(spec.type)}.`,
          ok: false,
        };
      }

      normalizedInput[spec.key] = normalizedRawValue;
      continue;
    }

    const normalizedValue = typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number(rawValue.trim())
        : NaN;

    if (!Number.isFinite(normalizedValue)) {
      return {
        error: `Agent tool "${toolName}" parameter "${spec.key}" must be ${formatAgentToolInputParamType(spec.type)}.`,
        ok: false,
      };
    }

    normalizedInput[spec.key] = normalizedValue;
  }

  return {
    input: {
      ...input,
      ...normalizedInput,
    },
    ok: true,
  };
}
