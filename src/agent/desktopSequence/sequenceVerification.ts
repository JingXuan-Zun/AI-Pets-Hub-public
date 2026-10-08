import { inferAgentRuntimeDesktopSequencePostActionState, formatAgentRuntimeDesktopSequenceRecoveryDirective, createAgentRuntimeDesktopSequencePostActionRecoveryDirective, createAgentRuntimeDesktopSequencePostActionRecovery } from './sequencePostActionRecovery';
export { inferAgentRuntimeDesktopSequencePostActionState, formatAgentRuntimeDesktopSequenceRecoveryDirective } from './sequencePostActionRecovery';

import {
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
} from '../agentChatCommand';

import {
  type AgentRuntimeExecutorContext,
} from '../agentRuntimeExecutor';

import {
  executeObserveWindowsAndApps,
} from '../agentRuntimeDesktopObservationTools';

import {
  executeSummarizeVisualSnapshot,
} from '../agentRuntimeVisualTools';

import {
  waitForDesktopActionWindowSettle,
} from '../agentRuntimeWindowTools';

import {
  type AgentRuntimeDesktopSequenceStep,
  getAgentRuntimeSequenceStepAction,
  getAgentRuntimeSequenceStepTarget,
  isAgentRuntimeCancellationRequested,
  createAgentRuntimeCancelledResult,
  inferAgentRuntimeToolResultOk,
  mergeAgentRuntimeDesktopSequenceLists,
  mergeAgentRuntimeDesktopSequenceStructuredEvidence,
  createAgentRuntimeResult,
} from './sequenceResultEvidence';

const AGENT_RUNTIME_DESKTOP_SEQUENCE_VERIFICATION_ACTIONS = new Set([
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

const AGENT_RUNTIME_DESKTOP_SEQUENCE_INPUT_VERIFICATION_ACTIONS = new Set([
  'click',
  'double_click',
  'drag',
  'hotkey',
  'right_click',
  'send_keys',
  'type_text',
]);

function shouldVerifyAgentRuntimeDesktopSequence(steps: AgentRuntimeDesktopSequenceStep[]) {
  return steps.some((step) => (
    step.tool === 'execute_desktop_action'
      ? AGENT_RUNTIME_DESKTOP_SEQUENCE_VERIFICATION_ACTIONS.has(getAgentRuntimeSequenceStepAction(step))
      : AGENT_RUNTIME_DESKTOP_SEQUENCE_INPUT_VERIFICATION_ACTIONS.has(getAgentRuntimeSequenceStepAction(step))
  ));
}

function getAgentRuntimeDesktopSequenceVerificationQuery(
  steps: AgentRuntimeDesktopSequenceStep[],
  explicitQuery = '',
) {
  if (explicitQuery.trim()) {
    return explicitQuery.trim();
  }

  for (const step of [...steps].reverse()) {
    const action = getAgentRuntimeSequenceStepAction(step);
    if (step.tool === 'execute_desktop_action' && !AGENT_RUNTIME_DESKTOP_SEQUENCE_VERIFICATION_ACTIONS.has(action)) {
      continue;
    }

    if (step.tool === 'execute_desktop_input' && !AGENT_RUNTIME_DESKTOP_SEQUENCE_INPUT_VERIFICATION_ACTIONS.has(action)) {
      continue;
    }

    const target = getAgentRuntimeSequenceStepTarget(step);
    if (target) {
      return target;
    }
  }

  return '';
}

function createAgentRuntimeDesktopSequenceVisualQuestion(query: string) {
  return [
    'After the approved desktop input/action sequence, inspect the current visible UI state.',
    query ? `Expected target/content: ${query}.` : '',
    'If this is a launcher/list/detail UI, separate action success from selection state: visible target text is not enough.',
    'Verify whether the target is the current selected item/detail page/title/main action owner.',
    'Classify whether the UI appears launched/opened, waiting_target, loading, login_required, updating/downloading, error, unchanged, blocked, selection_mismatch, visible_only, or unknown.',
    'Use waiting_target when the start/open/play action appears sent but the requested target process/window/content has not appeared yet. Do not retry the same click for waiting_target.',
    'Return compact JSON using the normal desktop snapshot fields and set postActionState to exactly one of: launched, waiting_target, loading, login_required, updating, error, unchanged, blocked, selection_mismatch, visible_only, unknown.',
    'When relevant include currentSelection, selectionVerificationStatus, and selectionEvidence.',
    'Do not mark launched unless the expected target/content is visibly open/running or the current selected/detail state is confirmed for that target.',
    'Include readableText, uncertainty, confidence, and any visible recovery clue.',
  ].filter(Boolean).join(' ');
}

export async function executeDesktopSequencePostVerification(
  context: AgentRuntimeExecutorContext,
  steps: AgentRuntimeDesktopSequenceStep[],
  options: {
    enabled: boolean;
    query: string;
    requireSameHwnd?: boolean;
    sourceHwnd?: number | null;
    sourceQuery?: string;
    visualQuery: string;
  },
): Promise<AgentChatCommandResult | null> {
  if (!options.enabled || !shouldVerifyAgentRuntimeDesktopSequence(steps)) {
    return null;
  }

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult('execute_desktop_sequence');
  }

  await waitForDesktopActionWindowSettle(700);
  const query = getAgentRuntimeDesktopSequenceVerificationQuery(steps, options.query);
  const windowVerificationResult = await executeObserveWindowsAndApps({
    goal: 'Verify desktop state after execute_desktop_sequence',
    input: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeDisplays: true,
      includeRunningApps: true,
      limit: 12,
      ...(query ? { query } : {}),
    },
    name: 'observe_windows_and_apps',
  });

  const visualQuery = options.visualQuery.trim();
  if (!visualQuery) {
    return windowVerificationResult;
  }

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult('execute_desktop_sequence');
  }

  const visualVerificationResult = await executeSummarizeVisualSnapshot(
    context,
    {
      goal: 'Visually verify UI state after execute_desktop_sequence',
      input: {
        allowScreenFallback: options.requireSameHwnd !== true,
        forceRefresh: true,
        ...(Number.isFinite(options.sourceHwnd) && Number(options.sourceHwnd) > 0
          ? {
              hwnd: Math.round(Number(options.sourceHwnd)),
              sourceId: `window:${Math.round(Number(options.sourceHwnd))}:0`,
            }
          : {}),
        question: createAgentRuntimeDesktopSequenceVisualQuestion(visualQuery),
        ...(options.sourceQuery ? { sourceQuery: options.sourceQuery } : {}),
        sourceType: options.requireSameHwnd ? 'window' : 'all',
      },
      name: 'summarize_visual_snapshot',
    },
    visualQuery,
  );

  const visualOk = inferAgentRuntimeToolResultOk(visualVerificationResult);
  const windowOk = inferAgentRuntimeToolResultOk(windowVerificationResult);
  const postActionState = inferAgentRuntimeDesktopSequencePostActionState(visualVerificationResult);
  const postActionRecovery = createAgentRuntimeDesktopSequencePostActionRecoveryDirective(
    postActionState,
    visualQuery || query,
    steps,
  );
  const status: AgentChatExecutionReceipt['status'] = !visualOk && !windowOk
    ? 'failed'
    : postActionState === 'launched'
      ? 'success'
      : 'unverified';
  const stateSummary = {
    changedState: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.changedState,
      visualVerificationResult.stateSummary?.changedState,
    ),
    missingEvidence: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.missingEvidence,
      visualVerificationResult.stateSummary?.missingEvidence,
      status === 'success' ? [] : [`Post-sequence visual state is ${postActionState}, so the requested final state is not yet confirmed.`],
    ),
    observedState: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.observedState,
      windowVerificationResult.observations,
      visualVerificationResult.stateSummary?.observedState,
      visualVerificationResult.observations,
    ),
    recommendedRecovery: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.recommendedRecovery,
      visualVerificationResult.stateSummary?.recommendedRecovery,
      createAgentRuntimeDesktopSequencePostActionRecovery(postActionState, steps),
      [formatAgentRuntimeDesktopSequenceRecoveryDirective(postActionRecovery)],
    ),
    structuredEvidence: mergeAgentRuntimeDesktopSequenceStructuredEvidence(null, visualVerificationResult),
    verificationEvidence: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.verificationEvidence,
      visualVerificationResult.stateSummary?.verificationEvidence,
      [
        windowVerificationResult.verification,
        visualVerificationResult.verification,
      ],
    ),
  };
  stateSummary.structuredEvidence = stateSummary.structuredEvidence
    ? {
        ...stateSummary.structuredEvidence,
        postActionRecovery,
        postActionState,
      }
    : {
        postActionRecovery,
        postActionState,
        status,
      };
  stateSummary.observedState = mergeAgentRuntimeDesktopSequenceLists(
    stateSummary.observedState,
    [`Post-action visual state: ${postActionState}`],
  );

  const responseText = [
    'Post-sequence window/app observation:',
    windowVerificationResult.responseText,
    'Post-sequence visual state observation:',
    visualVerificationResult.responseText,
  ].filter(Boolean).join('\n');
  const verification = [
    windowVerificationResult.verification || windowVerificationResult.responseText,
    visualVerificationResult.verification || visualVerificationResult.responseText,
  ].filter(Boolean).join(' | ');

  return createAgentRuntimeResult({
    errorText: status === 'failed'
      ? visualVerificationResult.errorText || windowVerificationResult.errorText || 'Post-sequence verification failed.'
      : null,
    observations: [
      ...(windowVerificationResult.observations ?? []).map((line) => `Window verification: ${line}`),
      ...(visualVerificationResult.observations ?? []).map((line) => `Visual verification: ${line}`),
    ],
    ok: status !== 'failed',
    receipt: {
      evidenceLines: [
        ...(windowVerificationResult.receipt?.evidenceLines ?? windowVerificationResult.observations ?? [])
          .slice(0, 16)
          .map((line) => `Window: ${line}`),
        ...(visualVerificationResult.receipt?.evidenceLines ?? visualVerificationResult.observations ?? [])
          .slice(0, 16)
          .map((line) => `Visual: ${line}`),
      ],
      status,
      stateSummary,
      summaryLines: [
        'Call: execute_desktop_sequence post verification',
        `Window observation: ${windowOk ? 'ok' : 'failed'}`,
        `Visual observation: ${visualOk ? 'ok' : 'failed'}`,
      ],
      title: 'Agent desktop sequence verification',
      toolName: 'execute_desktop_sequence',
      verification,
    },
    responseText,
    stateSummary,
    verification,
  });
}
