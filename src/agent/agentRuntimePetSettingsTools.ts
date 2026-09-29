import { type PetConfig } from '../types';
import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

import {
  cloneAgentPetSettingsValue,
  collectAgentPetSettingsPaths,
  doesAgentPetSettingsValueTypeMatch,
  formatAgentPetSettingsValue,
  getAgentPetSettingsValueAtPath,
  isAgentPetSettingsPlainRecord,
  parseAgentPetSettingsPath,
  setAgentPetSettingsValueAtPath,
  type AgentPetSettingsJsonValue,
} from './agentPetSettingsValueTree';

const MAX_QUERY_RESULTS = 40;

const PET_SETTINGS_QUERY_TERM_ALIASES: ReadonlyArray<{
  pattern: RegExp;
  pathTerms: readonly string[];
}> = [
  { pattern: /聊天|对话/iu, pathTerms: ['chat'] },
  { pattern: /文字|文本/iu, pathTerms: ['text'] },
  { pattern: /颜色|色彩/iu, pathTerms: ['color'] },
];

function doesPetSettingsPathMatchQuery(path: string, query: string) {
  const normalizedPath = path.toLowerCase();
  if (normalizedPath.includes(query)) return true;

  const englishTerms = query.match(/[a-z0-9]+/gu) ?? [];
  const requiredTermGroups = [
    ...englishTerms.map((term) => [term]),
    ...PET_SETTINGS_QUERY_TERM_ALIASES
      .filter(({ pattern }) => pattern.test(query))
      .map(({ pathTerms }) => pathTerms),
  ];
  return requiredTermGroups.length > 0
    && requiredTermGroups.every((terms) => terms.some((term) => normalizedPath.includes(term)));
}

function parseChanges(toolCall: AgentToolCallCommand) {
  const rawChanges = toolCall.input?.changesJson;
  if (typeof rawChanges !== 'string' || !rawChanges.trim()) {
    return { error: '需要提供 changesJson：一个以配置路径为键、JSON 值为值的对象。' } as const;
  }

  try {
    const parsed = JSON.parse(rawChanges) as unknown;
    if (!isAgentPetSettingsPlainRecord(parsed) || !Object.keys(parsed).length) {
      return { error: 'changesJson 必须是至少包含一个配置路径的 JSON 对象。' } as const;
    }
    return { changes: parsed as Record<string, AgentPetSettingsJsonValue> } as const;
  } catch {
    return { error: 'changesJson 不是有效 JSON。' } as const;
  }
}

function describeConfigValue(path: string, value: unknown) {
  return `${path} = ${formatAgentPetSettingsValue(value, path)}`;
}

export function executeGetPetSettings(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): AgentChatCommandResult {
  const config = runtime.configRef.current;
  const pathInput = toolCall.input?.path;
  const queryInput = toolCall.input?.query;

  if (typeof pathInput === 'string' && pathInput.trim()) {
    const path = parseAgentPetSettingsPath(pathInput);
    const result = path ? getAgentPetSettingsValueAtPath(config, path) : { found: false as const, value: undefined };
    if (!result.found) {
      return {
        responseText: `没有找到配置路径「${pathInput}」。可以先读取配置结构，再使用返回的精确路径。`,
      };
    }

    return {
      observations: [describeConfigValue(pathInput.trim(), result.value)],
      responseText: `当前配置：${describeConfigValue(pathInput.trim(), result.value)}。`,
      verification: `${pathInput.trim()} 已从当前桌宠配置回读。`,
    };
  }

  const normalizedQuery = typeof queryInput === 'string' ? queryInput.trim().toLowerCase() : '';
  const discoveredPaths = collectAgentPetSettingsPaths(config);
  const matchingPaths = normalizedQuery
    ? discoveredPaths.filter((path) => doesPetSettingsPathMatchQuery(path, normalizedQuery)).slice(0, MAX_QUERY_RESULTS)
    : discoveredPaths.slice(0, MAX_QUERY_RESULTS);
  const lines = matchingPaths.map((path) => {
    const value = getAgentPetSettingsValueAtPath(config, parseAgentPetSettingsPath(path) ?? []).value;
    return describeConfigValue(path, value);
  });

  return {
    observations: lines,
    responseText: normalizedQuery
      ? `与「${queryInput}」匹配的配置：\n${lines.join('\n') || '没有匹配项。'}`
      : `可读取或修改的桌宠配置路径示例：\n${lines.join('\n')}\n可使用 query 查找字段，或以精确 path 读取。敏感值会隐藏。`,
    verification: `已从当前配置树读取 ${matchingPaths.length} 个路径。`,
  };
}

export async function executeUpdatePetSettings(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const parsed = parseChanges(toolCall);
  if ('error' in parsed) {
    return { responseText: parsed.error };
  }

  const draft = cloneAgentPetSettingsValue(runtime.configRef.current);
  const validationErrors: string[] = [];
  for (const [pathText, value] of Object.entries(parsed.changes)) {
    const path = parseAgentPetSettingsPath(pathText);
    const current = path ? getAgentPetSettingsValueAtPath(draft, path) : { found: false as const, value: undefined };
    if (!path || !current.found) {
      validationErrors.push(`不存在的配置路径：${pathText}`);
      continue;
    }
    if (!doesAgentPetSettingsValueTypeMatch(current.value, value)) {
      validationErrors.push(`配置类型不匹配：${pathText} 需要 ${Array.isArray(current.value) ? 'array' : typeof current.value}`);
      continue;
    }
    if (!setAgentPetSettingsValueAtPath(draft, path, value)) {
      validationErrors.push(`无法写入配置路径：${pathText}`);
    }
  }

  if (validationErrors.length) {
    return {
      responseText: `没有保存任何设置：\n${validationErrors.join('\n')}`,
    };
  }

  const { normalizePetConfig } = await import('../petConfigNormalization');
  const normalizedConfig = normalizePetConfig(draft);
  const verifiedLines = Object.keys(parsed.changes).map((pathText) => {
    const value = getAgentPetSettingsValueAtPath(normalizedConfig, parseAgentPetSettingsPath(pathText) ?? []).value;
    return describeConfigValue(pathText, value);
  });
  runtime.onUpdateConfig(normalizedConfig);

  return {
    observations: verifiedLines,
    responseText: `桌宠设置已更新：\n${verifiedLines.join('\n')}`,
    verification: `已规范化、保存并回读 ${verifiedLines.length} 个桌宠配置参数。`,
  };
}