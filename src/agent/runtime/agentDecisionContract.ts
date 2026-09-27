import { type AgentToolCallName } from '../agentChatCommand';
import { isAgentToolName } from '../agentToolRegistry';
import { prepareAgentToolInput } from '../agentToolInputSchema';
import {
  type AgentModelDecision,
  type AgentModelParallelToolCall,
} from './agentModelDecisionRuntime';
import {
  type AgentRuntimeUnderstanding,
  type AgentRuntimeVerificationStatus,
} from './agentRuntimeContract';

export type AgentDecisionToolInputIssue =
  | 'invalid-args'
  | 'missing-tool'
  | 'unavailable-tool';

export type AgentDecisionToolInputResult =
  | {
      args: Record<string, unknown>;
      ok: true;
      toolName: AgentToolCallName;
    }
  | {
      error: string;
      issue: AgentDecisionToolInputIssue;
      ok: false;
      toolName?: string | null;
    };

export function normalizeAgentDecisionText(value: string) {
  return value.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
}

function normalizeAgentDecisionStringList(value: unknown): string[] | undefined {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n;,|]+/u)
      : [];
  const items = rawItems
    .map((item) => (typeof item === 'string' ? item.normalize('NFKC').trim() : ''))
    .filter((item) => (
      item
      && !/^(?:none|nothing|n\/a|null|no remaining goals?|all done|completed|done|\u65e0|\u6ca1\u6709|\u6682\u65e0|\u5df2\u5b8c\u6210|\u5168\u90e8\u5b8c\u6210)$/iu.test(item)
    ));

  return items.length ? items : undefined;
}

function normalizeAgentDecisionVerificationStatus(
  value: unknown,
): AgentRuntimeVerificationStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.normalize('NFKC').trim().toLowerCase();
  if (normalized === 'satisfied' || normalized === 'success' || normalized === 'verified' || normalized === 'complete') {
    return 'satisfied';
  }
  if (normalized === 'blocked' || normalized === 'failed' || normalized === 'impossible') {
    return 'blocked';
  }
  if (normalized === 'partial' || normalized === 'incomplete') {
    return 'partial';
  }
  if (normalized === 'unknown' || normalized === 'unclear' || normalized === 'unverified') {
    return 'unknown';
  }
  return undefined;
}

function normalizeAgentDecisionUnderstanding(value: unknown): AgentRuntimeUnderstanding | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  return {
    blockedGoals: normalizeAgentDecisionStringList(source.blockedGoals),
    capabilityGap: typeof source.capabilityGap === 'string' ? source.capabilityGap : undefined,
    completedGoals: normalizeAgentDecisionStringList(source.completedGoals),
    neededCapability: typeof source.neededCapability === 'string' ? source.neededCapability : undefined,
    remainingGoals: normalizeAgentDecisionStringList(source.remainingGoals),
    successCriteria: typeof source.successCriteria === 'string' ? source.successCriteria : undefined,
    userNeed: typeof source.userNeed === 'string' ? source.userNeed : undefined,
    verificationEvidence: normalizeAgentDecisionStringList(source.verificationEvidence),
    verificationGaps: normalizeAgentDecisionStringList(source.verificationGaps),
    verificationStatus: normalizeAgentDecisionVerificationStatus(source.verificationStatus),
  };
}

function normalizeAgentDecisionParallelToolCalls(value: unknown): AgentModelParallelToolCall[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tools = value
    .map((item): AgentModelParallelToolCall | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      if (typeof source.tool !== 'string' || !source.tool.trim()) {
        return null;
      }

      return {
        args: source.args && typeof source.args === 'object' && !Array.isArray(source.args)
          ? source.args as Record<string, unknown>
          : undefined,
        reason: typeof source.reason === 'string' ? source.reason : null,
        tool: source.tool.trim(),
      };
    })
    .filter((tool): tool is AgentModelParallelToolCall => tool !== null);

  return tools.length ? tools : undefined;
}

function tryParseAgentDecisionJson(text: string): AgentModelDecision | null {
  try {
    const parsed = JSON.parse(text) as Partial<AgentModelDecision> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const action = parsed.action === 'tool_call'
      || parsed.action === 'tool_calls'
      || parsed.action === 'ask_user'
      || parsed.action === 'final_answer'
      ? parsed.action
      : null;
    if (!action) {
      return null;
    }

    return {
      action,
      args: parsed.args && typeof parsed.args === 'object' && !Array.isArray(parsed.args)
        ? parsed.args as Record<string, unknown>
        : undefined,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
      tool: typeof parsed.tool === 'string' ? parsed.tool : null,
      tools: normalizeAgentDecisionParallelToolCalls(parsed.tools),
      understanding: normalizeAgentDecisionUnderstanding(parsed.understanding),
    };
  } catch {
    return null;
  }
}

export function parseAgentDecisionContract(text: string): AgentModelDecision | null {
  const normalizedText = normalizeAgentDecisionText(text);
  const directParse = tryParseAgentDecisionJson(normalizedText);
  if (directParse) {
    return directParse;
  }

  const startIndex = normalizedText.indexOf('{');
  const endIndex = normalizedText.lastIndexOf('}');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  return tryParseAgentDecisionJson(normalizedText.slice(startIndex, endIndex + 1));
}

function validateAgentDecisionCompositeJsonInput(
  toolName: string,
  input: Record<string, unknown>,
) {
  if (toolName !== 'execute_desktop_sequence') {
    return null;
  }

  const stepsJson = typeof input.stepsJson === 'string' ? input.stepsJson.trim() : '';
  if (!stepsJson) {
    return 'execute_desktop_sequence needs stepsJson.';
  }

  try {
    if (!Array.isArray(JSON.parse(stepsJson) as unknown)) {
      return 'execute_desktop_sequence stepsJson must be a JSON array.';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `execute_desktop_sequence stepsJson is not valid JSON: ${message}`;
  }

  return null;
}

export function prepareAgentDecisionToolInput(options: {
  args?: Record<string, unknown> | null;
  toolName: string | null | undefined;
}): AgentDecisionToolInputResult {
  const rawToolName = typeof options.toolName === 'string' ? options.toolName.trim() : '';
  if (!rawToolName) {
    return {
      error: 'Agent tool_call is missing tool.',
      issue: 'missing-tool',
      ok: false,
      toolName: options.toolName ?? null,
    };
  }

  if (!isAgentToolName(rawToolName)) {
    return {
      error: `Tool "${rawToolName}" is not registered.`,
      issue: 'unavailable-tool',
      ok: false,
      toolName: rawToolName,
    };
  }

  const preparedInput = prepareAgentToolInput(rawToolName, options.args ?? {});
  if (preparedInput.ok === false) {
    return {
      error: preparedInput.error,
      issue: 'invalid-args',
      ok: false,
      toolName: rawToolName,
    };
  }

  const compositeInputError = validateAgentDecisionCompositeJsonInput(
    rawToolName,
    preparedInput.input,
  );
  if (compositeInputError) {
    return {
      error: compositeInputError,
      issue: 'invalid-args',
      ok: false,
      toolName: rawToolName,
    };
  }

  return {
    args: preparedInput.input,
    ok: true,
    toolName: rawToolName,
  };
}
