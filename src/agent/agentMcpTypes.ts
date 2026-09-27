export type AgentMcpContentType = 'json' | 'text';

export interface AgentMcpToolContent {
  text: string;
  type: AgentMcpContentType;
}

export interface AgentMcpToolDefinition {
  annotations?: AgentMcpToolAnnotations;
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
  serverId: string;
  title: string;
}

export interface AgentMcpToolAnnotations {
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  readOnlyHint?: boolean;
  title?: string;
}

export interface AgentMcpToolCallRequest {
  argumentsJson?: string | null;
  name: string;
  requestId?: string | null;
  serverId: string;
}

export interface AgentMcpToolCallResult {
  content: AgentMcpToolContent[];
  isError?: boolean;
  structuredContent?: Record<string, unknown> | null;
}

export interface AgentMcpServerDefinition {
  description: string;
  id: string;
  title: string;
  tools: AgentMcpToolDefinition[];
}
