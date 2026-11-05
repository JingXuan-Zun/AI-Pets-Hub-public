import type { ConversationTool, ConversationToolRuntime } from './conversationTools';

// The one way tools reach her: every source of tools (platform capabilities, memory, files,
// desktop actions, web/skills/MCP, and later plugins) registers a provider here, and each
// reply asks all providers for the tools it may use. The order is fixed by `order` so the
// tool list — and with it the cacheable request prefix — stays the same between replies.

export type ConversationToolScope = Pick<ConversationToolRuntime, 'configRef' | 'desktop' | 'executeAgentCommand' | 'petId'>;

export interface ConversationToolProvider {
  id: string;
  /** Lower comes first in the tool list. */
  order: number;
  tools: (scope: ConversationToolScope) => ConversationTool[];
}

const providers = new Map<string, ConversationToolProvider>();

/** Adds (or replaces, by id) a source of tools. */
export function registerConversationToolProvider(provider: ConversationToolProvider) {
  providers.set(provider.id, provider);
  return () => {
    if (providers.get(provider.id) === provider) providers.delete(provider.id);
  };
}

/** All tools for this reply, by name; a later provider cannot replace a tool an earlier one gave. */
export function collectConversationTools(scope: ConversationToolScope) {
  const tools = new Map<string, ConversationTool>();
  [...providers.values()].sort((a, b) => a.order - b.order).forEach((provider) => {
    provider.tools(scope).forEach((tool) => {
      const name = tool.definition.function.name;
      if (tools.has(name)) {
        console.warn(`[conversation-tools] ${provider.id} offered ${name} again; the first one is kept`);
        return;
      }
      tools.set(name, tool);
    });
  });
  return tools;
}
