// Native tool calling for the conversation loop (OpenAI-compatible `tools` / `tool_calls`).

/**
 * Appended to the system prompt whenever tools are offered. Without it the character would
 * sometimes act out "I opened it and typed it" in role-play without calling any tool.
 */
export const CONVERSATION_TOOL_RULES = [
  '【工具使用规则（最高优先级，高于角色扮演）】',
  '1. 用户这条消息要你在电脑上做事、改设置、查状态、记东西时，必须先调用工具真正去做。括号里的动作描写不能代替工具调用：没有调用工具，电脑上什么都不会发生。',
  '2. 只有看到这次工具返回的结果，才能说做成了；说结果时只依据工具返回的内容，不要编造没看到的细节（文件名、日期、界面样子）。失败或没做完就如实说。',
  '3. 聊天记录里以前做过的事不代表这次已经做了；也不要凭记忆描述现在屏幕上的样子，要重新读取。',
  '4. 操作电脑：先 read_window 或 list_windows 看清现状，再用编号操作；每次操作都会返回变化和最新清单，据此判断下一步。',
  '5. 文件的重命名、移动、复制、新建文件夹、找文件，用 files 工具直接做，不要去资源管理器里点。',
  '5.2 用户要把桌面上的文件、文件夹或快捷方式“放到/挪到/移到”某块屏幕（副屏、另一个屏幕、右边那块屏幕）上，指的是挪桌面图标：直接用 move_desktop_icon，不要打开它，也不要去拖窗口。',
  '5.1 用户问电脑里的东西（某个文件或文件夹在哪、里面有什么、装了什么）时，主动用 files 去查（不知道从哪找就先 places），查到再回答；不要没查就说“不知道”“工具没提供”。查看不用问用户，改动会自动请用户确认。',
  '6. 只做用户要的事：达到目标就停下来回复，不要顺手做额外操作（打开文件、关闭窗口、整理窗口等），除非用户要求。',
  '7. 只是闲聊时不要调用工具。',
].join('\n');

export interface ConversationToolDefinition {
  function: {
    description: string;
    name: string;
    parameters: Record<string, unknown>;
  };
  type: 'function';
}

export interface ConversationToolCall {
  /** Raw JSON string the model produced. */
  arguments: string;
  id: string;
  name: string;
  /** Gemini only: signature of the model's reasoning, sent back with the call. */
  thoughtSignature?: string;
}

/** Collects the tool calls of one model response while its text streams normally. */
export interface ConversationToolSink {
  toolCalls: ConversationToolCall[];
}

/** What one chat request carries when the conversation loop is on. */
export interface ConversationToolTurn {
  /** Assistant tool_call messages and tool results appended after the user message. */
  extraMessages: unknown[];
  sink: ConversationToolSink;
  tools: ConversationToolDefinition[];
}

export function createConversationToolSink(): ConversationToolSink {
  return { toolCalls: [] };
}

/** Merges streamed `delta.tool_calls` fragments (keyed by index) into whole calls. */
export function accumulateToolCallDeltas(
  pending: Map<number, ConversationToolCall>,
  deltas: unknown,
) {
  if (!Array.isArray(deltas)) return;
  deltas.forEach((delta, position) => {
    if (!delta || typeof delta !== 'object') return;
    const record = delta as { function?: { arguments?: unknown; name?: unknown }; id?: unknown; index?: unknown };
    const index = typeof record.index === 'number' ? record.index : position;
    const current = pending.get(index) ?? { arguments: '', id: '', name: '' };
    if (typeof record.id === 'string' && record.id) current.id = record.id;
    if (typeof record.function?.name === 'string') current.name += record.function.name;
    if (typeof record.function?.arguments === 'string') current.arguments += record.function.arguments;
    pending.set(index, current);
  });
}

export function finishToolCalls(pending: Map<number, ConversationToolCall>) {
  return [...pending.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, call]) => ({ ...call, id: call.id || `call_${index}` }))
    .filter((call) => call.name);
}
