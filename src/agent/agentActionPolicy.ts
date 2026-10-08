import {
  type AgentActionRisk,
  type AgentApprovalMode,
  type AgentToolActionDecision,
  type AgentToolActionKind,
  type AgentToolActionRequest,
} from './agentCapabilityTypes';

const ACTION_RISK_BY_KIND: Record<AgentToolActionKind, AgentActionRisk> = {
  'answer-agent-context-query': 'read',
  'browser-search': 'launch',
  'capture-screen-context': 'visual',
  'close-window': 'launch',
  'control-browser-open': 'launch',
  'control-browser-read': 'read',
  'control-window': 'reversible-write',
  'execute-desktop-file-organization': 'reversible-write',
  'execute-desktop-input': 'reversible-write',
  'execute-desktop-sequence': 'launch',
  'focus-window': 'launch',
  'get-active-window-info': 'read',
  'get-default-app-for-uri': 'read',
  'get-path-info': 'read',
  'inspect-window-ui': 'read',
  'interact-window-ui': 'reversible-write',
  'invoke-window-ui': 'reversible-write',
  'inspect-local-project': 'read',
  'call-mcp-tool': 'reversible-write',
  'launch-local-app': 'launch',
  'execute-agent-skill': 'reversible-write',
  'read-agent-skill': 'read',
  'list-capture-sources': 'visual',
  'list-agent-skills': 'read',
  'list-directory': 'read',
  'list-mcp-tools': 'read',
  'get-cursor-position': 'read',
  'list-running-apps': 'read',
  'list-desktop-icons': 'read',
  'diagnose-desktop-icons': 'read',
  'locate-screen-elements': 'visual',
  'move-window-to-display': 'reversible-write',
  'preview-file-management-action': 'read',
  'move-local-path': 'reversible-write',
  'copy-local-path': 'reversible-write',
  'rename-local-path': 'reversible-write',
  'create-local-directory': 'reversible-write',
  'trash-local-path': 'reversible-write',
  'read-agent-memory': 'read',
  'remember-agent-memory': 'reversible-write',
  'forget-agent-memory': 'reversible-write',
  'move-desktop-icon': 'reversible-write',
  'manage-game-companion-loop': 'visual',
  'observe-game-window': 'visual',
  'open-or-focus-then-control-window': 'launch',
  'open-resource': 'launch',
  'open-or-focus-then-move-window-to-display': 'launch',
  'observe-windows-and-apps': 'read',
  'preview-desktop-icon-arrangement': 'read',
  'propose-desktop-file-organization': 'read',
  'read-text-file': 'read',
  'read-display-info': 'read',
  'read-system-info': 'read',
  'read-pet-settings': 'read',
  'update-pet-settings': 'reversible-write',
  'read-voice-status': 'read',
  'remember-local-app': 'reversible-write',
  'run-controlled-command': 'launch',
  'run-local-project-action': 'launch',
  'search-web': 'launch',
  'search-files': 'read',
  'search-local-app': 'read',
  'set-voice-input': 'reversible-write',
  'start-voice-input-session': 'launch',
  'stop-voice-input-session': 'read',
  'switch-tts-provider': 'reversible-write',
  'undo-desktop-file-organization': 'reversible-write',
  'warmup-local-voice': 'launch',
};

function getBaseApprovalMode(risk: AgentActionRisk): AgentApprovalMode {
  if (risk === 'read') {
    return 'silent';
  }

  if (risk === 'visual') {
    return 'notify';
  }

  if (risk === 'reversible-write' || risk === 'launch') {
    return 'confirm';
  }

  return 'blocked';
}

export function getAgentActionRisk(kind: AgentToolActionKind) {
  return ACTION_RISK_BY_KIND[kind];
}

export function createAgentActionRequest(
  kind: AgentToolActionKind,
  options: Omit<AgentToolActionRequest, 'kind' | 'risk'>,
): AgentToolActionRequest {
  return {
    ...options,
    kind,
    risk: getAgentActionRisk(kind),
  };
}

export function evaluateAgentToolAction(
  request: AgentToolActionRequest,
  context: { desktopMode: boolean } = { desktopMode: true },
): AgentToolActionDecision {
  if (request.requiresDesktopMode && !context.desktopMode) {
    return {
      allowed: false,
      mode: 'blocked',
      reason: '该动作只能在桌面版运行。',
    };
  }

  if (request.risk === 'destructive' || request.risk === 'blocked') {
    return {
      allowed: false,
      mode: 'blocked',
      reason: '第一版禁止删除、覆盖、注入、任意命令等高风险动作。',
    };
  }

  if (
    request.risk === 'reversible-write'
    && (!request.reversible || (request.estimatedItemCount ?? 0) > 100)
  ) {
    return {
      allowed: true,
      mode: 'confirm',
      reason: '文件整理必须确认，并且需要可撤销记录。',
    };
  }

  const mode = getBaseApprovalMode(request.risk);
  return {
    allowed: mode !== 'blocked',
    mode,
    reason: mode === 'silent'
      ? '用户主动触发的只读动作可以直接执行。'
      : '该动作需要提示或确认。',
  };
}

export function shouldExecuteAgentToolAction(decision: AgentToolActionDecision) {
  return decision.allowed && decision.mode !== 'blocked';
}
