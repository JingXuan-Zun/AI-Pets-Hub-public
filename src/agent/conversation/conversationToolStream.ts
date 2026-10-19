import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  publishAgentRuntimeWorldProgress,
  publishAgentRuntimeWorldResult,
  publishAgentRuntimeWorldTaskStarted,
  type AgentRuntimeWorldResultInput,
} from '../../runtime-world/agentRuntimeWorldBridge';
import {
  listConversationToolDefinitions,
  runConversationToolCalls,
  type ConversationToolResult,
  type ConversationToolRuntime,
} from './conversationTools';
import { createConversationToolSink, type ConversationToolTurn } from './conversationToolTypes';

export const CONVERSATION_LOOP_MAX_ROUNDS = 8;
/** Operating the computer takes a round per action (each one needs to see the last result). */
export const CONVERSATION_LOOP_DESKTOP_MAX_ROUNDS = 40;

export interface ConversationLoopEvent {
  calls: Array<{ arguments: string; name: string }>;
  results: ConversationToolResult[];
  round: number;
}

/**
 * One model reply that may call tools: each round streams its text, then the tool calls run
 * and their results go back to the model, until it answers without calling a tool. Callers
 * consume it like an ordinary reply stream, so voice, expressions and memory capture work
 * unchanged.
 */
export async function* streamConversationWithTools(options: {
  maxRounds?: number;
  onToolRound?: (event: ConversationLoopEvent) => void;
  requestRound: (toolTurn: ConversationToolTurn) => Promise<AsyncIterable<unknown>>;
  runtime: ConversationToolRuntime;
}): AsyncGenerator<string> {
  const maxRounds = options.maxRounds ?? (options.runtime.desktop ? CONVERSATION_LOOP_DESKTOP_MAX_ROUNDS : CONVERSATION_LOOP_MAX_ROUNDS);
  const tools = listConversationToolDefinitions(options.runtime);
  const extraMessages: unknown[] = [];
  // Only the newest window reading stays in full; older ones shrink to one line so a long
  // task does not resend every element list.
  const compactable: Array<{ compact: string; message: { content: string } }> = [];
  let lastText = '';
  // The runtime world (the director that moves the pet while it works) hears about rounds that
  // use tools: started, each round, and how it ended. Plain chat sends nothing.
  let worldOutcome: AgentRuntimeWorldResultInput['status'] | null = null;
  let anyToolSucceeded = false;
  const taskState = { phase: 'running', taskId: `conversation-${Date.now().toString(36)}` };
  try {
    for (let round = 1; round <= maxRounds; round += 1) {
      const sink = createConversationToolSink();
      let text = '';
      for await (const chunk of await options.requestRound({ extraMessages: [...extraMessages], sink, tools })) {
        if (typeof chunk !== 'string' || !chunk) continue;
        // Keep consecutive rounds readable: a round that starts right after earlier text gets a break.
        if (!text && lastText && !/\s$/u.test(lastText)) yield '\n\n';
        text += chunk;
        lastText = text;
        yield chunk;
      }
      if (options.runtime.signal?.aborted) {
        if (worldOutcome) worldOutcome = 'cancelled';
        return;
      }
      if (!sink.toolCalls.length) {
        if (worldOutcome) worldOutcome = anyToolSucceeded ? 'completed' : 'failed';
        return;
      }
      if (!worldOutcome) publishAgentRuntimeWorldTaskStarted();
      worldOutcome = 'failed';
      publishAgentRuntimeWorldProgress({ continuation: { taskState }, stepIndex: round, type: 'tools-running' });

      extraMessages.push({
        content: text || null,
        role: 'assistant',
        tool_calls: sink.toolCalls.map((call) => ({
          function: { arguments: call.arguments || '{}', name: call.name },
          id: call.id,
          ...(call.thoughtSignature ? { thought_signature: call.thoughtSignature } : {}),
          type: 'function',
        })),
      });
      const results = await runConversationToolCalls(options.runtime, sink.toolCalls);
      anyToolSucceeded ||= results.some((result) => result.ok);
      publishAgentRuntimeWorldProgress({ continuation: { taskState }, stepIndex: round, type: 'tool-result' });
      if (results.some((result) => result.compact)) {
        compactable.splice(0).forEach((entry) => { entry.message.content = entry.compact; });
      }
      results.forEach((result) => {
        const message = { content: result.content, role: 'tool', tool_call_id: result.id };
        extraMessages.push(message);
        if (result.compact) compactable.push({ compact: result.compact, message });
      });
      pushFrontendRuntimeLog('对话循环', `第 ${round} 轮调用了 ${results.length} 个工具`, {
        calls: sink.toolCalls.map((call) => `${call.name}${call.arguments && call.arguments !== '{}' ? call.arguments.slice(0, 60) : ''}`).join(' | '),
        failed: results.filter((result) => !result.ok).map((result) => result.name).join(', '),
      });
      if (import.meta.env?.DEV) {
        // Dev-only trace for reviewing whole runs from DevTools; the runtime log rolls over too fast.
        const trace = ((globalThis as { __conversationLoopTrace?: string[] }).__conversationLoopTrace ??= []);
        trace.push(`${new Date().toLocaleTimeString()} 第${round}轮 ${results.map((result) => `${result.name}${result.ok ? '' : '✗'} ${sink.toolCalls.find((call) => call.id === result.id)?.arguments.slice(0, 80) ?? ''} → ${result.content.split('\n').slice(0, 2).join(' ').slice(0, 160)}`).join(' || ')}`);
        if (trace.length > 300) trace.splice(0, trace.length - 300);
      }
      options.onToolRound?.({
        calls: sink.toolCalls.map((call) => ({ arguments: call.arguments, name: call.name })),
        results,
        round,
      });
    }
    worldOutcome = 'max-steps';
    yield '\n\n（这件事步骤太多，我先停在这里，你看看要不要换个说法再试。）';
  } finally {
    if (worldOutcome) publishAgentRuntimeWorldResult({ status: worldOutcome, taskState: { ...taskState, phase: worldOutcome } });
    if (worldOutcome) {
      options.runtime.progress?.finish(worldOutcome === 'completed' ? 'done' : worldOutcome === 'cancelled' ? 'cancelled' : worldOutcome === 'max-steps' ? 'budget' : 'failed');
    }
  }
}
