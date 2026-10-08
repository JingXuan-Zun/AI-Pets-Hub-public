export const AGENT_TOOL_DISPLAY_TARGET_VALUES = ['primary', 'secondary', 'current', 'all'] as const;

export const AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES = ['all-icons', 'display-icons'] as const;

export const AGENT_TOOL_DESKTOP_ORGANIZATION_MODE_VALUES = ['execute', 'preview'] as const;

export const AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES = ['none', 'kind', 'category', 'extension'] as const;

export const AGENT_TOOL_DESKTOP_ICON_DIRECTION_VALUES = ['above', 'below', 'left-of', 'right-of'] as const;

export const AGENT_TOOL_OPEN_RESOURCE_TYPE_VALUES = ['auto', 'url', 'file', 'folder', 'app'] as const;

export const AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES = ['all', 'screen', 'window'] as const;

export const AGENT_TOOL_GAME_COMPANION_LOOP_ACTION_VALUES = ['start', 'stop', 'status'] as const;

export const AGENT_TOOL_VOICE_PROVIDER_VALUES = ['browser', 'api', 'local'] as const;

export const AGENT_TOOL_WINDOW_CONTROL_STATE_VALUES = ['minimized', 'maximized', 'normal'] as const;

export const AGENT_TOOL_WINDOW_CONTROL_SNAP_VALUES = [
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

export const AGENT_TOOL_WINDOW_COORDINATE_SPACE_VALUES = ['native-screen', 'display'] as const;

export const AGENT_TOOL_DESKTOP_INPUT_COORDINATE_SPACE_VALUES = ['native-screen', 'dip'] as const;

export const AGENT_TOOL_DESKTOP_ACTION_VALUES = [
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

export const AGENT_TOOL_WINDOW_UI_ACTION_VALUES = [
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

export const AGENT_TOOL_DESKTOP_INPUT_ACTION_VALUES = [
  'move_mouse',
  'click',
  'double_click',
  'right_click',
  'type_text',
  'send_keys',
  'hotkey',
  'drag',
] as const;

export const AGENT_TOOL_DESKTOP_OBSERVATION_ACTION_VALUES = [
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

export const AGENT_TOOL_CONTROLLED_COMMAND_SHELL_VALUES = ['powershell', 'cmd'] as const;

export const AGENT_TOOL_BROWSER_CONTROL_ACTION_VALUES = [
  'open_url',
  'search_web',
  'read_page',
  'focus_tab',
  'list_tabs',
  'status',
] as const;

export const AGENT_TOOL_SCREEN_LOCATE_ACTION_VALUES = [
  'ocr_screen',
  'locate_text',
  'locate_element',
  'describe_elements',
] as const;

export const AGENT_TOOL_LOCAL_FILE_ACTION_VALUES = [
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

export const AGENT_TOOL_FILE_MANAGEMENT_ACTION_VALUES = [
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

export const AGENT_TOOL_FILE_MANAGEMENT_MODE_VALUES = ['execute', 'preview'] as const;

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
