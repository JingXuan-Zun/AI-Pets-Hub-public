import { formatAgentSessionV2TimingDuration } from './agentMessageProgress';
import { type ChatAgentSessionV2TraceEvent } from './agentMessageTypes';

function stringifyAgentSessionV2TraceValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function stringifyAgentSessionV2TraceDetailValue(key: string, value: unknown) {
  if (key === 'durationMs' && typeof value === 'number') {
    return formatAgentSessionV2TimingDuration(value);
  }

  return stringifyAgentSessionV2TraceValue(value);
}

export function stableAgentSessionV2PanelJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableAgentSessionV2PanelJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableAgentSessionV2PanelJson(record[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function resolveAgentSessionV2TraceTypeText(type: ChatAgentSessionV2TraceEvent['type']) {
  switch (type) {
    case 'approval_required':
      return 'Approval';
    case 'decision_parsed':
      return 'Decision';
    case 'decision_rejected':
      return 'Rejected';
    case 'final_answer':
      return 'Final';
    case 'model_output':
      return 'Model';
    case 'permission_routed':
      return 'Permission';
    case 'runtime_shadow':
      return 'Runtime Shadow';
    case 'trace_compacted':
      return 'Compacted';
    case 'tool_finished':
      return 'Tool done';
    case 'tool_started':
      return 'Tool start';
    default:
      return 'Trace';
  }
}

export function resolveAgentSessionV2TraceClassName(event: ChatAgentSessionV2TraceEvent) {
  const status = event.status ?? '';
  if (
    event.type === 'decision_rejected'
    || /(?:fail|invalid|blocked|rejected|error)/iu.test(status)
  ) {
    return 'border-rose-100 bg-rose-50 text-rose-700';
  }

  if (event.type === 'approval_required' || /approval|pending/iu.test(status)) {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (event.type === 'tool_started' || /running/iu.test(status)) {
    return 'border-border bg-muted text-primary';
  }

  if (event.type === 'runtime_shadow' && status !== 'verified_success') {
    return /failed|blocked|unverified|without_dispatch|no_tool/iu.test(status)
      ? 'border-rose-100 bg-rose-50 text-rose-700'
      : 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (/success|completed|parsed|silent|approved-result/iu.test(status)) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  return 'border-border bg-muted text-muted-foreground';
}

export function resolveAgentSessionV2TraceDetailPairs(event: ChatAgentSessionV2TraceEvent) {
  const details = event.details ?? {};
  const preferredKeys = [
    'classification',
    'state',
    'eventKinds',
    'notes',
    'approvalContinuationReason',
    'approvalContinuationTool',
    'approvalContinuationAllowed',
    'approvalContinuationCount',
    'approvalContinuationLimit',
    'scopeMatched',
    'hardGate',
    'eligibleTool',
    'desktopSafe',
    'totalElapsedMs',
    'slowestToolName',
    'slowestToolDurationMs',
    'actionOutcome',
    'receiptStatus',
    'timingStatus',
    'cacheHit',
    'routeSummary',
    'errorText',
    'responseText',
    'reason',
    'verification',
    'visualActionReadiness',
    'visualActionBlocker',
    'launcherReason',
    'coveredByTool',
    'coverageReason',
    'actionTarget',
    'actionDiff',
    'durationMs',
    'timingDetail',
    'source',
    'compactedEventCount',
    'typeCounts',
  ];

  return preferredKeys
    .map((key) => [key, stringifyAgentSessionV2TraceDetailValue(key, details[key])] as const)
    .filter(([, value]) => value)
    .slice(0, 4);
}
