import { readMessageProjectSources as readProjectSources } from './chatMessageSource.mjs';
import { assertSourceMatches } from './smokeTestHarness.ts';

const { bubble: bubbleSource } = readProjectSources({
  bubble: 'src/components/chat/PetChatConversationMessageBubble.tsx',
});

assertSourceMatches(
  bubbleSource,
  /type ChatAgentSessionV2TraceEvent = ChatAgentSessionV2Process\['traceEvents'\]\[number\]/u,
  'AgentSessionV2 trace events should have a UI-local typed event alias.',
);
assertSourceMatches(
  bubbleSource,
  /function PetChatAgentSessionV2TracePanel/u,
  'AgentSessionV2 trace panel should exist.',
);
assertSourceMatches(
  bubbleSource,
  /function createAgentSessionV2TraceDebugSummary/u,
  'AgentSessionV2 trace panel should build a copyable debug summary.',
);
assertSourceMatches(
  bubbleSource,
  /AgentSessionV2 trace debug summary/u,
  'AgentSessionV2 trace debug summary should have a stable header.',
);
assertSourceMatches(
  bubbleSource,
  /compactedTraceEvents/u,
  'AgentSessionV2 trace debug summary should include compacted trace counts when present.',
);
assertSourceMatches(
  bubbleSource,
  /case 'trace_compacted':/u,
  'AgentSessionV2 trace panel should label compacted trace events.',
);
assertSourceMatches(
  bubbleSource,
  /function resolveLatestAgentRuntimeDiagnosticEvent/u,
  'AgentSessionV2 diagnostics UI should prefer the diagnostic envelope.',
);
assertSourceMatches(
  bubbleSource,
  /session\.diagnostics[\s\S]*runtime-shadow[\s\S]*approval-continuation/u,
  'AgentSessionV2 diagnostics UI should read Runtime and approval diagnostics.',
);
assertSourceMatches(
  bubbleSource,
  /case 'runtime_shadow':[\s\S]*Runtime Shadow/u,
  'AgentSessionV2 trace panel should retain legacy runtime shadow labels.',
);
assertSourceMatches(
  bubbleSource,
  /event\.type === 'runtime_shadow' && status !== 'verified_success'/u,
  'AgentSessionV2 trace panel should visually highlight non-success runtime shadow states.',
);
assertSourceMatches(
  bubbleSource,
  /'classification'[\s\S]*'state'[\s\S]*'eventKinds'[\s\S]*'notes'/u,
  'AgentSessionV2 trace panel should expose V4 runtime shadow details.',
);
assertSourceMatches(
  bubbleSource,
  /'totalElapsedMs'[\s\S]*'slowestToolName'[\s\S]*'slowestToolDurationMs'/u,
  'AgentSessionV2 trace panel should expose V4 runtime shadow timing details.',
);
assertSourceMatches(
  bubbleSource,
  /navigator\.clipboard\.writeText/u,
  'AgentSessionV2 trace panel should copy the debug summary to the clipboard.',
);
assertSourceMatches(
  bubbleSource,
  /Copy trace debug summary/u,
  'AgentSessionV2 trace panel should expose a copy debug summary button.',
);
assertSourceMatches(
  bubbleSource,
  /traceEvents\.slice\(-8\)\.map/u,
  'AgentSessionV2 trace panel should render a bounded recent trace list.',
);
assertSourceMatches(
  bubbleSource,
  /resolveAgentSessionV2TraceDetailPairs/u,
  'AgentSessionV2 trace panel should expose compact key evidence details.',
);
assertSourceMatches(
  bubbleSource,
  /timingStatus/u,
  'AgentSessionV2 trace panel should expose timing status details for slow/cache/dedupe diagnosis.',
);
assertSourceMatches(
  bubbleSource,
  /timingDetail/u,
  'AgentSessionV2 trace panel should expose timing detail text for slow/cache/dedupe diagnosis.',
);
assertSourceMatches(
  bubbleSource,
  /cacheHit/u,
  'AgentSessionV2 trace panel should expose cache hit details for read-only tool diagnosis.',
);
assertSourceMatches(
  bubbleSource,
  /coveredByTool/u,
  'AgentSessionV2 trace panel should expose dedupe coverage tool details.',
);
assertSourceMatches(
  bubbleSource,
  /coverageReason/u,
  'AgentSessionV2 trace panel should expose dedupe coverage reason details.',
);
assertSourceMatches(
  bubbleSource,
  /stringifyAgentSessionV2TraceDetailValue/u,
  'AgentSessionV2 trace panel should format selected trace detail values before display.',
);
assertSourceMatches(
  bubbleSource,
  /formatAgentSessionV2TimingDuration\(value\)/u,
  'AgentSessionV2 trace panel should render durationMs using the timing duration formatter.',
);
assertSourceMatches(
  bubbleSource,
  /function resolveAgentSessionV2TraceStuckSignals/u,
  'AgentSessionV2 trace panel should derive stuck signal summaries from trace/tool evidence.',
);
assertSourceMatches(
  bubbleSource,
  /function resolveAgentSessionV2PerformanceSignals/u,
  'AgentSessionV2 trace panel should derive performance diagnosis signals from timing/tool evidence.',
);
assertSourceMatches(
  bubbleSource,
  /Performance signals/u,
  'AgentSessionV2 trace panel should render performance diagnosis signals.',
);
assertSourceMatches(
  bubbleSource,
  /Runtime diagnosis/u,
  'AgentSessionV2 trace panel should render the latest runtime shadow as a prominent diagnosis.',
);
assertSourceMatches(
  bubbleSource,
  /Runtime shadow:/u,
  'AgentSessionV2 trace debug summary should include the latest runtime shadow diagnosis.',
);
assertSourceMatches(
  bubbleSource,
  /model_time_dominant/u,
  'AgentSessionV2 trace panel should identify model-dominant slow runs.',
);
assertSourceMatches(
  bubbleSource,
  /tool_time_dominant/u,
  'AgentSessionV2 trace panel should identify tool-dominant slow runs.',
);
assertSourceMatches(
  bubbleSource,
  /no_readonly_cache_hits/u,
  'AgentSessionV2 trace panel should identify read-only cache miss patterns.',
);
assertSourceMatches(
  bubbleSource,
  /repeated_recent_observation_tools/u,
  'AgentSessionV2 trace panel should identify repeated recent observation patterns.',
);
assertSourceMatches(
  bubbleSource,
  /recent_action_evidence_not_completed/u,
  'AgentSessionV2 trace panel should expose incomplete action evidence signals.',
);
assertSourceMatches(
  bubbleSource,
  /repeated_failed_tool_signature/u,
  'AgentSessionV2 trace panel should expose repeated failed tool signature signals.',
);
assertSourceMatches(
  bubbleSource,
  /recent_trace_rejection/u,
  'AgentSessionV2 trace panel should expose trace rejection signals.',
);
assertSourceMatches(
  bubbleSource,
  /Stuck signals/u,
  'AgentSessionV2 trace panel should render stuck signal summaries.',
);
assertSourceMatches(
  bubbleSource,
  /<PetChatAgentSessionV2TracePanel session=\{session\} \/>/u,
  'AgentSessionV2 summary should render the trace panel.',
);

console.log('agent session v2 trace ui smoke ok');
