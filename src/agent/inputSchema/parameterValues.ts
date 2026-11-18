export const AGENT_TOOL_DISPLAY_TARGET_VALUES = ['primary', 'secondary', 'current', 'all'] as const;

export const AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES = ['all-icons', 'display-icons'] as const;

export const AGENT_TOOL_DESKTOP_ORGANIZATION_MODE_VALUES = ['execute', 'preview'] as const;

export const AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES = ['none', 'kind', 'category', 'extension'] as const;

export const AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES = ['all', 'screen', 'window'] as const;

export const AGENT_TOOL_GAME_COMPANION_LOOP_ACTION_VALUES = ['start', 'stop', 'status'] as const;

export const AGENT_TOOL_CONTROLLED_COMMAND_SHELL_VALUES = ['powershell', 'cmd'] as const;

export const AGENT_TOOL_BROWSER_CONTROL_ACTION_VALUES = [
  'open_url',
  'search_web',
  'read_page',
  'focus_tab',
  'list_tabs',
  'status',
] as const;

export const AGENT_TOOL_MEMORY_ACTION_VALUES = [
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

export const AGENT_TOOL_MEMORY_SCOPE_VALUES = ['global'] as const;
