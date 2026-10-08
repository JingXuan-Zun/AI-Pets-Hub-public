import { type AgentToolCallName } from '../agentChatCommand';
import { type AgentToolInputParamSpec } from '../agentToolInputSchema';
import {
  AGENT_TOOL_DISPLAY_TARGET_VALUES,
  AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
  AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
  AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
  AGENT_TOOL_DESKTOP_OBSERVATION_ACTION_VALUES,
  AGENT_TOOL_SCREEN_LOCATE_ACTION_VALUES,
} from './parameterValues';

export const AGENT_OBSERVATION_INPUT_SPECS = {
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
  get_cursor_position: [],
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
  ]
} satisfies Partial<Record<AgentToolCallName, readonly AgentToolInputParamSpec[]>>;
