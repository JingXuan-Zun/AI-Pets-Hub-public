export type AgentCapabilityId =
  | 'desktop-observation'
  | 'desktop-organization'
  | 'agent-memory'
  | 'app-launcher'
  | 'local-file-system'
  | 'local-project-inspector'
  | 'system-inspector'
  | 'pet-settings'
  | 'voice-control'
  | 'game-companion'
  | 'skill-system'
  | 'mcp-tools';

export type AgentCapabilityStage = 'foundation' | 'mvp' | 'future';

export type AgentActionRisk =
  | 'read'
  | 'visual'
  | 'reversible-write'
  | 'launch'
  | 'destructive'
  | 'blocked';

export type AgentApprovalMode = 'silent' | 'notify' | 'confirm' | 'blocked';

export type AgentToolActionKind =
  | 'answer-agent-context-query'
  | 'list-desktop-icons'
  | 'diagnose-desktop-icons'
  | 'read-display-info'
  | 'read-system-info'
  | 'read-pet-settings'
  | 'update-pet-settings'
  | 'read-voice-status'
  | 'capture-screen-context'
  | 'locate-screen-elements'
  | 'get-active-window-info'
  | 'inspect-window-ui'
  | 'interact-window-ui'
  | 'invoke-window-ui'
  | 'observe-windows-and-apps'
  | 'list-capture-sources'
  | 'get-cursor-position'
  | 'execute-desktop-input'
  | 'execute-desktop-sequence'
  | 'move-desktop-icon'
  | 'preview-desktop-icon-arrangement'
  | 'propose-desktop-file-organization'
  | 'execute-desktop-file-organization'
  | 'undo-desktop-file-organization'
  | 'search-local-app'
  | 'get-path-info'
  | 'list-directory'
  | 'search-files'
  | 'read-text-file'
  | 'preview-file-management-action'
  | 'move-local-path'
  | 'copy-local-path'
  | 'rename-local-path'
  | 'create-local-directory'
  | 'trash-local-path'
  | 'read-agent-memory'
  | 'remember-agent-memory'
  | 'forget-agent-memory'
  | 'get-default-app-for-uri'
  | 'list-running-apps'
  | 'focus-window'
  | 'control-window'
  | 'open-or-focus-then-control-window'
  | 'open-or-focus-then-move-window-to-display'
  | 'move-window-to-display'
  | 'close-window'
  | 'open-resource'
  | 'remember-local-app'
  | 'launch-local-app'
  | 'browser-search'
  | 'control-browser-read'
  | 'control-browser-open'
  | 'search-web'
  | 'run-controlled-command'
  | 'switch-tts-provider'
  | 'warmup-local-voice'
  | 'set-voice-input'
  | 'start-voice-input-session'
  | 'stop-voice-input-session'
  | 'inspect-local-project'
  | 'run-local-project-action'
  | 'list-agent-skills'
  | 'execute-agent-skill'
  | 'read-agent-skill'
  | 'list-mcp-tools'
  | 'call-mcp-tool'
  | 'observe-game-window'
  | 'manage-game-companion-loop';

export interface AgentCapability {
  defaultEnabled: boolean;
  goal: string;
  id: AgentCapabilityId;
  notes: string[];
  requiredSignals: string[];
  stage: AgentCapabilityStage;
  supportedActions: AgentToolActionKind[];
  title: string;
}

export interface AgentToolActionRequest {
  estimatedItemCount?: number;
  kind: AgentToolActionKind;
  label: string;
  requiresDesktopMode?: boolean;
  reversible?: boolean;
  risk: AgentActionRisk;
  targetDescription?: string;
  userInitiated?: boolean;
}

export interface AgentToolActionDecision {
  allowed: boolean;
  mode: AgentApprovalMode;
  reason: string;
}
