import type { ConversationToolCall, ConversationToolDefinition } from '../agent/conversation/conversationToolTypes';

// The conversation loop keeps its turns in OpenAI's shape (assistant tool_calls, tool
// results). Gemini wants functionDeclarations, model functionCall parts and user
// functionResponse parts; these helpers convert between the two.

interface OpenAIStyleToolCall {
  function?: { arguments?: string; name?: string };
  id?: string;
  /** Gemini's opaque signature for its reasoning; must be sent back with the call. */
  thought_signature?: string;
}

interface OpenAIStyleMessage {
  content?: string | null;
  role?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIStyleToolCall[];
}

export function buildGeminiFunctionDeclarations(tools: ConversationToolDefinition[]) {
  return [{
    functionDeclarations: tools.map((tool) => ({
      description: tool.function.description,
      name: tool.function.name,
      parametersJsonSchema: tool.function.parameters,
    })),
  }];
}

function parseArgs(raw: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Assistant tool-call rounds and their results, as Gemini contents (results of one round grouped). */
export function buildGeminiToolContents(extraMessages: unknown[]) {
  const contents: Array<{ parts: unknown[]; role: 'model' | 'user' }> = [];
  const callNames = new Map<string, string>();
  for (const raw of extraMessages) {
    const message = (raw ?? {}) as OpenAIStyleMessage;
    if (message.role === 'assistant') {
      const parts: unknown[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.tool_calls ?? []) {
        const name = call.function?.name ?? '';
        if (call.id) callNames.set(call.id, name);
        parts.push({
          functionCall: { ...(call.id ? { id: call.id } : {}), args: parseArgs(call.function?.arguments), name },
          ...(call.thought_signature ? { thoughtSignature: call.thought_signature } : {}),
        });
      }
      if (parts.length) contents.push({ parts, role: 'model' });
      continue;
    }
    if (message.role === 'tool') {
      const part = {
        functionResponse: {
          ...(message.tool_call_id ? { id: message.tool_call_id } : {}),
          name: callNames.get(message.tool_call_id ?? '') ?? '',
          response: { result: message.content ?? '' },
        },
      };
      const last = contents[contents.length - 1];
      if (last?.role === 'user' && last.parts.every((item) => (item as { functionResponse?: unknown }).functionResponse)) last.parts.push(part);
      else contents.push({ parts: [part], role: 'user' });
    }
  }
  return contents;
}

interface GeminiChunkLike {
  candidates?: Array<{ content?: { parts?: Array<{ functionCall?: { args?: unknown; id?: string; name?: string }; thoughtSignature?: string }> } }>;
  /** Shape forwarded by the desktop main process. */
  functionCalls?: Array<{ args?: unknown; id?: string; name?: string; thoughtSignature?: string }>;
}

/** Function calls in one streamed chunk, from the SDK's own chunk or the desktop bridge's. */
export function readGeminiFunctionCalls(chunk: unknown, offset: number): ConversationToolCall[] {
  const value = (chunk ?? {}) as GeminiChunkLike;
  const calls = value.functionCalls
    ?? (value.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => part.functionCall)
      .map((part) => ({ ...part.functionCall, thoughtSignature: part.thoughtSignature }));
  return calls
    .filter((call) => call?.name)
    .map((call, index) => ({
      arguments: JSON.stringify(call.args ?? {}),
      id: call.id || `call_${offset + index}`,
      name: call.name as string,
      ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
    }));
}
