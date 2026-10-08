import {
  type AgentChatCommandResult,
  type AgentDesktopActionEvidence,
  type AgentDesktopActionOutcome,
  type AgentDesktopActionTargetRef,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import {
  type AgentInputReplayPreview,
} from '../agentCaptureQuality';

export function annotateDesktopActionResult(
  action: string,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const actionEvidence = result.stateSummary?.actionEvidence
    ?? result.receipt?.stateSummary?.actionEvidence
    ?? createGenericDesktopActionEvidence(action, result);
  const stateSummary = actionEvidence
    ? {
        ...(result.stateSummary ?? {}),
        actionEvidence,
      }
    : result.stateSummary;
  const receipt = result.receipt && actionEvidence
    ? {
        ...result.receipt,
        stateSummary: {
          ...(result.receipt.stateSummary ?? {}),
          actionEvidence,
        },
      }
    : result.receipt;

  return {
    ...result,
    observations: [
      `Desktop action: ${action}`,
      ...(result.observations ?? []),
    ],
    receipt,
    stateSummary,
  };
}

const AGENT_DESKTOP_ACTION_EVIDENCE_ACTIONS = new Set([
  'close_window',
  'control_window',
  'focus_window',
  'interact_window_ui',
  'invoke_window_ui',
  'launch_local_app',
  'move_window_to_display',
  'open_or_focus_then_control_window',
  'open_or_focus_then_move_window_to_display',
  'open_resource',
  'search_web',
]);

function clampAgentDesktopActionConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function getAgentDesktopActionEvidenceConfidence(outcome: AgentDesktopActionOutcome) {
  switch (outcome) {
    case 'changed':
      return 0.72;
    case 'no-op':
      return 0.68;
    case 'blocked':
      return 0.76;
    case 'uncertain':
    default:
      return 0.38;
  }
}

function resolveAgentDesktopActionOutcomeFromResult(
  result: AgentChatCommandResult,
): AgentDesktopActionOutcome {
  if (result.ok === false || result.receipt?.status === 'blocked' || result.receipt?.status === 'failed') {
    return 'blocked';
  }

  if (
    result.receipt?.status === 'unverified'
    || result.assessment?.status === 'unverified'
    || Boolean(result.stateSummary?.missingEvidence?.length)
  ) {
    return 'uncertain';
  }

  return 'changed';
}

function createDesktopActionTargetRefFromStructuredEvidence(
  action: string,
  structuredEvidence: AgentStructuredToolEvidence | null | undefined,
): AgentDesktopActionTargetRef | null {
  const finalWindow = structuredEvidence?.finalWindow ?? null;
  const firstTarget = structuredEvidence?.targetCandidates?.[0] ?? null;
  const label = structuredEvidence?.targetMatched
    || firstTarget?.label
    || finalWindow?.title
    || finalWindow?.processName
    || '';
  if (!label) {
    return null;
  }

  const kind: AgentDesktopActionTargetRef['kind'] = action === 'interact_window_ui' || action === 'invoke_window_ui'
    ? 'uia'
    : finalWindow
      ? 'window'
      : 'app';
  const stableId = [
    firstTarget?.automationId,
    firstTarget?.controlType,
    finalWindow?.hwnd,
    finalWindow?.pid,
  ].filter((value) => value !== undefined && value !== null && String(value).trim()).join(':');

  return {
    bounds: firstTarget?.bounds ?? finalWindow?.bounds ?? null,
    confidence: structuredEvidence?.confidence ?? firstTarget?.confidence ?? 'medium',
    kind,
    label,
    stableId: stableId || null,
  };
}

function createGenericDesktopActionEvidence(
  action: string,
  result: AgentChatCommandResult,
): AgentDesktopActionEvidence | null {
  if (!AGENT_DESKTOP_ACTION_EVIDENCE_ACTIONS.has(action)) {
    return null;
  }

  const structuredEvidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const outcome = resolveAgentDesktopActionOutcomeFromResult(result);
  const targetRef = createDesktopActionTargetRefFromStructuredEvidence(action, structuredEvidence);
  const observedState = [
    ...(result.stateSummary?.observedState ?? []),
    ...(result.observations ?? []),
  ].slice(0, 12);
  const changed = outcome === 'changed'
    ? true
    : outcome === 'no-op'
      ? false
      : null;

  return {
    action,
    after: observedState.length || structuredEvidence?.finalWindow
      ? {
          observedState,
          targetWindow: structuredEvidence?.finalWindow ?? null,
        }
      : null,
    confidence: getAgentDesktopActionEvidenceConfidence(outcome),
    diff: {
      changed,
      signals: [
        result.receipt?.status ? `receipt=${result.receipt.status}` : '',
        result.assessment?.status ? `assessment=${result.assessment.status}` : '',
        structuredEvidence?.status ? `structuredStatus=${structuredEvidence.status}` : '',
      ].filter(Boolean),
      summary: outcome === 'changed'
        ? 'Desktop action completed with available runtime evidence.'
        : outcome === 'blocked'
          ? 'Desktop action was blocked or failed before a verified state change.'
          : 'Desktop action completed, but runtime evidence did not verify a state change.',
    },
    phase: outcome === 'changed' ? 'confirmed' : outcome === 'blocked' ? undefined : 'dispatched',
    outcome,
    snapshotProfile: 'light',
    targetRef,
    timestamp: Date.now(),
    tool: 'execute_desktop_action',
  };
}

function createDesktopInputTargetRef(options: {
  action: string;
  point: { x: number; y: number } | null;
  preview?: AgentInputReplayPreview | null;
}): AgentDesktopActionTargetRef | null {
  if (!options.point) {
    return null;
  }

  const auditStatus = options.preview?.coordinateClosureStatus
    ?? options.preview?.coordinateAudit?.status
    ?? null;
  return {
    confidence: auditStatus && auditStatus !== 'coordinate_closure_ok' && auditStatus !== 'coordinate_ok'
      ? 'low'
      : 'medium',
    kind: 'pixel',
    label: `${options.action} at ${options.point.x},${options.point.y}`,
    stableId: `screen:${options.point.x}:${options.point.y}`,
  };
}

function resolveDesktopInputActionOutcome(options: {
  action: string;
  ok: boolean;
  preview?: AgentInputReplayPreview | null;
  replayExpected: boolean;
  replayMissingEvidence: string[];
}): AgentDesktopActionOutcome {
  if (!options.ok) {
    return 'blocked';
  }

  if (options.preview?.uiChanged === true) {
    return 'changed';
  }

  if (options.preview?.uiChanged === false) {
    return 'no-op';
  }

  if (options.replayExpected || options.replayMissingEvidence.length) {
    return 'uncertain';
  }

  return 'uncertain';
}

export function createDesktopInputActionEvidence(options: {
  action: string;
  ok: boolean;
  point: { x: number; y: number } | null;
  preview?: AgentInputReplayPreview | null;
  replayExpected: boolean;
  replayLines: string[];
  replayMissingEvidence: string[];
}): AgentDesktopActionEvidence {
  const outcome = resolveDesktopInputActionOutcome({
    action: options.action,
    ok: options.ok,
    preview: options.preview,
    replayExpected: options.replayExpected,
    replayMissingEvidence: options.replayMissingEvidence,
  });
  const changed = outcome === 'changed'
    ? true
    : outcome === 'no-op'
      ? false
      : null;
  const beforeCaptureStatus = options.preview?.beforeCaptureStatus ?? null;
  const afterCaptureStatus = options.preview?.afterCaptureStatus ?? null;

  return {
    action: options.action,
    after: {
      captureStatus: afterCaptureStatus,
      cursor: options.point
        ? { coordinateSpace: 'native-screen', source: 'desktop-input-replay', x: options.point.x, y: options.point.y }
        : null,
      observedState: options.replayLines,
    },
    before: {
      captureStatus: beforeCaptureStatus,
      cursor: options.point
        ? { coordinateSpace: 'native-screen', source: 'desktop-input-replay', x: options.point.x, y: options.point.y }
        : null,
      observedState: beforeCaptureStatus ? [`beforeCaptureStatus=${beforeCaptureStatus}`] : [],
    },
    confidence: clampAgentDesktopActionConfidence(
      getAgentDesktopActionEvidenceConfidence(outcome)
      + (options.preview?.coordinateClosureStatus === 'coordinate_closure_ok' ? 0.1 : 0),
    ),
    diff: {
      changed,
      signals: [
        typeof options.preview?.uiChanged === 'boolean' ? `uiChanged=${options.preview.uiChanged}` : '',
        typeof options.preview?.visualDeltaRatio === 'number' ? `visualDeltaRatio=${options.preview.visualDeltaRatio}` : '',
        options.preview?.coordinateClosureStatus ? `coordinateClosure=${options.preview.coordinateClosureStatus}` : '',
        ...options.replayMissingEvidence.slice(0, 4),
      ].filter(Boolean),
      summary: outcome === 'changed'
        ? 'Desktop input replay detected a visible state change.'
        : outcome === 'no-op'
          ? 'Desktop input replay did not detect a visible state change.'
          : outcome === 'blocked'
            ? 'Desktop input failed or was blocked by the input bridge.'
            : 'Desktop input ran, but the available replay evidence is insufficient to prove a state change.',
    },
    phase: outcome === 'changed' ? 'confirmed' : outcome === 'blocked' ? undefined : 'dispatched',
    outcome,
    snapshotProfile: options.preview ? 'replay' : 'light',
    targetRef: createDesktopInputTargetRef({
      action: options.action,
      point: options.point,
      preview: options.preview,
    }),
    timestamp: Date.now(),
    tool: 'execute_desktop_input',
  };
}

function attachDesktopActionEvidenceToResult(
  result: AgentChatCommandResult,
  actionEvidence: AgentDesktopActionEvidence,
): AgentChatCommandResult {
  const stateSummary = {
    ...(result.stateSummary ?? {}),
    actionEvidence,
  };
  return {
    ...result,
    receipt: result.receipt
      ? {
          ...result.receipt,
          stateSummary: {
            ...(result.receipt.stateSummary ?? {}),
            actionEvidence,
          },
        }
      : result.receipt,
    stateSummary,
  };
}
