import {
  advanceAgentTaskRuntimeV4,
  createAgentTaskRuntimeV4ApprovalGrant,
  createAgentTaskRuntimeV4Context,
  createAgentTaskRuntimeV4TaskSpec,
} from './agentTaskRuntimeV4';
import {
  type AgentTaskRuntimeV4Capability,
  type AgentTaskRuntimeV4Context,
  type AgentTaskRuntimeV4Evidence,
  type AgentTaskRuntimeV4TransitionKind,
} from './agentTaskRuntimeV4Contract';
import { hasAgentEffectiveDirectActionIntent } from './runtime/agentActionCoverage';
import { resolveAgentTargetResolutionHints } from './runtime/agentTargetResolutionContext';
import {
  hasAgentRuntimeDesktopDispatch,
  hasAgentRuntimeInputDispatch,
} from './runtime/agentDispatchEvidence';

export type AgentTaskRuntimeV4SessionV2ShadowStatus =
  | 'completed'
  | 'needs-approval'
  | 'needs-user'
  | 'failed'
  | 'cancelled'
  | 'budget-exceeded'
  | 'max-steps'
  | 'unavailable-tool'
  | 'invalid-tool-input'
  | string;

export interface AgentTaskRuntimeV4SessionV2ShadowToolCommand {
  kind?: string | null;
  toolCall?: {
    input?: Record<string, unknown> | null;
    name?: string | null;
  } | null;
}

export interface AgentTaskRuntimeV4SessionV2ShadowToolResult {
  assessment?: {
    status?: string | null;
    summary?: string | null;
  } | null;
  errorText?: string | null;
  ok?: boolean | null;
  receipt?: {
    evidenceLines?: string[] | null;
    stateSummary?: {
      actionEvidence?: unknown;
      structuredEvidence?: unknown;
    } | null;
    status?: string | null;
    summaryLines?: string[] | null;
  } | null;
  responseText?: string | null;
  stateSummary?: {
    actionEvidence?: unknown;
    missingEvidence?: string[] | null;
    recommendedRecovery?: string[] | null;
    structuredEvidence?: unknown;
    verificationEvidence?: string[] | null;
  } | null;
  verification?: string | null;
}

export interface AgentTaskRuntimeV4SessionV2ShadowToolResultEntry {
  command: AgentTaskRuntimeV4SessionV2ShadowToolCommand;
  createdAt?: number | null;
  result: AgentTaskRuntimeV4SessionV2ShadowToolResult;
}

export interface AgentTaskRuntimeV4SessionV2ShadowInput {
  productionLifecycleFacts?: Array<AgentTaskRuntimeV4ProductionLifecycleFact> | null;
  pendingApproval?: {
    command?: AgentTaskRuntimeV4SessionV2ShadowToolCommand | null;
  } | null;
  previousRuntimeShadowEvents?: Array<{
    details?: Record<string, unknown> | null;
    status?: string | null;
    summary?: string | null;
    tool?: string | null;
  }> | null;
  sourceText: string;
  status: AgentTaskRuntimeV4SessionV2ShadowStatus;
  taskId?: string | null;
  toolResults: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry[];
  userGoal?: string | null;
}

export interface AgentTaskRuntimeV4ProductionLifecycleFact {
    kind: string;
    tool?: string | null;
}

export type AgentTaskRuntimeV4SessionV2ShadowClassification =
  | 'no_tool_evidence'
  | 'read_only_observation_only'
  | 'target_resolved_waiting_approval'
  | 'target_resolved_without_dispatch'
  | 'outer_dispatch_only'
  | 'approval_pending'
  | 'input_dispatched_collecting_evidence'
  | 'input_dispatched_unverified'
  | 'verified_success'
  | 'blocked_needs_user'
  | 'failed'
  | 'unknown';

export interface AgentTaskRuntimeV4SessionV2ShadowEvent {
  accepted: boolean;
  kind: AgentTaskRuntimeV4TransitionKind;
  reason?: string | null;
  stateAfter: string;
}

export interface AgentTaskRuntimeV4SessionV2ShadowResult {
  classification: AgentTaskRuntimeV4SessionV2ShadowClassification;
  context: AgentTaskRuntimeV4Context;
  events: AgentTaskRuntimeV4SessionV2ShadowEvent[];
  notes: string[];
}

const AGENT_TASK_RUNTIME_V4_SESSION_V2_READ_ONLY_TOOLS = new Set([
  'observe_windows_and_apps',
  'execute_desktop_observation',
  'locate_screen_elements',
  'get_active_window_info',
  'list_capture_sources',
  'summarize_visual_snapshot',
  'get_cursor_position',
  'get_system_info',
  'get_display_info',
  'inspect_window_ui',
]);

const AGENT_TASK_RUNTIME_V4_SESSION_V2_DISPATCH_TOOLS = new Set([
  'execute_desktop_input',
  'execute_desktop_sequence',
  'execute_desktop_action',
  'launch_local_app',
  'open_resource',
  'focus_window',
  'close_window',
]);

function getAgentTaskRuntimeV4ShadowToolName(
  entryOrCommand: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry | AgentTaskRuntimeV4SessionV2ShadowToolCommand | null | undefined,
) {
  if (!entryOrCommand) {
    return '';
  }

  if ('command' in entryOrCommand) {
    return entryOrCommand.command.toolCall?.name?.trim() || entryOrCommand.command.kind?.trim() || '';
  }

  return entryOrCommand.toolCall?.name?.trim() || entryOrCommand.kind?.trim() || '';
}

function getAgentTaskRuntimeV4ShadowApprovalContinuationNote(
  input: AgentTaskRuntimeV4SessionV2ShadowInput,
) {
  const event = [...(input.previousRuntimeShadowEvents ?? [])]
    .reverse()
    .find((candidate) => candidate.status === 'approval_continuation_not_consumed') ?? null;
  const reason = typeof event?.details?.approvalContinuationReason === 'string'
    ? event.details.approvalContinuationReason
    : null;
  const tool = typeof event?.details?.approvalContinuationTool === 'string'
    ? event.details.approvalContinuationTool
    : event?.tool ?? null;
  if (!event && !reason && !tool) {
    return null;
  }

  return [
    'previousApprovalContinuationNotConsumed=true',
    reason ? `approvalContinuationReason=${reason}` : '',
    tool ? `approvalContinuationTool=${tool}` : '',
  ].filter(Boolean).join(' | ');
}

function getAgentTaskRuntimeV4ShadowStructuredEvidence(
  entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry | null | undefined,
) {
  if (!entry) {
    return null;
  }

  const evidence = entry.result.stateSummary?.structuredEvidence
    ?? entry.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  return evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    ? evidence as Record<string, unknown>
    : null;
}

function getAgentTaskRuntimeV4ShadowActionEvidence(entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry) {
  return entry.result.stateSummary?.actionEvidence
    ?? entry.result.receipt?.stateSummary?.actionEvidence
    ?? null;
}

function getAgentTaskRuntimeV4ShadowString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getAgentTaskRuntimeV4ShadowPostActionState(entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry) {
  return getAgentTaskRuntimeV4ShadowString(
    getAgentTaskRuntimeV4ShadowStructuredEvidence(entry)?.postActionState,
  ).toLowerCase();
}

function isAgentTaskRuntimeV4ShadowInAppTask(input: AgentTaskRuntimeV4SessionV2ShadowInput) {
  const text = `${input.sourceText} ${input.userGoal ?? ''}`.normalize('NFKC').toLowerCase();
  return Boolean(resolveAgentTargetResolutionHints(input.sourceText, input.userGoal ?? ''))
    || /(?:\b(?:inside|within|in-app|in|from|via|through)\b.{0,100}(?:\b(?:app|application|client|window|panel)\b|\S+)|(?:在|从|從).{0,100}(?:应用|程序|窗口|面板|里|里面|内|中)|\binside\s+the\s+current\b)/iu.test(text);
}

function isAgentTaskRuntimeV4ShadowTerminalStatus(status: AgentTaskRuntimeV4SessionV2ShadowStatus) {
  return status === 'completed';
}

function hasAgentTaskRuntimeV4ShadowTargetResolved(entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry) {
  const structuredEvidence = getAgentTaskRuntimeV4ShadowStructuredEvidence(entry);
  if (!structuredEvidence) {
    return false;
  }

  const input = entry.command.toolCall?.input ?? {};
  const explicitTargetQuery = [
    input.targetText,
    input.targetDescription,
    input.query,
    input.sourceQuery,
    input.windowQuery,
    input.windowTitle,
  ].some((value) => getAgentTaskRuntimeV4ShadowString(value));
  const readiness = getAgentTaskRuntimeV4ShadowString(structuredEvidence.visualActionReadiness).toLowerCase();
  const targetInteractionVerification = (
    structuredEvidence.targetInteractionVerification
      ?? structuredEvidence.launcherVerification
  ) as Record<string, unknown> | null | undefined;
  const targetInteractionStatus = getAgentTaskRuntimeV4ShadowString(
    targetInteractionVerification?.status,
  ).toLowerCase();

  return Boolean(
    readiness === 'ready'
      || targetInteractionStatus === 'ready'
      || (explicitTargetQuery && getAgentTaskRuntimeV4ShadowString(structuredEvidence.targetMatched))
      || structuredEvidence.elementCenter
      || structuredEvidence.elementCenterRatio
      || structuredEvidence.elementBounds,
  );
}

function isAgentTaskRuntimeV4ShadowInAppLocate(entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry) {
  if (getAgentTaskRuntimeV4ShadowToolName(entry) !== 'locate_screen_elements') {
    return false;
  }

  const input = entry.command.toolCall?.input ?? {};
  const text = [
    input.question,
    input.targetText,
    input.targetDescription,
    input.sourceQuery,
  ].map(getAgentTaskRuntimeV4ShadowString).join(' ').toLowerCase();
  const hasOuterSource = Boolean(
    getAgentTaskRuntimeV4ShadowString(input.sourceQuery)
      || getAgentTaskRuntimeV4ShadowString(input.windowQuery)
      || getAgentTaskRuntimeV4ShadowString(input.windowTitle),
  );
  const hasInnerTarget = Boolean(
    getAgentTaskRuntimeV4ShadowString(input.targetText)
      || getAgentTaskRuntimeV4ShadowString(input.targetDescription),
  );
  return (hasOuterSource && hasInnerTarget)
    || /(?:agentsessionv2 in-app target locate|\bin-app\b|\binside\b|\bwithin\b|\bfrom\b|\bvia\b|(?:在|从|從).{0,100}(?:应用|程序|窗口|里面|内|中))/iu.test(text);
}

function createAgentTaskRuntimeV4ShadowNoInAppDispatchNotes(options: {
  anyDispatchEntry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry | null;
  inAppTask: boolean;
  targetEntry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry | null;
  toolResults: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry[];
  verifiedEntry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry | null;
}) {
  const latestInAppLocate = [...options.toolResults].reverse().find(isAgentTaskRuntimeV4ShadowInAppLocate) ?? null;
  const latestTargetEvidence = getAgentTaskRuntimeV4ShadowStructuredEvidence(options.targetEntry);
  const latestLocateEvidence = getAgentTaskRuntimeV4ShadowStructuredEvidence(latestInAppLocate);
  return [
    options.verifiedEntry
      ? 'Verified-looking evidence was found, but no dispatch-capable SessionV2 tool result was found.'
      : options.anyDispatchEntry && options.inAppTask
        ? `Only outer-app dispatch was found (${getAgentTaskRuntimeV4ShadowToolName(options.anyDispatchEntry)}); no in-app dispatch/click was executed.`
        : options.inAppTask
          ? 'Target was resolved, but no in-app dispatch-capable SessionV2 tool result was found.'
          : 'Target was resolved, but no dispatch-capable SessionV2 tool result was found.',
    `inAppLocateSeen=${latestInAppLocate ? 'true' : 'false'}`,
    latestInAppLocate ? `inAppLocateTool=${getAgentTaskRuntimeV4ShadowToolName(latestInAppLocate)}` : '',
    latestLocateEvidence?.visualActionReadiness
      ? `inAppLocateReadiness=${latestLocateEvidence.visualActionReadiness}` : '',
    latestLocateEvidence?.targetMatched
      ? `inAppLocateTarget=${latestLocateEvidence.targetMatched}` : '',
    latestLocateEvidence?.primaryAction
      ? `inAppLocatePrimaryAction=${latestLocateEvidence.primaryAction}` : '',
    latestTargetEvidence?.visualActionReadiness
      ? `targetReadiness=${latestTargetEvidence.visualActionReadiness}` : '',
    latestTargetEvidence?.targetMatched
      ? `targetMatched=${latestTargetEvidence.targetMatched}` : '',
  ].filter(Boolean);
}

function hasAgentTaskRuntimeV4ShadowVerifiedSuccess(entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry) {
  const toolName = getAgentTaskRuntimeV4ShadowToolName(entry);
  const structuredEvidence = getAgentTaskRuntimeV4ShadowStructuredEvidence(entry);
  const postActionState = getAgentTaskRuntimeV4ShadowPostActionState(entry);
  if (postActionState === 'launched') {
    return entry.result.ok !== false;
  }

  if (postActionState === 'completed') {
    return entry.result.ok !== false
      && getAgentTaskRuntimeV4ShadowString(entry.result.receipt?.status).toLowerCase() === 'success';
  }

  if (toolName === 'locate_screen_elements' || toolName === 'execute_desktop_observation') {
    return false;
  }

  const statusText = [
    entry.result.assessment?.status,
    entry.result.receipt?.status,
    structuredEvidence?.status,
    getAgentTaskRuntimeV4ShadowPostActionState(entry),
  ].map(getAgentTaskRuntimeV4ShadowString).join(' ').toLowerCase();
  const verificationText = [
    entry.result.verification,
    entry.result.responseText,
    ...(entry.result.stateSummary?.verificationEvidence ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []),
  ].map(getAgentTaskRuntimeV4ShadowString).join(' ').toLowerCase();

  return entry.result.ok !== false
    && !/(?:unverified|unchanged|unknown|failed|blocked|error|needs[-_\s]user)/u.test(statusText)
    && (
      /(?:completed|satisfied|launched)/u.test(statusText)
      || /(?:verified|confirmed|launched|started|opened|\u5df2|\u6210\u529f)/u.test(verificationText)
    );
}

function hasAgentTaskRuntimeV4ShadowDispatch(
  entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry,
  options: {
    inAppTask?: boolean;
  } = {},
) {
  const toolName = getAgentTaskRuntimeV4ShadowToolName(entry);
  if (!AGENT_TASK_RUNTIME_V4_SESSION_V2_DISPATCH_TOOLS.has(toolName)) {
    return false;
  }

  if (options.inAppTask && (toolName === 'launch_local_app' || toolName === 'open_resource' || toolName === 'focus_window')) {
    return false;
  }

  if (options.inAppTask) {
    return hasAgentRuntimeInputDispatch(entry.command)
      && !/(?:launch|open|focus)\b/iu.test(
        getAgentTaskRuntimeV4ShadowString(entry.command.toolCall?.input?.action),
      );
  }

  return hasAgentRuntimeDesktopDispatch(entry.command);
}

function hasAgentTaskRuntimeV4ShadowOnlyReadOnly(entries: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry[]) {
  return entries.length > 0
    && entries.every((entry) => AGENT_TASK_RUNTIME_V4_SESSION_V2_READ_ONLY_TOOLS.has(
      getAgentTaskRuntimeV4ShadowToolName(entry),
    ));
}

function createAgentTaskRuntimeV4ShadowEvidence(
  entry: AgentTaskRuntimeV4SessionV2ShadowToolResultEntry,
): AgentTaskRuntimeV4Evidence {
  const toolName = getAgentTaskRuntimeV4ShadowToolName(entry) || 'unknown';
  const structuredEvidence = getAgentTaskRuntimeV4ShadowStructuredEvidence(entry);
  const summary = [
    `tool=${toolName}`,
    entry.result.ok === false ? 'ok=false' : 'ok=true',
    getAgentTaskRuntimeV4ShadowString(entry.result.receipt?.status)
      ? `receipt=${entry.result.receipt?.status}` : '',
    getAgentTaskRuntimeV4ShadowString(entry.result.assessment?.status)
      ? `assessment=${entry.result.assessment?.status}` : '',
    getAgentTaskRuntimeV4ShadowString(structuredEvidence?.visualActionReadiness)
      ? `visualActionReadiness=${structuredEvidence?.visualActionReadiness}` : '',
    getAgentTaskRuntimeV4ShadowString(structuredEvidence?.postActionState)
      ? `postActionState=${structuredEvidence?.postActionState}` : '',
    getAgentTaskRuntimeV4ShadowString(entry.result.errorText)
      ? `error=${entry.result.errorText}` : '',
  ].filter(Boolean).join(' | ');

  return {
    kind: hasAgentTaskRuntimeV4ShadowDispatch(entry)
      ? 'input'
      : hasAgentTaskRuntimeV4ShadowTargetResolved(entry)
        ? 'visual'
        : 'system',
    source: toolName,
    summary,
    timestampMs: entry.createdAt ?? Date.now(),
    verified: hasAgentTaskRuntimeV4ShadowVerifiedSuccess(entry) ? true : null,
  };
}

function inferAgentTaskRuntimeV4CapabilitiesFromCommand(
  command: AgentTaskRuntimeV4SessionV2ShadowToolCommand | null | undefined,
): AgentTaskRuntimeV4Capability[] {
  const toolName = getAgentTaskRuntimeV4ShadowToolName(command);
  const input = command?.toolCall?.input ?? {};
  const action = getAgentTaskRuntimeV4ShadowString(input.action).toLowerCase();

  if (toolName === 'execute_desktop_input') {
    return ['mouse', 'keyboard'];
  }

  if (toolName === 'execute_desktop_sequence') {
    return ['mouse', 'keyboard', 'launch'];
  }

  if (toolName === 'launch_local_app' || toolName === 'open_resource') {
    return ['launch'];
  }

  if (toolName === 'focus_window') {
    return ['focus'];
  }

  if (toolName === 'close_window') {
    return ['close'];
  }

  if (toolName === 'execute_desktop_action') {
    if (/focus/u.test(action)) {
      return ['focus'];
    }
    if (/(?:launch|open)/u.test(action)) {
      return ['launch'];
    }
    if (/close/u.test(action)) {
      return ['close'];
    }
    if (/(?:move|control|resize|maximi[sz]e|minimi[sz]e|restore|snap)/u.test(action)) {
      return ['window_control'];
    }
    if (/(?:click|interact|invoke|type|send|hotkey|drag)/u.test(action)) {
      return ['mouse', 'keyboard'];
    }
  }

  return [];
}

function applyAgentTaskRuntimeV4ShadowEvent(
  context: AgentTaskRuntimeV4Context,
  event: Parameters<typeof advanceAgentTaskRuntimeV4>[1],
  events: AgentTaskRuntimeV4SessionV2ShadowEvent[],
) {
  const result = advanceAgentTaskRuntimeV4(context, event);
  if ('reason' in result) {
    events.push({
      accepted: false,
      kind: event.kind,
      reason: result.reason,
      stateAfter: result.context.currentState,
    });
    return result.context;
  }

  events.push({
    accepted: true,
    kind: event.kind,
    reason: event.reason ?? null,
    stateAfter: result.context.currentState,
  });
  return result.context;
}

export function createAgentTaskRuntimeV4SessionV2Shadow(
  input: AgentTaskRuntimeV4SessionV2ShadowInput,
): AgentTaskRuntimeV4SessionV2ShadowResult {
  const task = createAgentTaskRuntimeV4TaskSpec({
    constraints: [],
    goal: input.userGoal?.trim() || input.sourceText,
    id: input.taskId?.trim() || `session-v2-shadow:${input.sourceText.slice(0, 80)}`,
    intent: input.sourceText,
    target: null,
  });
  let context = createAgentTaskRuntimeV4Context({ task });
  const events: AgentTaskRuntimeV4SessionV2ShadowEvent[] = [];
  const notes: string[] = [];
  const inAppTask = isAgentTaskRuntimeV4ShadowInAppTask(input);
  const pendingApprovalToolName = getAgentTaskRuntimeV4ShadowToolName(input.pendingApproval?.command);
  const approvalContinuationNote = getAgentTaskRuntimeV4ShadowApprovalContinuationNote(input);
  const productionLifecycleFacts = input.productionLifecycleFacts ?? [];

  if (productionLifecycleFacts.length) {
    const hasProductionDispatch = productionLifecycleFacts.some((fact) => fact.kind === 'action-dispatched');
    let latestProductionDispatchIndex = -1;
    for (let index = productionLifecycleFacts.length - 1; index >= 0; index -= 1) {
      if (productionLifecycleFacts[index]?.kind === 'action-dispatched') {
        latestProductionDispatchIndex = index;
        break;
      }
    }
    const hasProductionVerification = productionLifecycleFacts.some((fact, index) => (
      fact.kind === 'outcome-verified' && index > latestProductionDispatchIndex
    ));
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'task-runtime',
      kind: 'start',
      reason: 'Shadow projected committed production lifecycle facts.',
    }, events);
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'task-runtime',
      evidence: {
        kind: 'system',
        source: 'production-runtime',
        summary: 'Production Runtime committed lifecycle facts for this task.',
        timestampMs: Date.now(),
        verified: null,
      },
      kind: 'observation-collected',
      reason: 'Shadow projected the production lifecycle baseline.',
    }, events);
    if (input.status === 'needs-approval' || input.pendingApproval) {
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'target-resolver',
        kind: 'target-resolved',
        reason: 'Production Runtime has a pending approval with a resolvable task target.',
      }, events);
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'approval-manager',
        kind: 'approval-required',
        reason: 'Production Runtime committed a pending approval after lifecycle projection.',
      }, events);
      return {
        classification: 'approval_pending',
        context,
        events,
        notes: ['Classification used production lifecycle facts and preserved the current pending approval state.'],
      };
    }
    if (hasProductionDispatch) {
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'target-resolver',
        kind: 'target-resolved',
        reason: 'Production Runtime committed input dispatch, so its target was resolved.',
      }, events);
      const grant = createAgentTaskRuntimeV4ApprovalGrant({
        capabilities: ['mouse'],
        taskId: task.id,
      });
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'approval-manager',
        approvalGrant: grant,
        capabilities: grant.capabilities,
        kind: 'approval-granted',
        reason: 'Production Runtime committed approval before input dispatch.',
        stepId: grant.stepId,
      }, events);
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'action-executor',
        capabilities: grant.capabilities,
        evidence: {
          kind: 'input',
          source: 'production-runtime',
          summary: 'Production Runtime committed real input dispatch.',
          timestampMs: Date.now(),
          verified: null,
        },
        kind: 'action-dispatched',
        reason: 'Shadow projected the committed production input dispatch.',
        stepId: grant.stepId,
      }, events);
    }
    if (input.status === 'completed' && hasProductionDispatch && hasProductionVerification) {
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'evidence-engine',
        evidence: {
          kind: 'system',
          source: 'production-runtime',
          summary: 'Production Runtime committed outcome verification.',
          timestampMs: Date.now(),
          verified: true,
        },
        kind: 'evidence-collected',
        reason: 'Shadow projected committed production verification evidence.',
      }, events);
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'evidence-engine',
        kind: 'outcome-verified',
        reason: 'Shadow projected committed production outcome verification.',
      }, events);
      return {
        classification: 'verified_success',
        context,
        events,
        notes: ['Classification used production lifecycle facts: dispatch and verification were both committed.'],
      };
    }
    if (hasProductionDispatch) {
      return {
        classification: 'input_dispatched_unverified',
        context,
        events,
        notes: ['Classification used production lifecycle facts: real input dispatch was committed without verified outcome.'],
      };
    }
    if (inAppTask && productionLifecycleFacts.some((fact) => fact.kind === 'outer-dispatch')) {
      return {
        classification: 'outer_dispatch_only',
        context,
        events,
        notes: ['Classification used production lifecycle facts: only the outer operation was committed.'],
      };
    }
  }

  if (!input.toolResults.length) {
    if (input.status === 'needs-approval' || input.pendingApproval) {
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'task-runtime',
        kind: 'start',
        reason: 'SessionV2 shadow observed a task run waiting for approval.',
      }, events);
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'task-runtime',
        evidence: {
          kind: 'system',
          source: 'session-v2',
          summary: 'SessionV2 is waiting for approval without prior tool evidence in this result.',
          timestampMs: Date.now(),
          verified: null,
        },
        kind: 'observation-collected',
        reason: 'SessionV2 shadow collected pending approval state.',
      }, events);
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'target-resolver',
        kind: 'target-resolved',
        reason: 'SessionV2 prepared an approval command, so the target/action is treated as resolved for shadow diagnostics.',
      }, events);
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'approval-manager',
        kind: 'approval-required',
        reason: 'SessionV2 returned pending approval.',
      }, events);

      return {
        classification: 'approval_pending',
        context,
        events,
        notes: [
          'SessionV2 returned pending approval without committed tool results.',
          'approvalStage=initial',
          'priorToolEvidence=false',
          pendingApprovalToolName ? `pendingApprovalTool=${pendingApprovalToolName}` : '',
          approvalContinuationNote ?? '',
        ].filter(Boolean),
      };
    }

    return {
      classification: 'no_tool_evidence',
      context,
      events,
      notes: ['No SessionV2 tool results were available for shadow mapping.'],
    };
  }

  context = applyAgentTaskRuntimeV4ShadowEvent(context, {
    actor: 'task-runtime',
    kind: 'start',
    reason: 'SessionV2 shadow observed a task run.',
  }, events);

  const firstEvidence = createAgentTaskRuntimeV4ShadowEvidence(input.toolResults[0]);
  context = applyAgentTaskRuntimeV4ShadowEvent(context, {
    actor: 'task-runtime',
    evidence: firstEvidence,
    kind: 'observation-collected',
    reason: 'SessionV2 shadow collected tool evidence.',
  }, events);

  const completedReadOnlyObservation = input.status === 'completed'
    && hasAgentTaskRuntimeV4ShadowOnlyReadOnly(input.toolResults)
    && input.toolResults.every((entry) => entry.result.ok !== false)
    && !input.toolResults.some(hasAgentTaskRuntimeV4ShadowTargetResolved)
    && !hasAgentEffectiveDirectActionIntent(input.sourceText, input.userGoal ?? '');
  if (completedReadOnlyObservation) {
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'evidence-engine',
      evidence: createAgentTaskRuntimeV4ShadowEvidence(input.toolResults[input.toolResults.length - 1]),
      kind: 'evidence-collected',
      reason: 'Successful read-only observation produced evidence for verification.',
    }, events);
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'evidence-engine',
      evidence: createAgentTaskRuntimeV4ShadowEvidence(input.toolResults[input.toolResults.length - 1]),
      kind: 'outcome-verified',
      reason: 'Successful read-only evidence satisfies a read-only task without dispatch.',
    }, events);
    return {
      classification: 'verified_success',
      context,
      events,
      notes: ['Read-only task completed from successful observation; no dispatch was required.'],
    };
  }

  const targetEntry = [...input.toolResults].reverse().find(hasAgentTaskRuntimeV4ShadowTargetResolved) ?? null;
  const anyDispatchEntry = [...input.toolResults].reverse().find((entry) => hasAgentTaskRuntimeV4ShadowDispatch(entry)) ?? null;
  const dispatchEntry = [...input.toolResults].reverse().find((entry) => hasAgentTaskRuntimeV4ShadowDispatch(entry, {
    inAppTask,
  })) ?? null;
  const targetIndex = targetEntry ? input.toolResults.indexOf(targetEntry) : -1;
  const dispatchIndex = dispatchEntry ? input.toolResults.indexOf(dispatchEntry) : -1;
  const verifiedEntry = isAgentTaskRuntimeV4ShadowTerminalStatus(input.status) && dispatchIndex >= 0
    ? [...input.toolResults.slice(dispatchIndex)].reverse().find(hasAgentTaskRuntimeV4ShadowVerifiedSuccess) ?? null
    : null;
  const verifiedIndex = verifiedEntry ? input.toolResults.indexOf(verifiedEntry) : -1;
  const failedEntry = [...input.toolResults].reverse().find((entry) => entry.result.ok === false) ?? null;
  const failedIndex = failedEntry ? input.toolResults.indexOf(failedEntry) : -1;
  const terminalFailureEntry = failedEntry
    && failedIndex >= Math.max(targetIndex, dispatchIndex)
    && failedIndex > verifiedIndex
    ? failedEntry
    : null;

  if (failedEntry && !targetEntry && !dispatchEntry && !verifiedEntry) {
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'target-resolver',
      blocker: failedEntry.result.errorText ?? 'SessionV2 tool failed before target resolution.',
      kind: 'target-not-resolved',
      reason: 'SessionV2 shadow saw failure before target resolution.',
    }, events);
    return {
      classification: 'failed',
      context,
      events,
      notes,
    };
  }

  if (!targetEntry && !dispatchEntry && !verifiedEntry) {
    if (anyDispatchEntry && inAppTask) {
      return {
        classification: 'outer_dispatch_only',
        context,
        events,
        notes: createAgentTaskRuntimeV4ShadowNoInAppDispatchNotes({
          anyDispatchEntry,
          inAppTask,
          targetEntry,
          toolResults: input.toolResults,
          verifiedEntry,
        }),
      };
    }
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'target-resolver',
      blocker: hasAgentTaskRuntimeV4ShadowOnlyReadOnly(input.toolResults)
        ? 'read-only observation only'
        : 'target not resolved',
      kind: 'target-not-resolved',
      reason: 'SessionV2 shadow did not find target-ready evidence.',
    }, events);

    return {
      classification: hasAgentTaskRuntimeV4ShadowOnlyReadOnly(input.toolResults)
        ? 'read_only_observation_only'
        : 'unknown',
      context,
      events,
      notes,
    };
  }

  context = applyAgentTaskRuntimeV4ShadowEvent(context, {
    actor: 'target-resolver',
    evidence: targetEntry ? createAgentTaskRuntimeV4ShadowEvidence(targetEntry) : null,
    kind: 'target-resolved',
    reason: targetEntry
      ? 'SessionV2 shadow found target-ready evidence.'
      : 'SessionV2 shadow inferred target resolution from dispatch or verified evidence.',
    targetSummary: targetEntry ? getAgentTaskRuntimeV4ShadowToolName(targetEntry) : null,
  }, events);

  if (input.status === 'needs-approval' || input.pendingApproval) {
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'approval-manager',
      kind: 'approval-required',
      reason: 'SessionV2 returned pending approval.',
    }, events);

    return {
      classification: 'approval_pending',
      context,
      events,
      notes: [
        ...notes,
        'approvalStage=after-evidence',
        'priorToolEvidence=true',
        pendingApprovalToolName ? `pendingApprovalTool=${pendingApprovalToolName}` : '',
        approvalContinuationNote ?? '',
      ],
    };
  }

  if (!dispatchEntry) {
    if (terminalFailureEntry) {
      context = applyAgentTaskRuntimeV4ShadowEvent(context, {
        actor: 'task-runtime',
        blocker: terminalFailureEntry.result.errorText ?? 'SessionV2 tool failed after target resolution.',
        evidence: createAgentTaskRuntimeV4ShadowEvidence(terminalFailureEntry),
        kind: 'fatal-failure',
        reason: 'SessionV2 shadow found terminal failure after target resolution.',
      }, events);
      return {
        classification: 'failed',
        context,
        events,
        notes: [...notes, 'Terminal tool failure occurred after target resolution.'],
      };
    }

    return {
      classification: anyDispatchEntry && inAppTask
        ? 'outer_dispatch_only'
        : 'target_resolved_without_dispatch',
      context,
      events,
      notes: createAgentTaskRuntimeV4ShadowNoInAppDispatchNotes({
        anyDispatchEntry,
        inAppTask,
        targetEntry,
        toolResults: input.toolResults,
        verifiedEntry,
      }),
    };
  }

  const capabilities = inferAgentTaskRuntimeV4CapabilitiesFromCommand(dispatchEntry?.command);
  const grant = createAgentTaskRuntimeV4ApprovalGrant({
    capabilities: capabilities.length ? capabilities : ['mouse'],
    taskId: task.id,
  });
  context = applyAgentTaskRuntimeV4ShadowEvent(context, {
    actor: 'approval-manager',
    approvalGrant: grant,
    capabilities: grant.capabilities,
    kind: 'approval-granted',
    reason: 'SessionV2 shadow assumes approval had already been granted for observed dispatch.',
    stepId: grant.stepId,
  }, events);

  if (dispatchEntry) {
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'action-executor',
      capabilities: grant.capabilities,
      evidence: createAgentTaskRuntimeV4ShadowEvidence(dispatchEntry),
      kind: 'action-dispatched',
      reason: 'SessionV2 shadow found dispatch-capable tool result.',
      stepId: grant.stepId,
    }, events);
  }

  if (terminalFailureEntry) {
    context = applyAgentTaskRuntimeV4ShadowEvent(context, {
      actor: 'task-runtime',
      blocker: terminalFailureEntry.result.errorText ?? 'SessionV2 tool failed after dispatch.',
      evidence: createAgentTaskRuntimeV4ShadowEvidence(terminalFailureEntry),
      kind: 'fatal-failure',
      reason: 'SessionV2 shadow found terminal failure after the latest dispatch.',
    }, events);
    return {
      classification: 'failed',
      context,
      events,
      notes: [...notes, 'Terminal tool failure occurred after the latest dispatch.'],
    };
  }

  if (!verifiedEntry) {
    return {
      classification: dispatchEntry ? 'input_dispatched_unverified' : 'input_dispatched_collecting_evidence',
      context,
      events,
      notes: ['Dispatch was observed, but verified outcome evidence was not found.'],
    };
  }

  context = applyAgentTaskRuntimeV4ShadowEvent(context, {
    actor: 'evidence-engine',
    evidence: createAgentTaskRuntimeV4ShadowEvidence(verifiedEntry),
    kind: 'evidence-collected',
    reason: 'SessionV2 shadow found verification evidence.',
  }, events);
  context = applyAgentTaskRuntimeV4ShadowEvent(context, {
    actor: 'evidence-engine',
    kind: 'outcome-verified',
    reason: 'SessionV2 shadow mapped verified evidence to V4 success.',
  }, events);

  return {
    classification: 'verified_success',
    context,
    events,
    notes,
  };
}
