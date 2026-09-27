import { type PetConfig } from '../types';
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

function compactAgentMemoryText(value: string, maxLength = 500) {
  const compactValue = value.replace(/\s+/gu, ' ').trim();
  if (compactValue.length <= maxLength) {
    return compactValue;
  }

  return `${compactValue.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getAgentGlobalKnowledgeLines(config: PetConfig) {
  return config.settings.globalKnowledgeBase
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getAgentMemoryLimit(toolCall: AgentToolCallCommand) {
  const rawLimit = getToolNumberInput(toolCall, 'limit') ?? AGENT_MEMORY_DEFAULT_LIMIT;
  if (!Number.isFinite(rawLimit)) {
    return AGENT_MEMORY_DEFAULT_LIMIT;
  }

  return Math.min(AGENT_MEMORY_MAX_LIMIT, Math.max(1, Math.round(rawLimit)));
}

function isAgentManagedMemoryLine(line: string) {
  return /^Agent memory(?: \[[^\]]+\])?:/u.test(line.trim());
}

function createAgentMemoryLine(options: {
  category?: string | null;
  key?: string | null;
  value: string;
}) {
  const category = compactAgentMemoryText(options.category || 'general', 80) || 'general';
  const key = compactAgentMemoryText(options.key || '', 120);
  const value = compactAgentMemoryText(options.value, 1000);
  return key
    ? `Agent memory [${category}]: ${key} = ${value}`
    : `Agent memory [${category}]: ${value}`;
}

function isSameAgentMemoryKey(line: string, category: string | null, key: string) {
  const normalizedLine = line.trim().toLowerCase();
  const normalizedKey = compactAgentMemoryText(key, 120).toLowerCase();
  if (!normalizedKey) {
    return false;
  }

  if (category) {
    const normalizedCategory = compactAgentMemoryText(category, 80).toLowerCase();
    return normalizedLine.startsWith(`agent memory [${normalizedCategory}]: ${normalizedKey} =`);
  }

  return /^agent memory(?: \[[^\]]+\])?:/u.test(normalizedLine)
    && normalizedLine.includes(`: ${normalizedKey} =`);
}

function doesAgentMemoryLineMatch(
  line: string,
  options: {
    category?: string | null;
    key?: string | null;
    query?: string | null;
  },
) {
  const normalizedLine = line.toLowerCase();
  const normalizedCategory = compactAgentMemoryText(options.category || '', 80).toLowerCase();
  const normalizedKey = compactAgentMemoryText(options.key || '', 120).toLowerCase();
  const normalizedQuery = compactAgentMemoryText(options.query || '', 240).toLowerCase();

  if (normalizedCategory && !normalizedLine.includes(`[${normalizedCategory}]`) && !normalizedLine.includes(normalizedCategory)) {
    return false;
  }

  if (normalizedKey && !normalizedLine.includes(normalizedKey)) {
    return false;
  }

  if (normalizedQuery && !normalizedLine.includes(normalizedQuery)) {
    return false;
  }

  return Boolean(normalizedCategory || normalizedKey || normalizedQuery);
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

function updateAgentGlobalKnowledge(
  context: AgentRuntimeExecutorContext,
  lines: string[],
) {
  const currentConfig = context.configRef.current;
  const nextConfig = {
    ...currentConfig,
    settings: {
      ...currentConfig.settings,
      globalKnowledgeBase: lines.join('\n'),
    },
  };

  context.onUpdateConfig(nextConfig);
  return nextConfig;
}

export async function executeMemoryAction(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const rawAction = getToolStringInput(toolCall, ['action', 'memoryAction', 'operation']);
  const action = normalizeExecuteMemoryAction(rawAction);
  const scope = getToolStringInput(toolCall, ['scope']) || 'global';
  const query = getToolStringInput(toolCall, ['query', 'keyword', 'keywords', 'target']);
  const key = getToolStringInput(toolCall, ['key', 'name', 'preferenceKey']);
  const category = getToolStringInput(toolCall, ['category', 'type', 'topic']);
  const value = getToolStringInput(toolCall, ['value', 'content', 'text', 'fact', 'preference'])
    || (action === 'remember' ? query : '');
  const currentLines = getAgentGlobalKnowledgeLines(context.configRef.current);
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

  if (scope !== 'global') {
    return {
      errorText: 'Unsupported Agent memory scope.',
      observations: [`Memory scope requested: ${scope}`],
      ok: false,
      responseText: 'execute_memory_action v1 only supports scope "global".',
    };
  }

  if (action === 'recall') {
    const hasFilter = Boolean(query || key || category);
    const matchedLines = hasFilter
      ? currentLines.filter((line) => doesAgentMemoryLineMatch(line, { category, key, query }))
      : currentLines;
    const visibleLines = matchedLines.slice(0, limit);
    const hiddenCount = Math.max(0, matchedLines.length - visibleLines.length);
    const responseText = visibleLines.length
      ? [
          hasFilter ? '查到这些相关记忆：' : '当前全局记忆里有这些内容：',
          ...visibleLines.map((line, index) => `${index + 1}. ${line}`),
          hiddenCount ? `还有 ${hiddenCount} 条未显示。` : '',
        ].filter(Boolean).join('\n')
      : '没有找到匹配的 Agent 记忆。';

    return {
      observations: [
        `Memory action: recall`,
        `Memory scope: ${scope}`,
        hasFilter ? `Memory filter: ${[category, key, query].filter(Boolean).join(' | ')}` : 'Memory filter: none',
        `Matched memory lines: ${matchedLines.length}`,
      ],
      ok: true,
      receipt: createAgentMemoryReceipt({
        evidenceLines: visibleLines,
        status: 'success',
        summaryLines: [
          '调用：execute_memory_action',
          '动作：recall',
          `匹配：${matchedLines.length} 条`,
        ],
        verification: `已读取全局知识库中的 ${matchedLines.length} 条匹配记忆。`,
      }),
      responseText,
      verification: `已读取全局知识库中的 ${matchedLines.length} 条匹配记忆。`,
    };
  }

  if (action === 'remember') {
    if (!value) {
      return {
        errorText: 'Missing memory value.',
        observations: ['Memory action: remember'],
        ok: false,
        responseText: '要写入记忆，需要提供 value/content/fact/preference，或在 query 中给出要记住的内容。',
      };
    }

    const nextLine = createAgentMemoryLine({ category, key, value });
    const replacedLines = key
      ? currentLines.filter((line) => isAgentManagedMemoryLine(line) && isSameAgentMemoryKey(line, category || null, key))
      : [];
    const preservedLines = replacedLines.length
      ? currentLines.filter((line) => !replacedLines.includes(line))
      : currentLines;
    const nextLines = preservedLines.includes(nextLine)
      ? preservedLines
      : [...preservedLines, nextLine];

    if (nextLines.join('\n') !== currentLines.join('\n')) {
      updateAgentGlobalKnowledge(context, nextLines);
    }

    return {
      observations: [
        'Memory action: remember',
        `Memory scope: ${scope}`,
        category ? `Memory category: ${category}` : '',
        key ? `Memory key: ${key}` : '',
        replacedLines.length ? `Replaced memory lines: ${replacedLines.length}` : '',
        `Stored memory: ${nextLine}`,
      ].filter(Boolean),
      ok: true,
      receipt: createAgentMemoryReceipt({
        evidenceLines: [nextLine],
        status: 'success',
        summaryLines: [
          '调用：execute_memory_action',
          '动作：remember',
          key ? `键：${key}` : '键：未指定',
          category ? `分类：${category}` : '分类：general',
        ],
        verification: '已把用户授权的长期记忆写入全局知识库。',
      }),
      responseText: `已经记住：${nextLine}`,
      verification: '已把用户授权的长期记忆写入全局知识库。',
    };
  }

  if (action === 'forget') {
    if (!query && !key && !category) {
      return {
        errorText: 'Missing memory forget filter.',
        observations: ['Memory action: forget'],
        ok: false,
        responseText: '要忘记记忆，需要提供 query、key 或 category，避免误删全局知识库内容。',
      };
    }

    const removedLines = currentLines.filter((line) => (
      isAgentManagedMemoryLine(line)
      && doesAgentMemoryLineMatch(line, { category, key, query })
    ));
    const nextLines = currentLines.filter((line) => !removedLines.includes(line));

    if (removedLines.length > 0) {
      updateAgentGlobalKnowledge(context, nextLines);
    }

    return {
      observations: [
        'Memory action: forget',
        `Memory scope: ${scope}`,
        `Removed memory lines: ${removedLines.length}`,
        ...(removedLines.slice(0, limit).map((line) => `Removed: ${line}`)),
      ],
      ok: true,
      receipt: createAgentMemoryReceipt({
        evidenceLines: removedLines.slice(0, limit),
        status: 'success',
        summaryLines: [
          '调用：execute_memory_action',
          '动作：forget',
          `删除：${removedLines.length} 条`,
        ],
        verification: removedLines.length
          ? '已从 Agent 管理的全局记忆中删除匹配条目。'
          : '没有找到可删除的 Agent 管理记忆。',
      }),
      responseText: removedLines.length
        ? `已经忘记 ${removedLines.length} 条匹配的 Agent 记忆。`
        : '没有找到可删除的 Agent 管理记忆；我没有改动全局知识库。',
      verification: removedLines.length
        ? '已从 Agent 管理的全局记忆中删除匹配条目。'
        : '没有找到可删除的 Agent 管理记忆。',
    };
  }

  return {
    errorText: 'Unsupported execute_memory_action action.',
    observations: [`Unsupported memory action: ${rawAction}`],
    ok: false,
    responseText: `execute_memory_action does not support action "${rawAction}".`,
  };
}
