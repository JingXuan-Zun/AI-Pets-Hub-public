import {
  type AgentCapabilityId,
  type AgentToolActionKind,
} from './agentCapabilityTypes';
import { type AgentToolCallName } from './agentChatCommand';

export interface AgentToolDefinition {
  argsSchemaText: string;
  capabilityId: AgentCapabilityId;
  description: string;
  name: AgentToolCallName;
  plannerGuidance: string;
  toolActions: AgentToolActionKind[];
}

export interface AgentToolLifecycleMetadata {
  mutates: string[];
  observes: string[];
  recoversWith: AgentToolCallName[];
  verifies: string[];
}

export const AGENT_TOOL_REGISTRY: AgentToolDefinition[] = [
  {
    argsSchemaText: '{ "query": string, "forceNew"?: boolean }',
    capabilityId: 'app-launcher',
    description: 'open or focus a local app',
    name: 'launch_local_app',
    plannerGuidance: 'Use forceNew only when the user explicitly asks for a new instance.',
    toolActions: ['search-local-app', 'launch-local-app'],
  },
  {
    argsSchemaText: '{ "query": string, "forceNewPage"?: boolean }',
    capabilityId: 'app-launcher',
    description: 'legacy browser search/read tool; prefer search_web for new AgentSessionV2 search tasks',
    name: 'browser_search',
    plannerGuidance: 'Legacy compatibility tool. Do not use it to open a direct URL; use open_resource for URLs and search_web for search queries. Do not use it for video summary unless the user explicitly asked to search/find videos.',
    toolActions: ['browser-search'],
  },
  {
    argsSchemaText: '{ "query"?: string, "includeInstalledApps"?: boolean, "includeTaskbarPinned"?: boolean, "includeRunningApps"?: boolean, "includeActiveWindow"?: boolean, "includeDisplays"?: boolean, "forceRefresh"?: boolean, "limit"?: number }',
    capabilityId: 'app-launcher',
    description: 'observe installed app entries, taskbar pinned shortcuts, running windows, active window, executable paths, and best-effort display ownership',
    name: 'observe_windows_and_apps',
    plannerGuidance: 'Use this before deciding how to open, focus, close, or reason about apps/windows when installed/running/taskbar/display state matters. This is read-only and can run in parallel with other read-only observations.',
    toolActions: ['observe-windows-and-apps'],
  },
  {
    argsSchemaText: '{ "action": "list_running_apps" | "get_default_app_for_uri" | "get_active_window_info" | "focus_window" | "control_window" | "move_window_to_display" | "close_window" | "open_resource" | "launch_local_app" | "interact_window_ui" | "invoke_window_ui" | "search_web", "target"?: string, "query"?: string, "targetText"?: string, "targetDescription"?: string, "automationId"?: string, "controlType"?: string, "uiAction"?: "auto" | "invoke" | "select" | "toggle" | "expand" | "collapse" | "scroll_into_view" | "focus" | "set_value", "value"?: string, "targetDisplay"?: "primary" | "secondary" | "current" | string, "displayId"?: string, "position"?: "center" | "top-left", "preserveSize"?: boolean, "fallbackToActiveWindow"?: boolean, "windowState"?: "minimized" | "maximized" | "normal", "snap"?: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center", "coordinateSpace"?: "native-screen" | "display", "x"?: number, "y"?: number, "width"?: number, "height"?: number, "resourceType"?: "auto" | "url" | "file" | "folder" | "app", "uriScheme"?: string, "forceNew"?: boolean, "forceNewPage"?: boolean, "includeWindows"?: boolean, "pid"?: number, "hwnd"?: number }',
    capabilityId: 'app-launcher',
    description: 'generic desktop action router for composable app/window/browser/resource actions',
    name: 'execute_desktop_action',
    plannerGuidance: 'Prefer this for one desktop app/window/browser/resource primitive. Choose an action, observe first when target/default/running/display/UI state is uncertain, and let permission checks pause before focus/control/move/close/open/launch/UI-interact/search actions. Use action "control_window" for maximizing, minimizing, restoring, snapping, resizing, or coordinate-based window bounds control. Use action "interact_window_ui" only after inspect_window_ui or visual evidence identifies an actionable UI Automation control; pass targetText/automationId/controlType/hwnd/query from that evidence and set uiAction to invoke/select/toggle/expand/collapse/scroll_into_view/focus/set_value when known, otherwise auto. For controls with scroll-into-view support or offscreen list/tree items, use uiAction "scroll_into_view" first, then observe again or invoke/select the now-visible control. Use uiAction "focus" when the next generic step is keyboard confirmation or text input and the target is keyboardFocusable. For moving an already available window to another monitor, call action "move_window_to_display". For multi-step operations such as open/focus then move/control/type/UI-interact, prefer execute_desktop_sequence so the model composes generic primitives with one approval.',
    toolActions: [
      'list-running-apps',
      'get-default-app-for-uri',
      'get-active-window-info',
      'focus-window',
      'control-window',
      'move-window-to-display',
      'close-window',
      'open-resource',
      'launch-local-app',
      'interact-window-ui',
      'invoke-window-ui',
      'search-web',
    ],
  },
  {
    argsSchemaText: '{ "action": "move_mouse" | "click" | "double_click" | "right_click" | "type_text" | "send_keys" | "hotkey" | "drag", "coordinateSpace"?: "native-screen" | "dip", "x"?: number, "y"?: number, "fromX"?: number, "fromY"?: number, "toX"?: number, "toY"?: number, "button"?: "left" | "right" | "middle", "text"?: string, "keys"?: string, "hotkey"?: string, "steps"?: number, "expectedForegroundHwnd"?: number, "expectedForegroundPid"?: number, "expectedForegroundTitle"?: string, "expectedForegroundProcessName"?: string }',
    capabilityId: 'app-launcher',
    description: 'execute low-level desktop input primitives such as mouse move/click/drag, typing, SendKeys, and hotkeys',
    name: 'execute_desktop_input',
    plannerGuidance: 'Use only when the target coordinate/window/input field is clear from observation or user instruction. Prefer observe/locate tools first. This changes the active desktop and always requires approval.',
    toolActions: ['execute-desktop-input'],
  },
  {
    argsSchemaText: '{ "stepsJson"?: string, "mode"?: "visible_click", "visibleClickJson"?: string, "app"?: string, "target"?: string, "requireSameHwnd"?: boolean, "requireActionable"?: boolean, "stopOnError"?: boolean, "postVerify"?: boolean, "postVerifyRequired"?: boolean, "postVerifyQuery"?: string, "postVerifyVisualQuery"?: string } where stepsJson is a JSON array of up to 8 steps: [{ "tool": "execute_desktop_action" | "execute_desktop_input", "args": object, "reason"?: string }]. In visible_click mode, pass app and target instead of stepsJson so runtime focuses the app, captures that window, locates the target, runs one visible pointer click, then verifies the same app/window state.',
    capabilityId: 'app-launcher',
    description: 'execute a short approved sequence of generic desktop action/input primitives and return per-step evidence',
    name: 'execute_desktop_sequence',
    plannerGuidance: 'Use after the needed facts are already known and the user requested a multi-step desktop operation that can be expressed as execute_desktop_action plus execute_desktop_input steps. Observe first when app/window/display/coordinate state is uncertain. Do not use it for read-only observation batching; use tool_calls for independent silent observations. Prefer this whenever multiple approval-required primitives are already known, so the app can ask once instead of asking for open/focus, then move/click/type separately. visible_click is a runtime-internal dispatch mode for an already resolved actionable target; do not request it before a window-bound target and audited coordinate are available. Examples such as app="WeGame", target="登录按钮" or app="QQ", target="登录按钮" are illustrative only: the behavior is not app-specific and must not hard-code coordinates. When the model nevertheless requests unresolved visible_click, AgentSessionV2 converts it to a silent window-only locate preflight and delays approval until the target is actionable. After approval, visible_click focuses the app, confirms the target in that app window, moves the visible cursor, clicks once, and verifies after the click. The app asks for approval once, then runtime executes steps in order, stops on the first failure by default, and performs a generic post-run desktop observation when the sequence changes windows/apps or uses desktop input. Use postVerifyQuery for the expected app/window/content name when known. Use postVerifyVisualQuery when the final state depends on visible in-app UI; visual verification returns structuredEvidence.postActionState such as launched, waiting_target, loading, login_required, updating, error, unchanged, blocked, selection_mismatch, visible_only, or unknown, plus structuredEvidence.selectionVerificationStatus and structuredEvidence.postActionRecovery when the outcome is not confirmed. waiting_target means the start/open/play action appears sent and runtime should poll target process/window evidence instead of retrying the same click.',
    toolActions: ['execute-desktop-sequence'],
  },
  {
    argsSchemaText: '{ "uriScheme"?: string }',
    capabilityId: 'app-launcher',
    description: 'read the OS default app for a URI scheme such as https or http',
    name: 'get_default_app_for_uri',
    plannerGuidance: 'Use before choosing an app for a URL/browser-like task when user preference is unknown. Read-only.',
    toolActions: ['get-default-app-for-uri'],
  },
  {
    argsSchemaText: '{ "query"?: string, "includeWindows"?: boolean }',
    capabilityId: 'app-launcher',
    description: 'list currently running apps/windows, optionally filtered by query',
    name: 'list_running_apps',
    plannerGuidance: 'Use to observe existing windows before deciding whether to focus or launch something.',
    toolActions: ['list-running-apps'],
  },
  {
    argsSchemaText: '{}',
    capabilityId: 'desktop-observation',
    description: 'read the current foreground window process, title, pid, and executable path',
    name: 'get_active_window_info',
    plannerGuidance: 'Use before deciding how to interact with the current app/window. Read-only.',
    toolActions: ['get-active-window-info'],
  },
  {
    argsSchemaText: '{ "action": "get_display_info" | "list_desktop_items" | "diagnose_desktop_icons" | "get_system_info" | "get_active_window_info" | "inspect_window_ui" | "list_running_apps" | "list_capture_sources" | "summarize_visual_snapshot" | "wait_and_observe" | "get_cursor_position", "query"?: string, "targetText"?: string, "targetDescription"?: string, "hwnd"?: number, "maxDepth"?: number, "displayTarget"?: "primary" | "secondary" | "all", "scope"?: "all-icons" | "display-icons", "groupBy"?: "none" | "kind" | "category" | "extension", "category"?: string, "kind"?: string, "extension"?: string, "limit"?: number, "waitMs"?: number, "sourceType"?: "screen" | "window" | "all", "sourceId"?: string, "question"?: string, "includeDisplays"?: boolean, "includeWindows"?: boolean, "includeVisual"?: boolean, "includeCaptureThumbnails"?: boolean, "forceRefresh"?: boolean }',
    capabilityId: 'desktop-observation',
    description: 'generic desktop observation router for display, desktop item, system, window, capture-source, visual snapshot, and cursor facts',
    name: 'execute_desktop_observation',
    plannerGuidance: 'Prefer this for generic desktop/environment observation tasks when the model needs to compose perception primitives. Use action "list_desktop_items" to inspect desktop icons/items by category, kind, extension, display, or name for read-only inventory questions. Use action "diagnose_desktop_icons" when desktop icon reading, secondary-display ownership, movable coordinates, or organization readiness is uncertain. Use action "inspect_window_ui" to read Windows UI Automation controls from the active or named window before operating inside apps/launchers/settings pages; it returns control names, types, supported actions, bounds, targetCandidates/actionCandidates, and is read-only. Use action "wait_and_observe" after loading/updating/uncertain UI transitions; set waitMs for the delay and includeVisual only when visible UI evidence is needed. For a direct desktop organization request, prefer organize_desktop_icons mode "preview" because it already reads displays, desktop icons, metadata, classification, and grouping in one preflight call. Read-only observations are silent; visual/capture observations may notify. Use summarize_visual_snapshot only when visible screen/window content is needed.',
    toolActions: [
      'read-display-info',
      'list-desktop-icons',
      'diagnose-desktop-icons',
      'read-system-info',
      'get-active-window-info',
      'inspect-window-ui',
      'list-running-apps',
      'list-capture-sources',
      'capture-screen-context',
      'observe-windows-and-apps',
      'get-cursor-position',
    ],
  },
  {
    argsSchemaText: '{ "captureSourceTypes"?: "screen" | "window" | "all", "includeCaptureThumbnails"?: boolean, "forceRefresh"?: boolean }',
    capabilityId: 'desktop-observation',
    description: 'list available screen/window capture sources with names, sizes, and optional thumbnail availability',
    name: 'list_capture_sources',
    plannerGuidance: 'Use to observe what screens/windows can be visually captured. This is visual context and may show screen/window thumbnails; do not use for text-only system facts.',
    toolActions: ['list-capture-sources'],
  },
  {
    argsSchemaText: '{ "sourceType"?: "screen" | "window" | "all", "sourceId"?: string, "query"?: string, "question"?: string, "focusCenterRatioX"?: number, "focusCenterRatioY"?: number, "focusWidthRatio"?: number, "focusHeightRatio"?: number, "focusX"?: number, "focusY"?: number, "focusWidth"?: number, "focusHeight"?: number, "focusCoordinateSpace"?: "native-screen" | "source" | "source-ratio", "focusPaddingRatio"?: number, "focusScale"?: number, "forceRefresh"?: boolean, "allowScreenFallback"?: boolean }',
    capabilityId: 'desktop-observation',
    description: 'capture one screen/window thumbnail and summarize visible content as text evidence',
    name: 'summarize_visual_snapshot',
    plannerGuidance: 'Use when the user asks what is visible on screen/window or needs visual evidence. For current/visible video summary requests, this can summarize the visible frame/page evidence but not the whole video/audio. When a previous visual result gives candidate centerRatio/bounds or small/ambiguous UI evidence, pass focusCenterRatioX/focusCenterRatioY plus focusWidthRatio/focusHeightRatio, or focusX/focusY/focusWidth/focusHeight with focusCoordinateSpace, to crop and inspect that region more closely. For post-action recovery or verification where the target window title/source may have changed, allowScreenFallback can fall back from an unmatched all-source query to a screen snapshot; keep explicit sourceType "window" strict when the user specifically requested one window. For tiny text/buttons/icons, set focusScale around 2-3; otherwise the tool auto-upscales small focus crops. This returns text evidence and never returns raw image data to AgentSessionV2.',
    toolActions: ['capture-screen-context'],
  },
  {
    argsSchemaText: '{ "action"?: "ocr_screen" | "locate_text" | "locate_element" | "describe_elements", "sourceType"?: "screen" | "window" | "all", "sourceId"?: string, "sourceQuery"?: string, "targetText"?: string, "targetDescription"?: string, "question"?: string, "focusCenterRatioX"?: number, "focusCenterRatioY"?: number, "focusWidthRatio"?: number, "focusHeightRatio"?: number, "focusX"?: number, "focusY"?: number, "focusWidth"?: number, "focusHeight"?: number, "focusCoordinateSpace"?: "native-screen" | "source" | "source-ratio", "focusPaddingRatio"?: number, "focusScale"?: number, "forceRefresh"?: boolean, "allowScreenFallback"?: boolean }',
    capabilityId: 'desktop-observation',
    description: 'capture a screen/window and ask the vision model to read visible text, locate approximate screen elements, or identify a target item and its associated primary action button inside an app UI',
    name: 'locate_screen_elements',
    plannerGuidance: 'Use when the user asks where visible text/button/UI/game element is, or when input automation needs a visual target. For in-app/launcher tasks such as "open B inside A", use sourceQuery for the outer app/window A unless sourceId came from list_capture_sources or a previous visual tool result; use targetText/targetDescription for B. Ask for the target item, current selected/detail item, selectionVerificationStatus, primary open/start/play button associated with that target, and relation between them. Check structuredEvidence.launcherVerification when present: status=ready with targetVisible=true, targetSelected/detailMatchesTarget not false, and primaryActionMatchesTarget=true can flow to approval-required input; targetSelected=false, detailMatchesTarget=false, primaryActionMatchesTarget=false, or status needs-* means recover first. Otherwise check structuredEvidence.visualActionReadiness: ready can flow to approval-required input only when selectionVerificationStatus is not visible-only/mismatch for list/detail launchers; needs-target-selection/needs-primary-action/needs-coordinate/needs-relation/low-confidence means recover missing evidence first. When targetCandidates/actionCandidates are returned, use them to narrow the target/action; if a candidate has centerRatio or bounds, rerun this tool with focus crop params around that candidate before asking the user. During post-action recovery, allowScreenFallback may use a visible screen snapshot if the app window capture source cannot be matched after a transition. For small text/buttons/icons, use focusScale 2-3 or rely on auto-upscaled focus crops. v1 returns approximate vision evidence, not pixel-perfect OCR coordinates. Ask for confirmation before clicking based on uncertain visual location.',
    toolActions: ['locate-screen-elements'],
  },
  {
    argsSchemaText: '{}',
    capabilityId: 'desktop-observation',
    description: 'read the current mouse cursor DIP position',
    name: 'get_cursor_position',
    plannerGuidance: 'Use when the user refers to the current mouse position, cursor location, or "where I am pointing". Read-only.',
    toolActions: ['get-cursor-position'],
  },
  {
    argsSchemaText: '{ "sourceType"?: "screen" | "window" | "all", "sourceId"?: string, "query"?: string, "question"?: string, "gameHint"?: string, "focus"?: string, "forceRefresh"?: boolean }',
    capabilityId: 'game-companion',
    description: 'capture one game screen/window thumbnail and analyze visible game content, HUD, player situation, and uncertainty as text evidence',
    name: 'analyze_game_screen',
    plannerGuidance: 'Use when the user asks what game they are playing, what is happening in gameplay, or wants the pet to understand game content. Prefer get_active_window_info or list_capture_sources first if the target game window is unclear. This is a single visual analysis step, not continuous game companion mode.',
    toolActions: ['observe-game-window'],
  },
  {
    argsSchemaText: '{ "action": "start" | "stop" | "status", "sourceType"?: "screen" | "window" | "all", "sourceId"?: string, "query"?: string, "gameHint"?: string, "focus"?: string, "intervalMs"?: number, "minCommentIntervalMs"?: number, "maxSamples"?: number }',
    capabilityId: 'game-companion',
    description: 'start, stop, or inspect a low-frequency game companion loop that samples a locked game screen/window and posts short companion observations',
    name: 'manage_game_companion_loop',
    plannerGuidance: 'Use when the user wants ongoing game companionship, low-frequency game watching, or wants the pet to keep commenting while they play. Start only after the user clearly requests continuous observation; use stop when the user asks to stop watching/commenting. This loop samples periodically and should not be used for a one-time question.',
    toolActions: ['manage-game-companion-loop'],
  },
  {
    argsSchemaText: '{ "query": string }',
    capabilityId: 'app-launcher',
    description: 'focus an existing app/window by process name or window title',
    name: 'focus_window',
    plannerGuidance: 'Use only when the user wants an existing window brought forward or after list_running_apps identifies a target. Requires confirmation.',
    toolActions: ['focus-window'],
  },
  {
    argsSchemaText: '{ "query"?: string, "pid"?: number, "hwnd"?: number }',
    capabilityId: 'app-launcher',
    description: 'close an existing app/window by process name, window title, pid, or window handle',
    name: 'close_window',
    plannerGuidance: 'Use when the user asks to close an existing app/window. Prefer list_running_apps first if the target is ambiguous. This sends a normal window close request and may leave save-confirmation dialogs open.',
    toolActions: ['close-window'],
  },
  {
    argsSchemaText: '{ "target": string, "resourceType"?: "auto" | "url" | "file" | "folder" | "app", "forceNew"?: boolean }',
    capabilityId: 'app-launcher',
    description: 'open a URL, file, folder, or app target using the operating system',
    name: 'open_resource',
    plannerGuidance: 'Use for direct URLs/domains, local files/folders, or generic open requests. For keywords, use search_web instead. Requires confirmation.',
    toolActions: ['open-resource'],
  },
  {
    argsSchemaText: '{ "query": string, "forceNewPage"?: boolean }',
    capabilityId: 'app-launcher',
    description: 'search the web for a query and return available page evidence',
    name: 'search_web',
    plannerGuidance: 'Use only for search intent. Do not use for direct domains, URLs, or video summary requests unless the user explicitly asked to search/find videos; use open_resource/control_browser/visual observation instead.',
    toolActions: ['search-web'],
  },
  {
    argsSchemaText: '{ "action": "open_url" | "search_web" | "read_page" | "focus_tab" | "list_tabs" | "status", "url"?: string, "query"?: string, "tabId"?: string, "title"?: string, "forceNewPage"?: boolean, "forceOpen"?: boolean, "readPage"?: boolean }',
    capabilityId: 'app-launcher',
    description: 'control the app managed browser session: open URL, search web, list/focus tabs, read current page text, or inspect browser status',
    name: 'control_browser',
    plannerGuidance: 'Use for browser tasks that need direct URL navigation, page reading, tab listing/focusing, or controlled search. Use open_url for URLs/domains and search_web only for keyword search. For video summary, prefer open_url/read_page/list_tabs if the video page is known; do not search for candidate videos unless the user asked to search. read_page/list_tabs/status are read-only; open_url/search/focus mutate browser state and need approval.',
    toolActions: ['control-browser-read', 'control-browser-open'],
  },
  {
    argsSchemaText: '{ "command": string, "cwd"?: string, "shell"?: "powershell" | "cmd", "timeoutMs"?: number }',
    capabilityId: 'system-inspector',
    description: 'run one controlled local shell command and return stdout, stderr, exitCode, cwd, and safety blocking details',
    name: 'run_controlled_command',
    plannerGuidance: 'Use when existing tools are not enough and a small diagnostic command can answer the user. The runtime blocks destructive patterns, shell chaining, redirection, and pipes in v1; still request approval before execution. Prefer dedicated read-only tools when available.',
    toolActions: ['run-controlled-command'],
  },
  {
    argsSchemaText: '{ "alias": string, "path": string }',
    capabilityId: 'app-launcher',
    description: 'remember a user-provided app path',
    name: 'remember_local_app',
    plannerGuidance: 'Use when the user provides a local exe/lnk/url/appref-ms path and asks the agent to remember it.',
    toolActions: ['remember-local-app'],
  },
  {
    argsSchemaText: '{ "action": "list" | "recall" | "remember" | "forget", "query"?: string, "key"?: string, "value"?: string, "category"?: string, "scope"?: "global", "limit"?: number }',
    capabilityId: 'agent-memory',
    description: 'generic Agent memory router for recalling, listing, remembering, or forgetting user-approved long-term facts and preferences',
    name: 'execute_memory_action',
    plannerGuidance: 'Use this for durable user preferences, aliases, and facts that should affect future Agent decisions. Read/list/recall actions are read-only. Remember/forget actions require approval and only operate on global Agent memory in v1. Do not use memory for current local computer facts.',
    toolActions: ['read-agent-memory', 'remember-agent-memory', 'forget-agent-memory'],
  },
  {
    argsSchemaText: '{ "path": string }',
    capabilityId: 'local-file-system',
    description: 'read metadata for a local absolute path without reading file content',
    name: 'get_path_info',
    plannerGuidance: 'Use before choosing list_directory or read_text_file when the user provides a local path and the kind is unknown. Read-only.',
    toolActions: ['get-path-info'],
  },
  {
    argsSchemaText: '{ "path": string, "limit"?: number, "includeHidden"?: boolean }',
    capabilityId: 'local-file-system',
    description: 'list entries in a local directory',
    name: 'list_directory',
    plannerGuidance: 'Use to observe a folder before deciding what to read or search. Requires an absolute path. Read-only.',
    toolActions: ['list-directory'],
  },
  {
    argsSchemaText: '{ "action": "get_path_info" | "list_directory" | "search_files" | "read_text_file", "path"?: string, "query"?: string, "limit"?: number, "maxDepth"?: number, "maxBytes"?: number, "includeHidden"?: boolean, "extensions"?: string }',
    capabilityId: 'local-file-system',
    description: 'generic read-only local file action router for path inspection, directory listing, file-name search, and small text reads',
    name: 'execute_local_file_action',
    plannerGuidance: 'Prefer this for generic local file observation tasks when the model needs to compose filesystem primitives. It is read-only. Ask for an absolute path when missing. If the user asks whether a known folder contains an app, launcher, shortcut, executable, or startup method, use action "search_files" under that folder rather than only listing the top-level directory; for app launchers prefer extensions ".exe,.lnk,.url,.appref-ms" and a bounded maxDepth. Do not use it for delete, move, rename, overwrite, or arbitrary command execution.',
    toolActions: ['get-path-info', 'list-directory', 'search-files', 'read-text-file'],
  },
  {
    argsSchemaText: '{ "action": "preview" | "move_path" | "copy_path" | "rename_path" | "create_directory" | "trash_path" | "organize_desktop_files", "intendedAction"?: string, "sourcePath"?: string, "desktopPath"?: string, "destinationPath"?: string, "destinationDirectory"?: string, "newName"?: string, "groupBy"?: "none" | "kind" | "category" | "extension", "includeDirectories"?: boolean, "includeHidden"?: boolean, "includeShortcuts"?: boolean, "limit"?: number, "dryRun"?: boolean, "mode"?: "execute" | "preview" }',
    capabilityId: 'local-file-system',
    description: 'generic local file management action router for previewing, moving, copying, renaming, creating folders, and moving items to recycle bin',
    name: 'execute_file_management_action',
    plannerGuidance: 'Use this for local file management changes. Prefer action preview or dryRun true when the target/destination is uncertain. Move/copy/rename/create_directory/trash_path/organize_desktop_files require approval before execution. For real desktop file cleanup by type/category, first call action "preview" with intendedAction "organize_desktop_files" and groupBy "category"; then call action "organize_desktop_files" with mode "execute" only after the preview is acceptable. This tool never overwrites existing paths and never permanently deletes files.',
    toolActions: [
      'preview-file-management-action',
      'move-local-path',
      'copy-local-path',
      'rename-local-path',
      'create-local-directory',
      'trash-local-path',
      'propose-desktop-file-organization',
      'execute-desktop-file-organization',
    ],
  },
  {
    argsSchemaText: '{ "path": string, "query": string, "maxDepth"?: number, "limit"?: number, "includeHidden"?: boolean, "extensions"?: string }',
    capabilityId: 'local-file-system',
    description: 'search local file names under a directory',
    name: 'search_files',
    plannerGuidance: 'Use for finding files by name under a known folder. It searches file names, not file contents. Read-only.',
    toolActions: ['search-files'],
  },
  {
    argsSchemaText: '{ "path": string, "maxBytes"?: number }',
    capabilityId: 'local-file-system',
    description: 'read a small text file snippet from a local absolute path',
    name: 'read_text_file',
    plannerGuidance: 'Use only after identifying a specific text file. The runtime caps bytes and rejects obvious binary files. Read-only.',
    toolActions: ['read-text-file'],
  },
  {
    argsSchemaText: '{ "targetDisplay"?: "primary" | "secondary" | "current" | "all", "sourceDisplay"?: "primary" | "secondary" | "current" | "all", "sourceScope"?: "all-icons" | "display-icons", "displayTarget"?: "primary" | "secondary" | "all", "scope"?: "all-icons" | "display-icons", "mode"?: "preview" | "execute", "groupBy"?: "none" | "kind" | "category" | "extension", "placementIntent"?: string }',
    capabilityId: 'desktop-organization',
    description: 'arrange desktop icons',
    name: 'organize_desktop_icons',
    plannerGuidance: 'For a direct organize/arrange request, first use mode "preview" as the one-call preflight: it observes icons/displays, reads item metadata, classifies desktop items, applies optional grouping, and prepares a plan. Then continue to mode "execute" so the permission system can ask before moving icons. Prefer structured intent fields: targetDisplay is where the arranged icons should end up; sourceScope "display-icons" means only icons already on the target/source display, and "all-icons" means arrange all desktop icons into the target display. Use placementIntent to preserve open-ended layout requests such as target region, preserve-other-icons, or item subset intent; it is evidence for planning/verification, not a fixed command template. Use displayTarget/scope only as legacy aliases. Use preview-only final answers only when the user explicitly asks just to inspect, preview, or plan. Use groupBy "category" when the user asks to keep images/documents/media/folders together or says type/category/group by type, "kind" for files/folders/shortcuts/system icons, and "extension" for suffix-level grouping. If the request is ambiguous between organizing existing icons on a display and moving all icons to that display, ask_user instead of guessing.',
    toolActions: ['read-display-info', 'list-desktop-icons', 'preview-desktop-icon-arrangement', 'move-desktop-icon'],
  },
  {
    argsSchemaText: '{ "targetName": string, "anchorName": string, "direction": "above" | "below" | "left-of" | "right-of" }',
    capabilityId: 'desktop-organization',
    description: 'place one desktop icon relative to another',
    name: 'place_desktop_icon',
    plannerGuidance: 'Use when the user names one icon and a reference icon with a direction such as above/below/left/right.',
    toolActions: ['list-desktop-icons', 'move-desktop-icon'],
  },
  {
    argsSchemaText: '{ "includeDisplays"?: boolean }',
    capabilityId: 'system-inspector',
    description: 'read this computer basic configuration',
    name: 'get_system_info',
    plannerGuidance: 'Use it for OS, CPU, memory, GPU, hardware/config questions. Do not answer local computer facts from memory.',
    toolActions: ['read-system-info', 'read-display-info'],
  },
  {
    argsSchemaText: '{}',
    capabilityId: 'system-inspector',
    description: 'read screen/display information',
    name: 'get_display_info',
    plannerGuidance: 'Use it for screen count, resolution, work area, scale, primary display, main display, or secondary display questions.',
    toolActions: ['read-display-info'],
  },
  {
    argsSchemaText: '{ "path"?: string, "query"?: string }',
    capabilityId: 'pet-settings',
    description: 'read the desktop pet configuration tree or one exact configuration path; sensitive values are redacted',
    name: 'get_pet_settings',
    plannerGuidance: 'Use for any desktop pet setting question or before a non-obvious change. With path, read one exact path. With query, search available runtime configuration paths. With neither, discover available paths. This is not a manually maintained whitelist: paths come from the live PetConfig tree.',
    toolActions: ['read-pet-settings'],
  },
  {
    argsSchemaText: '{ "changesJson": string }',
    capabilityId: 'pet-settings',
    description: 'atomically update any existing desktop pet configuration path using a JSON object of path-to-value changes',
    name: 'update_pet_settings',
    plannerGuidance: 'Use after the required exact paths and value types are known. changesJson must be a JSON object, for example {"scale":1.2,"settings.autoSpeakResponses":false}. Existing runtime paths are validated dynamically, values must keep the current field type, the result is normalized, saved, and read back. This changes settings and requires confirmation.',
    toolActions: ['update-pet-settings'],
  },
  {
    argsSchemaText: '{ "includeLocalHealth"?: boolean }',
    capabilityId: 'voice-control',
    description: 'read voice playback and voice input status',
    name: 'get_voice_status',
    plannerGuidance: 'Use for questions about current voice settings, TTS/STT provider, auto speech, microphone input, or local voice health. Read-only.',
    toolActions: ['read-voice-status'],
  },
  {
    argsSchemaText: '{ "provider": "browser" | "api" | "local", "enableVoice"?: boolean, "autoSpeak"?: boolean }',
    capabilityId: 'voice-control',
    description: 'switch the TTS playback provider',
    name: 'switch_tts_provider',
    plannerGuidance: 'Use when the user asks to switch voice playback to browser/API/local voice. Preserve voiceEnabled and autoSpeakResponses unless the user asks to enable/disable speech.',
    toolActions: ['switch-tts-provider'],
  },
  {
    argsSchemaText: '{}',
    capabilityId: 'voice-control',
    description: 'warm up local voice runtime',
    name: 'warmup_local_voice',
    plannerGuidance: 'Use when the user asks to preload/warm up the local voice model. It may take time and should run only after permission.',
    toolActions: ['warmup-local-voice'],
  },
  {
    argsSchemaText: '{ "enabled": boolean }',
    capabilityId: 'voice-control',
    description: 'enable or disable voice input setting',
    name: 'set_voice_input',
    plannerGuidance: 'Use to enable/disable the voice input setting. This does not start a microphone session by itself in v1.',
    toolActions: ['set-voice-input'],
  },
  {
    argsSchemaText: '{ "agentPrefix"?: boolean }',
    capabilityId: 'voice-control',
    description: 'start one voice input listening session',
    name: 'start_voice_input_session',
    plannerGuidance: 'Use when the user asks the Agent to start listening or start microphone voice input now. agentPrefix true keeps the recognized transcript as an Agent command.',
    toolActions: ['start-voice-input-session'],
  },
  {
    argsSchemaText: '{}',
    capabilityId: 'voice-control',
    description: 'stop the active voice input listening session',
    name: 'stop_voice_input_session',
    plannerGuidance: 'Use when the user asks to stop listening, stop microphone input, or end voice input recording.',
    toolActions: ['stop-voice-input-session'],
  },
  {
    argsSchemaText: '{ "path": string, "question"?: string }',
    capabilityId: 'local-project-inspector',
    description: 'read-only inspect a local folder or program path and infer how it runs',
    name: 'inspect_local_project',
    plannerGuidance: 'Use it for "how does this folder/project/program run", entrypoint, startup method, or local project analysis questions.',
    toolActions: ['inspect-local-project'],
  },
  {
    argsSchemaText: '{ "path"?: string, "actionIndex"?: number, "command"?: string, "label"?: string }',
    capabilityId: 'local-project-inspector',
    description: 'run/start/open one suggested action from inspect_local_project',
    name: 'run_local_project_action',
    plannerGuidance: 'If the user says "run the first one" after an inspection, path may be omitted. This tool requires confirmation later; do not choose it for analysis-only questions.',
    toolActions: ['inspect-local-project', 'run-local-project-action'],
  },
  {
    argsSchemaText: '{ "query"?: string, "limit"?: number }',
    capabilityId: 'skill-system',
    description: 'list platform Agent skills without executing them',
    name: 'list_agent_skills',
    plannerGuidance: 'Discover built-in skills and imported skills enabled for the current role. Use the returned ID with execute_agent_skill to read a requested skill before applying it. Listing alone does not complete a skill-based task.',
    toolActions: ['list-agent-skills'],
  },
  {
    argsSchemaText: '{ "skillId": string, "intent"?: string, "target"?: string, "inputJson"?: string, "dryRun"?: boolean }',
    capabilityId: 'skill-system',
    description: 'resolve one platform Agent skill into preferred tool routes or a dry-run marker',
    name: 'execute_agent_skill',
    plannerGuidance: 'Resolve a requested built-in skill or read an enabled imported skill. For declarative skills, apply the returned instructions in the next decision and produce the requested output; loading instructions is not task completion. Any tool actions still require normal permissions. Prefer dryRun true unless the user asked to execute.',
    toolActions: ['read-agent-skill', 'execute-agent-skill'],
  },
  {
    argsSchemaText: '{ "serverId"?: string }',
    capabilityId: 'mcp-tools',
    description: 'list registered local MCP-style tools',
    name: 'list_mcp_tools',
    plannerGuidance: 'Use to inspect available MCP-style tools before choosing a call. Read-only.',
    toolActions: ['list-mcp-tools'],
  },
  {
    argsSchemaText: '{ "serverId": string, "name": string, "argumentsJson"?: string }',
    capabilityId: 'mcp-tools',
    description: 'call one registered local MCP-style tool through Agent permissions',
    name: 'call_mcp_tool',
    plannerGuidance: 'Use only after the server and tool are known. Pass JSON object arguments as argumentsJson.',
    toolActions: ['call-mcp-tool'],
  },
];

const AGENT_TOOL_DEFINITION_BY_NAME = new Map(
  AGENT_TOOL_REGISTRY.map((definition) => [definition.name, definition]),
);

export const AGENT_TOOL_LIFECYCLE_METADATA: Record<AgentToolCallName, AgentToolLifecycleMetadata> = {
  get_display_info: {
    mutates: [],
    observes: ['display-list', 'display-bounds', 'display-scale', 'work-area'],
    recoversWith: ['get_display_info'],
    verifies: ['display-list', 'display-bounds'],
  },
  get_system_info: {
    mutates: [],
    observes: ['system-info', 'display-list'],
    recoversWith: ['get_system_info', 'get_display_info'],
    verifies: ['system-info', 'display-list'],
  },
  get_voice_status: {
    mutates: [],
    observes: ['voice-settings', 'voice-input-state', 'local-voice-health'],
    recoversWith: ['get_voice_status'],
    verifies: ['voice-settings', 'local-voice-health'],
  },
  inspect_local_project: {
    mutates: [],
    observes: ['local-path', 'top-level-files', 'known-entry-files', 'project-run-candidates'],
    recoversWith: ['inspect_local_project'],
    verifies: ['project-run-candidates'],
  },
  browser_search: {
    mutates: ['browser-window', 'browser-page'],
    observes: ['configured-browser', 'browser-page-text'],
    recoversWith: ['browser_search', 'launch_local_app'],
    verifies: ['browser-page-opened', 'browser-page-text'],
  },
  observe_windows_and_apps: {
    mutates: [],
    observes: ['app-index', 'taskbar-pinned-shortcuts', 'process-list', 'window-list', 'foreground-window', 'display-ownership'],
    recoversWith: ['observe_windows_and_apps', 'list_running_apps', 'get_active_window_info', 'get_default_app_for_uri'],
    verifies: ['app-index', 'window-list', 'foreground-window'],
  },
  execute_desktop_action: {
    mutates: ['focused-window', 'window-state', 'window-bounds', 'opened-resource', 'browser-page', 'process-list', 'window-ui-state'],
    observes: ['process-list', 'window-list', 'display-list', 'display-ownership', 'default-uri-handler', 'foreground-window', 'os-open-handler', 'ui-automation-control'],
    recoversWith: ['observe_windows_and_apps', 'execute_desktop_observation', 'execute_desktop_action', 'execute_desktop_input', 'control_browser'],
    verifies: ['desktop-action-result', 'focused-window', 'window-state', 'window-bounds', 'open-request-accepted', 'ui-automation-invoke-result'],
  },
  execute_desktop_input: {
    mutates: ['cursor-position', 'active-window-input-state'],
    observes: ['input-action-result'],
    recoversWith: ['get_cursor_position', 'locate_screen_elements', 'get_active_window_info', 'execute_desktop_input'],
    verifies: ['desktop-input-request-result'],
  },
  execute_desktop_sequence: {
    mutates: ['focused-window', 'window-state', 'window-bounds', 'opened-resource', 'browser-page', 'cursor-position', 'active-window-input-state'],
    observes: ['desktop-action-result', 'desktop-input-request-result', 'step-result-evidence', 'post-sequence-window-observation', 'post-sequence-visual-observation'],
    recoversWith: ['observe_windows_and_apps', 'execute_desktop_observation', 'execute_desktop_action', 'execute_desktop_input'],
    verifies: ['desktop-sequence-result', 'per-step-status', 'first-failure-evidence', 'post-sequence-observation', 'post-action-visual-state'],
  },
  get_default_app_for_uri: {
    mutates: [],
    observes: ['default-uri-handler', 'os-association'],
    recoversWith: ['get_default_app_for_uri'],
    verifies: ['default-uri-handler'],
  },
  list_running_apps: {
    mutates: [],
    observes: ['process-list', 'window-list'],
    recoversWith: ['list_running_apps'],
    verifies: ['process-list', 'window-list'],
  },
  get_active_window_info: {
    mutates: [],
    observes: ['foreground-window', 'process-info'],
    recoversWith: ['get_active_window_info', 'list_running_apps'],
    verifies: ['foreground-window'],
  },
  execute_desktop_observation: {
    mutates: [],
    observes: ['display-list', 'desktop-icons', 'desktop-item-metadata', 'system-info', 'foreground-window', 'process-list', 'window-list', 'window-ui-controls', 'screen-capture-sources', 'visual-summary', 'cursor-dip-position', 'delayed-window-observation'],
    recoversWith: ['execute_desktop_observation', 'get_display_info', 'get_system_info', 'get_active_window_info', 'list_capture_sources', 'summarize_visual_snapshot', 'locate_screen_elements'],
    verifies: ['desktop-observation-result', 'display-list', 'desktop-icons', 'foreground-window', 'window-ui-controls', 'visual-summary', 'post-wait-desktop-state'],
  },
  list_capture_sources: {
    mutates: [],
    observes: ['screen-capture-sources', 'window-capture-sources', 'capture-thumbnails'],
    recoversWith: ['list_capture_sources', 'get_display_info', 'list_running_apps'],
    verifies: ['capture-source-list'],
  },
  summarize_visual_snapshot: {
    mutates: [],
    observes: ['screen-capture-source', 'window-capture-source', 'visual-summary'],
    recoversWith: ['summarize_visual_snapshot', 'list_capture_sources', 'get_active_window_info'],
    verifies: ['visual-summary'],
  },
  locate_screen_elements: {
    mutates: [],
    observes: ['screen-capture-source', 'window-capture-source', 'visible-text', 'approximate-screen-elements'],
    recoversWith: ['locate_screen_elements', 'summarize_visual_snapshot', 'list_capture_sources', 'get_active_window_info'],
    verifies: ['visual-element-location-evidence'],
  },
  analyze_game_screen: {
    mutates: [],
    observes: ['screen-capture-source', 'window-capture-source', 'game-screen-thumbnail', 'game-content-analysis'],
    recoversWith: ['analyze_game_screen', 'summarize_visual_snapshot', 'list_capture_sources', 'get_active_window_info'],
    verifies: ['game-content-analysis'],
  },
  manage_game_companion_loop: {
    mutates: ['chat-message-stream', 'game-companion-loop-state'],
    observes: ['game-screen-thumbnail', 'game-content-analysis', 'recent-game-observations'],
    recoversWith: ['manage_game_companion_loop', 'analyze_game_screen', 'list_capture_sources', 'get_active_window_info'],
    verifies: ['game-companion-loop-state'],
  },
  get_cursor_position: {
    mutates: [],
    observes: ['cursor-dip-position'],
    recoversWith: ['get_cursor_position', 'get_display_info'],
    verifies: ['cursor-dip-position'],
  },
  focus_window: {
    mutates: ['focused-window'],
    observes: ['window-list'],
    recoversWith: ['list_running_apps', 'focus_window'],
    verifies: ['focused-window'],
  },
  close_window: {
    mutates: ['window-state'],
    observes: ['window-list'],
    recoversWith: ['list_running_apps', 'close_window'],
    verifies: ['window-close-request', 'window-state'],
  },
  open_resource: {
    mutates: ['focused-window', 'opened-resource'],
    observes: ['os-open-handler'],
    recoversWith: ['list_running_apps', 'open_resource', 'launch_local_app'],
    verifies: ['open-request-accepted'],
  },
  search_web: {
    mutates: ['browser-window', 'browser-page'],
    observes: ['configured-browser', 'browser-page-text'],
    recoversWith: ['search_web', 'open_resource'],
    verifies: ['browser-page-opened', 'browser-page-text'],
  },
  control_browser: {
    mutates: ['controlled-browser-window', 'controlled-browser-page', 'controlled-browser-tab-focus'],
    observes: ['controlled-browser-session', 'browser-page-list', 'browser-page-text'],
    recoversWith: ['control_browser', 'search_web', 'open_resource', 'observe_windows_and_apps'],
    verifies: ['browser-control-result', 'browser-page-text', 'browser-tab-state'],
  },
  run_controlled_command: {
    mutates: ['local-command-process'],
    observes: ['stdout', 'stderr', 'exit-code', 'cwd'],
    recoversWith: ['run_controlled_command', 'execute_local_file_action', 'observe_windows_and_apps', 'get_system_info'],
    verifies: ['command-exit-code', 'command-output'],
  },
  launch_local_app: {
    mutates: ['focused-window', 'process-list'],
    observes: ['app-index', 'focused-window'],
    recoversWith: ['launch_local_app'],
    verifies: ['focused-window', 'launch-request-accepted'],
  },
  organize_desktop_icons: {
    mutates: ['desktop-icon-positions'],
    observes: ['display-list', 'desktop-icons', 'desktop-icon-positions'],
    recoversWith: ['organize_desktop_icons', 'get_display_info'],
    verifies: ['desktop-icon-positions', 'grid-snap-result'],
  },
  place_desktop_icon: {
    mutates: ['desktop-icon-positions'],
    observes: ['desktop-icons', 'desktop-icon-positions'],
    recoversWith: ['place_desktop_icon', 'organize_desktop_icons'],
    verifies: ['relative-icon-position'],
  },
  remember_local_app: {
    mutates: ['agent-app-memory'],
    observes: ['user-provided-path'],
    recoversWith: ['remember_local_app'],
    verifies: ['agent-app-memory'],
  },
  execute_memory_action: {
    mutates: ['agent-global-memory'],
    observes: ['agent-global-memory', 'user-memory-query'],
    recoversWith: ['execute_memory_action'],
    verifies: ['agent-memory-action-result', 'agent-global-memory'],
  },
  get_path_info: {
    mutates: [],
    observes: ['local-path', 'path-metadata'],
    recoversWith: ['get_path_info'],
    verifies: ['path-metadata'],
  },
  list_directory: {
    mutates: [],
    observes: ['local-path', 'directory-entries'],
    recoversWith: ['get_path_info', 'list_directory'],
    verifies: ['directory-entries'],
  },
  execute_local_file_action: {
    mutates: [],
    observes: ['local-path', 'path-metadata', 'directory-entries', 'file-name-matches', 'text-file-content'],
    recoversWith: ['execute_local_file_action', 'get_path_info', 'list_directory', 'search_files', 'read_text_file'],
    verifies: ['local-file-action-result', 'path-metadata', 'directory-entries', 'file-name-matches', 'text-file-snippet'],
  },
  execute_file_management_action: {
    mutates: ['local-file-system-paths'],
    observes: ['local-path', 'path-metadata', 'file-management-preview', 'desktop-file-organization-preview', 'operation-result'],
    recoversWith: ['execute_file_management_action', 'execute_local_file_action', 'get_path_info', 'list_directory'],
    verifies: ['file-management-action-result', 'desktop-file-organization-result', 'changed-local-paths', 'operation-verification'],
  },
  search_files: {
    mutates: [],
    observes: ['local-path', 'file-name-matches'],
    recoversWith: ['list_directory', 'search_files'],
    verifies: ['file-name-matches'],
  },
  read_text_file: {
    mutates: [],
    observes: ['local-path', 'text-file-content'],
    recoversWith: ['get_path_info', 'read_text_file'],
    verifies: ['text-file-snippet'],
  },
  run_local_project_action: {
    mutates: ['process-list', 'terminal-window'],
    observes: ['project-run-candidates'],
    recoversWith: ['inspect_local_project', 'run_local_project_action'],
    verifies: ['process-started', 'request-accepted'],
  },
  get_pet_settings: {
    mutates: [],
    observes: ['pet-configuration-tree'],
    recoversWith: ['get_pet_settings'],
    verifies: ['pet-configuration-value'],
  },
  update_pet_settings: {
    mutates: ['pet-configuration-tree'],
    observes: ['pet-configuration-value'],
    recoversWith: ['get_pet_settings', 'update_pet_settings'],
    verifies: ['normalized-pet-configuration-value', 'persisted-pet-configuration'],
  },
  set_voice_input: {
    mutates: ['voice-input-setting'],
    observes: ['voice-input-setting'],
    recoversWith: ['get_voice_status', 'set_voice_input'],
    verifies: ['voice-input-setting'],
  },
  start_voice_input_session: {
    mutates: ['voice-input-session'],
    observes: ['voice-input-session'],
    recoversWith: ['get_voice_status', 'start_voice_input_session'],
    verifies: ['voice-input-session'],
  },
  stop_voice_input_session: {
    mutates: ['voice-input-session'],
    observes: ['voice-input-session'],
    recoversWith: ['get_voice_status', 'stop_voice_input_session'],
    verifies: ['voice-input-session'],
  },
  switch_tts_provider: {
    mutates: ['voice-settings'],
    observes: ['voice-settings'],
    recoversWith: ['get_voice_status', 'switch_tts_provider'],
    verifies: ['voice-settings'],
  },
  warmup_local_voice: {
    mutates: ['local-voice-runtime-state'],
    observes: ['local-voice-health'],
    recoversWith: ['get_voice_status', 'warmup_local_voice'],
    verifies: ['local-voice-health'],
  },
  list_agent_skills: {
    mutates: [],
    observes: ['skill-registry'],
    recoversWith: ['list_agent_skills'],
    verifies: ['skill-list'],
  },
  execute_agent_skill: {
    mutates: ['skill-execution-request'],
    observes: ['skill-definition', 'preferred-tool-routes'],
    recoversWith: ['list_agent_skills', 'execute_agent_skill'],
    verifies: ['skill-resolution-result'],
  },
  list_mcp_tools: {
    mutates: [],
    observes: ['mcp-server-registry', 'mcp-tool-definition'],
    recoversWith: ['list_mcp_tools'],
    verifies: ['mcp-tool-list'],
  },
  call_mcp_tool: {
    mutates: ['mcp-tool-call-request'],
    observes: ['mcp-tool-result'],
    recoversWith: ['list_mcp_tools', 'call_mcp_tool'],
    verifies: ['mcp-tool-result'],
  },
};

export function getAgentToolDefinition(name: AgentToolCallName) {
  return AGENT_TOOL_DEFINITION_BY_NAME.get(name) ?? null;
}

export function getAgentToolLifecycleMetadata(name: AgentToolCallName) {
  return AGENT_TOOL_LIFECYCLE_METADATA[name];
}

export interface AgentToolLifecycleMetadataFormatOptions {
  visibleRecoveryTools?: readonly AgentToolCallName[];
}

export interface AgentPlannerAvailableToolLineOptions {
  toolNames?: readonly AgentToolCallName[];
}

export function formatAgentToolLifecycleMetadata(
  name: AgentToolCallName,
  options: AgentToolLifecycleMetadataFormatOptions = {},
) {
  const metadata = getAgentToolLifecycleMetadata(name);
  const visibleRecoveryToolSet = options.visibleRecoveryTools
    ? new Set(options.visibleRecoveryTools)
    : null;
  const recoversWith = visibleRecoveryToolSet
    ? metadata.recoversWith.filter((toolName) => visibleRecoveryToolSet.has(toolName))
    : metadata.recoversWith;

  return [
    `observes: ${metadata.observes.length ? metadata.observes.join(', ') : 'none'}.`,
    `mutates: ${metadata.mutates.length ? metadata.mutates.join(', ') : 'none'}.`,
    `verifies: ${metadata.verifies.length ? metadata.verifies.join(', ') : 'none'}.`,
    `recoversWith: ${recoversWith.length ? recoversWith.join(', ') : 'none'}.`,
  ].join(' ');
}

export function listAgentToolNames() {
  return AGENT_TOOL_REGISTRY.map((definition) => definition.name);
}

export function createAgentPlannerToolUnionText() {
  return `${listAgentToolNames().map((name) => `"${name}"`).join(' | ')} | null`;
}

export function createAgentPlannerAvailableToolLines(
  options: AgentPlannerAvailableToolLineOptions = {},
) {
  const visibleToolNameSet = options.toolNames ? new Set(options.toolNames) : null;
  const visibleDefinitions = visibleToolNameSet
    ? AGENT_TOOL_REGISTRY.filter((definition) => visibleToolNameSet.has(definition.name))
    : AGENT_TOOL_REGISTRY;
  const visibleRecoveryTools = visibleDefinitions.map((definition) => definition.name);

  return visibleDefinitions.map((definition) => (
    `- ${definition.name}: ${definition.description}. args: ${definition.argsSchemaText}. ${formatAgentToolLifecycleMetadata(definition.name, { visibleRecoveryTools })} ${definition.plannerGuidance}`
  ));
}

export function isAgentToolName(value: string): value is AgentToolCallName {
  return AGENT_TOOL_DEFINITION_BY_NAME.has(value as AgentToolCallName);
}
