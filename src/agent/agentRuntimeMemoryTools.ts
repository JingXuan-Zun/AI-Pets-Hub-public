import {
  appendNeuralMemoryProposals,
} from '../neural-memory/neuralMemoryProposalConfig';
import {
  NEURAL_MEMORY_PROPOSAL_MAX_CONTENT_LENGTH,
  type NeuralMemoryProposal,
} from '../neural-memory/neuralMemoryProposalTypes';
import { isCharacterMemoryKind } from '../character-memory/characterMemoryTypes';
import {
  hasSharedUserMemory,
  listSharedUserMemory,
  removeSharedUserMemoryItems,
  searchSharedUserMemory,
} from '../character-memory/sharedUserMemory';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../multiPetRoster';
import {
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

const AGENT_MEMORY_DEFAULT_LIMIT = 20;
const AGENT_MEMORY_MAX_LIMIT = 50;

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  for (const key of keys) {
    const value = toolCall.input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getToolNumberInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input[key];
  return typeof value === 'number' ? value : null;
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

function getAgentMemoryLimit(toolCall: AgentToolCallCommand) {
  const rawLimit = getToolNumberInput(toolCall, 'limit') ?? AGENT_MEMORY_DEFAULT_LIMIT;
  if (!Number.isFinite(rawLimit)) {
    return AGENT_MEMORY_DEFAULT_LIMIT;
  }

  return Math.min(AGENT_MEMORY_MAX_LIMIT, Math.max(1, Math.round(rawLimit)));
}

function createAgentMemoryReceipt(options: {
  evidenceLines?: string[];
  status: AgentChatExecutionReceipt['status'];
  summaryLines: string[];
  verification?: string | null;
}): AgentChatExecutionReceipt {
  return {
    evidenceLines: options.evidenceLines ?? [],
    status: options.status,
    summaryLines: options.summaryLines,
    title: '执行回执',
    toolName: 'execute_memory_action',
    verification: options.verification ?? null,
  };
}

let sharedProposalSequence = 0;
function createSharedProposalId(now: number) {
  sharedProposalSequence += 1;
  return `shared-proposal-${now.toString(36)}-agent-${sharedProposalSequence}`;
}

export async function executeMemoryAction(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const rawAction = getToolStringInput(toolCall, ['action', 'memoryAction', 'operation']);
  const action = normalizeExecuteMemoryAction(rawAction);
  const query = getToolStringInput(toolCall, ['query', 'keyword', 'keywords', 'target', 'key']);
  const value = getToolStringInput(toolCall, ['value', 'content', 'text', 'fact', 'preference'])
    || (action === 'remember' ? query : '');
  const rawKind = getToolStringInput(toolCall, ['kind', 'category', 'type']);
  const kind = isCharacterMemoryKind(rawKind) ? rawKind : 'other';
  const items = listSharedUserMemory(context.configRef.current);
  const limit = getAgentMemoryLimit(toolCall);

  if (!action) {
    return {
      errorText: 'Unsupported execute_memory_action action.',
      observations: [
        rawAction ? `Unsupported memory action: ${rawAction}` : 'Missing memory action.',
      ],
      ok: false,
      responseText: 'execute_memory_action needs a supported action such as list, recall, remember, or forget.',
    };
  }

  if (action === 'recall') {
    const matched = searchSharedUserMemory(items, query);
    const visible = matched.slice(0, limit).map((item) => item.text);
    const hiddenCount = Math.max(0, matched.length - visible.length);
    const verification = `已读取「关于你」里的 ${matched.length} 条匹配记忆。`;
    return {
      observations: [
        'Memory action: recall',
        query ? `Memory filter: ${query}` : 'Memory filter: none',
        `Matched memory items: ${matched.length}`,
      ],
      ok: true,
      receipt: createAgentMemoryReceipt({
        evidenceLines: visible,
        status: 'success',
        summaryLines: ['调用：execute_memory_action', '动作：recall', `匹配：${matched.length} 条`],
        verification,
      }),
      responseText: visible.length
        ? [
            query ? '查到这些相关记忆：' : '「关于你」里记着这些：',
            ...visible.map((text, index) => `${index + 1}. ${text}`),
            hiddenCount ? `还有 ${hiddenCount} 条未显示。` : '',
          ].filter(Boolean).join('\n')
        : '「关于你」里没有找到相关的记忆。',
      verification,
    };
  }

  if (action === 'remember') {
    if (!value) {
      return {
        errorText: 'Missing memory value.',
        observations: ['Memory action: remember'],
        ok: false,
        responseText: '要记住的内容是空的，需要在 value 里写清楚要记什么。',
      };
    }
    if (hasSharedUserMemory(items, value)) {
      return {
        observations: ['Memory action: remember', 'Already remembered.'],
        ok: true,
        responseText: `这件事已经记着了：${value}`,
        verification: '「关于你」里已有相同内容，没有重复提议。',
      };
    }
    const now = Date.now();
    const proposal: NeuralMemoryProposal = {
      content: value.slice(0, NEURAL_MEMORY_PROPOSAL_MAX_CONTENT_LENGTH),
      createdAt: now,
      id: createSharedProposalId(now),
      reason: '你让我记住的',
      roleId: context.petId || PRIMARY_DESKTOP_PET_SLOT_ID,
      scope: 'shared',
      sharedKind: kind,
      sourceExcerpt: value.slice(0, 240),
      sourceMessageIds: [],
      type: kind === 'preference' ? 'preference' : 'experience',
    };
    context.onUpdateConfig(appendNeuralMemoryProposals(context.configRef.current, [proposal]));
    const verification = '已在聊天侧栏提交「关于你」的记忆提议，等用户批准后才会记住。';
    return {
      observations: ['Memory action: remember', `Proposed shared memory: ${proposal.content}`],
      ok: true,
      receipt: createAgentMemoryReceipt({
        evidenceLines: [proposal.content],
        status: 'success',
        summaryLines: ['调用：execute_memory_action', '动作：remember（待批准）'],
        verification,
      }),
      responseText: `我把这条放到侧栏了，你点“记住”后所有角色都会知道：${proposal.content}`,
      verification,
    };
  }

  if (!query) {
    return {
      errorText: 'Missing memory forget filter.',
      observations: ['Memory action: forget'],
      ok: false,
      responseText: '要忘掉哪条记忆？需要在 query 里写出关键词，避免误删。',
    };
  }

  const removed = searchSharedUserMemory(items, query);
  if (removed.length > 0) {
    context.onUpdateConfig(removeSharedUserMemoryItems(context.configRef.current, removed.map((item) => item.id)));
  }
  const verification = removed.length
    ? `已从「关于你」里删除 ${removed.length} 条记忆。`
    : '「关于你」里没有找到匹配的记忆，没有删除任何内容。';
  return {
    observations: [
      'Memory action: forget',
      `Removed memory items: ${removed.length}`,
      ...removed.slice(0, limit).map((item) => `Removed: ${item.text}`),
    ],
    ok: true,
    receipt: createAgentMemoryReceipt({
      evidenceLines: removed.slice(0, limit).map((item) => item.text),
      status: 'success',
      summaryLines: ['调用：execute_memory_action', '动作：forget', `删除：${removed.length} 条`],
      verification,
    }),
    responseText: removed.length
      ? `已经忘掉了：${removed.map((item) => item.text).join('；')}`
      : '「关于你」里没有找到这条，我没有删除任何内容。',
    verification,
  };
}
