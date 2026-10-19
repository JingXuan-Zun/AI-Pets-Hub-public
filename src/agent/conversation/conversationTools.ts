import { executeMemoryAction } from '../agentRuntimeMemoryTools';
import { type AgentRuntimeExecutorContext } from '../agentRuntimeExecutor';
import { listPlatformCapabilities, runPlatformCapability } from '../../platform-capabilities/platformCapabilityRegistry';
import type { PlatformCapability } from '../../platform-capabilities/platformCapabilityTypes';
import type { PetConfig, PetConfigUpdateHandler } from '../../types';
import type { AgentChatCommandHandler } from '../agentChatCommand';
import { listConversationAgentBridgeTools } from './conversationAgentBridgeTools';
import type { ConversationDesktopSession } from './conversationDesktopTools';
import { conversationDesktopIconTool } from './conversationDesktopIconTool';
import { conversationWindowMoveTool } from './conversationWindowMoveTool';
import { conversationFileTool } from './conversationFileTools';
import type { ConversationToolCall, ConversationToolDefinition } from './conversationToolTypes';

/** What the tools can reach in the app; supplied by the chat session. */
export interface ConversationToolRuntime {
  configRef: { current: PetConfig };
  /** Fine-grained desktop tools (read a window, click, type, scroll, drag…) for this turn. */
  desktop?: ConversationDesktopSession;
  /** The existing Agent runtime, for the bridged tools (web pages, commands, skills, MCP…). */
  executeAgentCommand?: AgentChatCommandHandler;
  onUpdateConfig: PetConfigUpdateHandler;
  petId: string | null;
  /** Shows pictures in the chat as a message from this character (e.g. a drawing it made). */
  presentImages?: (images: Array<{ dataUrl: string; mimeType: string; name: string; sizeBytes?: number }>, caption: string) => void;
  /** Shows a plain-language confirmation card and resolves with the user's answer. */
  requestApproval: (request: { detail: string; title: string }) => Promise<boolean>;
  /** Reports each tool call to the task card in the chat (plain-language progress only). */
  progress?: ConversationTaskProgress;
  signal?: AbortSignal | null;
}

export interface ConversationTaskProgress {
  finish: (status: 'done' | 'failed' | 'cancelled' | 'budget') => void;
  stepFinished: (id: string, ok: boolean) => void;
  stepStarted: (id: string, name: string, args: Record<string, unknown>) => void;
}

export interface ConversationTool {
  definition: ConversationToolDefinition;
  /** Returns the confirmation text when the call changes something; null runs it directly. */
  confirmation: (args: Record<string, unknown>) => string | null;
  run: (runtime: ConversationToolRuntime, args: Record<string, unknown>) => Promise<string | { compact?: string; content: string }>;
  /** Runs one at a time in call order (desktop actions depend on what the previous one did). */
  sequential?: boolean;
}

export interface ConversationToolResult {
  /** Shorter form that replaces this result in later rounds once a newer one has `compact` too. */
  compact?: string;
  content: string;
  id: string;
  name: string;
  ok: boolean;
}

const CAPABILITY_PREFIX = 'cap_';

export function capabilityToolName(id: string) {
  return `${CAPABILITY_PREFIX}${id.replace(/[^a-zA-Z0-9_-]/gu, '__')}`;
}

function capabilityTool(capability: PlatformCapability): ConversationTool {
  const properties = Object.fromEntries(capability.args.map((arg) => [arg.key, {
    description: arg.description,
    type: arg.type,
    ...(arg.enumValues ? { enum: arg.enumValues } : {}),
  }]));
  return {
    confirmation: (args) => (capability.risk === 'change' ? capability.describe(args) : null),
    definition: {
      function: {
        description: `【${capability.group}】${capability.title}。${capability.description}`,
        name: capabilityToolName(capability.id),
        parameters: {
          properties,
          required: capability.args.filter((arg) => arg.required).map((arg) => arg.key),
          type: 'object',
        },
      },
      type: 'function',
    },
    run: async (runtime, args) => {
      const result = await runPlatformCapability(runtime, { args, capability: capability.id });
      return result.ok ? result.text : `失败：${result.text}`;
    },
  };
}

const memoryTool: ConversationTool = {
  confirmation: (args) => (args.action === 'forget' ? `让所有角色忘掉「关于你」里和“${String(args.query ?? '')}”有关的记忆` : null),
  definition: {
    function: {
      description: '「关于你」共享记忆：所有角色都知道的、关于用户本人的事实。recall 查询；remember 提议记住（用户在侧栏批准后才写入）；forget 删除。用户只是闲聊时不要调用。',
      name: 'memory',
      parameters: {
        properties: {
          action: { enum: ['recall', 'remember', 'forget'], type: 'string' },
          kind: { enum: ['profile', 'preference', 'promise', 'event', 'other'], type: 'string' },
          query: { description: 'recall/forget 的关键词', type: 'string' },
          value: { description: 'remember 时要记住的一句话事实，只写用户自己说的内容', type: 'string' },
        },
        required: ['action'],
        type: 'object',
      },
    },
    type: 'function',
  },
  run: async (runtime, args) => {
    const result = await executeMemoryAction(
      { configRef: runtime.configRef, onUpdateConfig: runtime.onUpdateConfig, petId: runtime.petId } as unknown as AgentRuntimeExecutorContext,
      { goal: '', input: args, name: 'execute_memory_action' },
    );
    return result.responseText;
  },
};

const todoLists = new WeakMap<object, string>();

/** A checklist the model keeps for long tasks so it does not lose the goal halfway. */
const todosTool: ConversationTool = {
  confirmation: () => null,
  definition: {
    function: {
      description: '长任务（三步以上）的待办清单：开始时列出步骤，每完成一步就重新提交整张清单并把做完的标成 [x]。只是记给自己看的，不会显示给用户。',
      name: 'update_todos',
      parameters: {
        properties: { todos: { description: '整张清单，一行一项，例如 “[x] 打开记事本\n[ ] 输入文字”', type: 'string' } },
        required: ['todos'],
        type: 'object',
      },
    },
    type: 'function',
  },
  run: async (runtime, args) => {
    const todos = typeof args.todos === 'string' ? args.todos.trim() : '';
    if (!todos) return '需要 todos。';
    todoLists.set(runtime, todos);
    const left = todos.split(/\r?\n/u).filter((line) => /^\s*\[ \]/u.test(line)).length;
    return left ? `已更新，还剩 ${left} 项。` : '已更新，全部完成了；确认结果后回复用户。';
  },
};

function buildTools(runtime: Pick<ConversationToolRuntime, 'configRef' | 'desktop' | 'executeAgentCommand' | 'petId'>) {
  const desktopTools: ConversationTool[] = runtime.desktop
    ? runtime.desktop.tools.map((desktopTool) => ({
      confirmation: () => null,
      definition: desktopTool.definition,
      run: (_runtime, args) => desktopTool.run(args),
      sequential: true,
    }))
    : [];
  const tools: ConversationTool[] = [
    ...listPlatformCapabilities().map(capabilityTool),
    memoryTool,
    conversationFileTool,
    conversationDesktopIconTool,
    conversationWindowMoveTool,
    todosTool,
    ...desktopTools,
    ...listConversationAgentBridgeTools(runtime),
  ];
  return new Map(tools.map((tool) => [tool.definition.function.name, tool]));
}

/** Stable order so the request prefix stays cacheable. */
export function listConversationToolDefinitions(runtime: Pick<ConversationToolRuntime, 'configRef' | 'desktop' | 'executeAgentCommand' | 'petId'>) {
  return [...buildTools(runtime).values()].map((tool) => tool.definition);
}

const approvedStepsByRuntime = new WeakMap<ConversationToolRuntime, Set<string>>();

function parseArgs(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// Tools report most failures as text rather than throwing ("结果：失败，…").
const FAILED_OUTPUT = /^(?:失败|结果：失败|不能用|用户没有同意|用户拒绝)/u;

async function runOne(tools: Map<string, ConversationTool>, runtime: ConversationToolRuntime, call: ConversationToolCall): Promise<ConversationToolResult> {
  const args = parseArgs(call.arguments);
  if (tools.has(call.name) && args) runtime.progress?.stepStarted(call.id, call.name, args);
  const result = await runOneStep(tools, runtime, call);
  runtime.progress?.stepFinished(call.id, result.ok && !FAILED_OUTPUT.test(result.content));
  return result;
}

async function runOneStep(tools: Map<string, ConversationTool>, runtime: ConversationToolRuntime, call: ConversationToolCall): Promise<ConversationToolResult> {
  const tool = tools.get(call.name);
  const fail = (content: string) => ({ content, id: call.id, name: call.name, ok: false });
  if (!tool) return fail(`没有叫 ${call.name} 的工具。`);
  const args = parseArgs(call.arguments);
  if (!args) return fail('参数不是合法的 JSON，请重新调用。');
  const confirmation = tool.confirmation(args);
  // The same step approved once in this reply is not asked again (launching the same app
  // twice stacked two identical cards in the chat).
  const approvedSteps = approvedStepsByRuntime.get(runtime) ?? new Set<string>();
  if (confirmation && !approvedSteps.has(confirmation)) {
    const approved = await runtime.requestApproval({ detail: confirmation, title: confirmation });
    if (!approved) return fail('用户没有同意，这一步没有执行。不要再重复请求，直接告诉用户。');
    approvedSteps.add(confirmation);
    approvedStepsByRuntime.set(runtime, approvedSteps);
  }
  try {
    const output = await tool.run(runtime, args);
    return typeof output === 'string'
      ? { content: output, id: call.id, name: call.name, ok: true }
      : { ...output, id: call.id, name: call.name, ok: true };
  } catch (error) {
    return fail(`执行出错：${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Runs one round of tool calls. Calls that need no confirmation run in parallel; ones that
 * ask the user run one at a time so approval cards don't stack up.
 */
export async function runConversationToolCalls(runtime: ConversationToolRuntime, calls: ConversationToolCall[]) {
  const tools = buildTools(runtime);
  const results = new Map<string, ConversationToolResult>();
  const direct = calls.filter((call) => {
    const tool = tools.get(call.name);
    const args = tool ? parseArgs(call.arguments) : null;
    return !tool || !args || (!tool.sequential && !tool.confirmation(args));
  });
  (await Promise.all(direct.map((call) => runOne(tools, runtime, call)))).forEach((result) => results.set(result.id, result));
  for (const call of calls.filter((entry) => !direct.includes(entry))) {
    if (runtime.signal?.aborted) break;
    results.set(call.id, await runOne(tools, runtime, call));
  }
  return calls.map((call) => results.get(call.id) ?? { content: '已取消。', id: call.id, name: call.name, ok: false });
}
