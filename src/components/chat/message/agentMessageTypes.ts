import { type ChatAgentRunTraceItem, type ChatMessage } from '../../../types';

export type ChatAgentProcessPanelSource = NonNullable<ChatMessage['agentRun']> | NonNullable<ChatMessage['agentApproval']>;

export type ChatAgentSessionV2Process = NonNullable<ChatAgentProcessPanelSource['agentRuntime']>;

export type ChatAgentSessionV2ProcessStep = ChatAgentSessionV2Process['steps'][number];

export type ChatAgentSessionV2TraceEvent = ChatAgentSessionV2Process['traceEvents'][number];

type ChatAgentRuntimeDiagnostic = NonNullable<ChatAgentSessionV2Process['diagnostics']>[number];

export type ChatAgentSessionV2ToolResultEntry = ChatAgentSessionV2Process['toolResults'][number];

export type ChatAgentSessionV2StuckSignalTone = 'amber' | 'rose' | 'sky';

export interface ChatAgentSessionV2StuckSignalSummary {
  detail: string;
  id: string;
  label: string;
  tone: ChatAgentSessionV2StuckSignalTone;
}

export function resolveLatestAgentRuntimeDiagnosticEvent(
  session: ChatAgentSessionV2Process,
): ChatAgentSessionV2TraceEvent | null {
  const diagnostic = [...(session.diagnostics ?? [])]
    .reverse()
    .find((candidate: ChatAgentRuntimeDiagnostic) => (
      candidate.category === 'runtime-shadow'
      || candidate.category === 'approval-continuation'
    ));
  if (diagnostic) {
    return {
      details: diagnostic.payload.details ?? undefined,
      id: `diagnostic-${diagnostic.source}-${diagnostic.timestamp}`,
      status: diagnostic.payload.status ?? null,
      stepIndex: session.steps.length + 1,
      summary: diagnostic.payload.summary,
      timestamp: diagnostic.timestamp,
      tool: diagnostic.payload.tool ?? null,
      type: 'runtime_shadow',
    };
  }

  return [...(session.traceEvents ?? [])]
    .reverse()
    .find((event) => event.type === 'runtime_shadow') ?? null;
}

export interface ChatAgentSessionV2PerformanceSignalSummary {
  detail: string;
  id: string;
  label: string;
  tone: ChatAgentSessionV2StuckSignalTone;
}

export interface ChatAgentVisualObservation {
  companionCue?: string | null;
  confidence?: string | null;
  contentLines: string[];
  key: string;
  ok: boolean;
  recoveryLines: string[];
  source?: string | null;
  summary?: string | null;
  toolName: string;
  uncertaintyLines: string[];
  visibleTextLines: string[];
}

export interface ChatAgentCompactTimelineItem {
  detail?: string | null;
  id: string;
  label: string;
  status: ChatAgentRunTraceItem['status'];
}
