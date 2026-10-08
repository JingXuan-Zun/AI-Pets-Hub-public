import { createAgentActionRequest, evaluateAgentToolAction } from '../agentActionPolicy';
import {
  type AgentToolActionDecision,
  type AgentToolActionKind,
  type AgentToolActionRequest,
} from '../agentCapabilityTypes';
import { type AgentChatCommand } from '../agentChatCommand';

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

export function createPlanStep(
  id: string,
  kind: AgentToolActionKind,
  summary: string,
  options: Omit<AgentToolActionRequest, 'kind' | 'label' | 'risk'> & { details?: string[]; label?: string },
): AgentExecutionPlanStep {
  const { details, label, ...actionOptions } = options;
  const action = createAgentActionRequest(kind, {
    ...actionOptions,
    label: label ?? summary,
  });

  return {
    action,
    decision: evaluateAgentToolAction(action),
    details,
    id,
    summary,
  };
}

export function getToolCallTargetDescription(command: AgentChatCommand) {
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

export function getToolCallStringInput(command: AgentChatCommand, keys: string[]) {
  const input = command.toolCall?.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export interface ExecuteDesktopSequencePlanStepSummary {
  reason?: string;
  tool: string;
}

export interface ExecuteDesktopSequenceVisibleClickSummary {
  app: string;
  target: string;
}
