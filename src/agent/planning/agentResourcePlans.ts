
import { buildLocalAppProjectToolPlan } from './agentLocalAppProjectPlans';
export { buildAppLaunchPlan, buildAppAliasSavePlan } from './agentLocalAppProjectPlans';
import { type AgentToolActionKind } from '../agentCapabilityTypes';
import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentExecutionPlan, createPlanStep, getToolCallTargetDescription } from './agentPlanShared';

export function buildContextQueryPlan(command: AgentChatCommand): AgentExecutionPlan {
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

export function buildResourceToolPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const toolName = command.toolCall?.name;
  if (!toolName) return null;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  switch (toolName) {
    case 'run_controlled_command':
    case 'remember_local_app':
    case 'inspect_local_project':
    case 'run_local_project_action':
      return buildLocalAppProjectToolPlan(command, toolName, targetDescription, explicitGoal);

    case 'control_browser':
      return buildControlBrowserPlan(command);

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
    default: return null;
  }
}
