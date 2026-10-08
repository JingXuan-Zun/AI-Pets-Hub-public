import {
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentDesktopActionEvidence,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import { evaluateAgentActionLifecycle } from '../agentActionLifecycle';
import {
  type AgentRuntimeDesktopSequenceStep,
  createAgentRuntimeDesktopSequenceActionEvidence,
  mergeAgentRuntimeDesktopSequenceStructuredEvidence,
  createAgentRuntimeResult,
  attachAgentActionLifecycleDecision,
  createAgentRuntimeDesktopSequenceCoreEventLines,
} from './sequenceResultEvidence';
import { formatAgentRuntimeDesktopSequenceRecoveryDirective } from './sequenceVerification';

export function createAgentRuntimeDesktopSequenceOutcome(options: {
  failed: boolean;
  stepActionEvidences: AgentDesktopActionEvidence[];
  verificationResultOk: boolean | null;
  hasUnverifiedStep: boolean;
  auxiliaryStepFailure: boolean;
  completedCount: number;
  evidenceLines: string[];
  failedStepIndex: number | null;
  steps: AgentRuntimeDesktopSequenceStep[];
  verificationResult: AgentChatCommandResult | null;
  latestStructuredEvidence: AgentStructuredToolEvidence | null;
  failedStepText: string | null;
  observations: string[];
  summaryLabel: string;
  postVerifyRequired: boolean;
  toolCall: AgentToolCallCommand;
}): AgentChatCommandResult {
  const { failed, stepActionEvidences, verificationResultOk, hasUnverifiedStep, auxiliaryStepFailure, completedCount, evidenceLines, failedStepIndex, steps, verificationResult, latestStructuredEvidence, failedStepText, observations, summaryLabel, postVerifyRequired, toolCall } = options;


  // A later auxiliary step can fail after an earlier input already produced
  // changed evidence. Preserve that evidence as an uncertain sequence result
  // so the Runtime can verify/recover instead of misclassifying the whole task
  // as a pre-dispatch failure.
  const hasChangedStepBeforeFailure = failed
    && stepActionEvidences.some((evidence) => evidence.outcome === 'changed');
  const status: AgentChatExecutionReceipt['status'] = failed && !hasChangedStepBeforeFailure
    ? 'failed'
    : failed
      ? 'unverified'
      : verificationResultOk === false
      || hasUnverifiedStep
      || (auxiliaryStepFailure
        && !stepActionEvidences.some((evidence) => evidence.outcome === 'changed')
        && verificationResultOk !== true)
      ? 'unverified'
      : 'success';
  const actionEvidence = createAgentRuntimeDesktopSequenceActionEvidence({
    completedCount,
    evidenceLines,
    failedStepIndex,
    status,
    stepCount: steps.length,
    stepEvidences: stepActionEvidences,
    verificationResult,
  });
  const mergedStructuredEvidence = mergeAgentRuntimeDesktopSequenceStructuredEvidence(
    latestStructuredEvidence,
    verificationResult,
  );
  const sequenceStructuredEvidence = mergedStructuredEvidence
    ? {
        ...mergedStructuredEvidence,
        confidence: status === 'success'
          ? mergedStructuredEvidence.confidence ?? 'medium'
          : status === 'unverified'
            ? 'low'
            : mergedStructuredEvidence.postActionRecovery?.nextTool === 'execute_desktop_input'
              ? mergedStructuredEvidence.confidence ?? 'medium'
              : 'low',
        status,
      } satisfies AgentStructuredToolEvidence
    : null;
  const failedRecovery = status === 'failed'
    ? sequenceStructuredEvidence?.postActionRecovery ?? null
    : null;
  const unverifiedMissingEvidence = hasUnverifiedStep
    ? [
        'One or more desktop sequence steps returned unverified red-dot replay, capture, or coordinate-closure evidence.',
        verificationResultOk === true
          ? 'Post-sequence observation matched the requested desktop state, but it does not prove the pointer action changed the intended UI target.'
          : '',
      ].filter(Boolean)
    : [
        'Post-sequence window/app/display observation did not verify the requested final desktop state.',
      ];
  const failedStateSummary = status === 'failed'
    ? {
        actionEvidence,
        missingEvidence: [
          failedStepText || `Desktop sequence failed at step ${failedStepIndex}.`,
        ],
        observedState: observations,
        recommendedRecovery: [
          failedRecovery
            ? formatAgentRuntimeDesktopSequenceRecoveryDirective(failedRecovery)
            : '',
          failedRecovery?.nextTool
            ? `Follow the failed step recovery evidence with ${failedRecovery.nextTool}; do not retry the same failed primitive unchanged.`
            : 'Refresh the failed target evidence before retrying or asking the user.',
        ].filter(Boolean),
        structuredEvidence: sequenceStructuredEvidence,
        verificationEvidence: [
          `execute_desktop_sequence failed at step ${failedStepIndex}.`,
        ],
      }
    : undefined;
  const unverifiedStateSummary = status === 'unverified'
    ? {
        actionEvidence,
        missingEvidence: unverifiedMissingEvidence,
        recommendedRecovery: [
          'Observe windows/apps/displays again, then retry only the unclear primitive or ask the user if the target is ambiguous.',
          'tool:observe_windows_and_apps',
          'tool:execute_desktop_observation',
          'tool:execute_desktop_action',
        ],
        verificationEvidence: verificationResult
          ? [
              verificationResult.verification
                || verificationResult.responseText
                || 'Post-sequence verification was inconclusive.',
            ]
          : undefined,
        structuredEvidence: sequenceStructuredEvidence,
      }
    : undefined;
  const sequenceStateSummary = status === 'unverified'
    ? unverifiedStateSummary
      : status === 'failed'
      ? failedStateSummary
      : sequenceStructuredEvidence
        ? {
            actionEvidence,
            structuredEvidence: sequenceStructuredEvidence,
          }
        : {
            actionEvidence,
          };
  const responseText = failed
    ? `Desktop sequence stopped after ${completedCount}/${steps.length} successful step(s). Step ${failedStepIndex} failed: ${failedStepText}`
    : `Desktop sequence completed ${completedCount}/${steps.length} step(s).${verificationResult ? ` Post-sequence desktop state observation ${verificationResultOk ? 'succeeded' : 'was inconclusive'}.` : ''}`;
  const verification = failed
    ? `execute_desktop_sequence failed at step ${failedStepIndex}.`
    : verificationResult
      ? `execute_desktop_sequence completed all steps in order. Post-sequence verification: ${verificationResult.verification || verificationResult.responseText}`
      : 'execute_desktop_sequence completed all steps in order.';

  const sequenceResult = createAgentRuntimeResult({
    assessment: status === 'unverified'
    ? {
        evidence: evidenceLines,
        nextStep: 'Observe the desktop state again, retry the unclear primitive, or ask the user if the target is ambiguous.',
        status: 'unverified',
        summary: hasUnverifiedStep
          ? 'Desktop sequence steps completed, but at least one step had unverified replay or coordinate-closure evidence.'
          : 'Desktop sequence steps completed, but post-sequence verification did not confirm the requested final state.',
      }
    : undefined,
    errorText: failed
      ? failedStepText
      : postVerifyRequired && status !== 'success'
        ? 'Post-sequence verification did not confirm the requested final state.'
        : null,
    observations,
    ok: postVerifyRequired ? status === 'success' : !failed,
    receipt: {
      evidenceLines,
      status,
      summaryLines: [
        'Call: execute_desktop_sequence',
        `Mode: ${summaryLabel}`,
        `Steps requested: ${steps.length}`,
        `Steps completed: ${completedCount}`,
        failed ? `Failed step: ${failedStepIndex}` : 'Failed step: none',
      ],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification,
      stateSummary: sequenceStateSummary,
    },
    responseText,
    stateSummary: sequenceStateSummary,
    verification,
  });
  const sequenceResultWithLifecycle = attachAgentActionLifecycleDecision(
    sequenceResult,
    evaluateAgentActionLifecycle(sequenceResult),
  );
  const runtimeCoreEventLines = createAgentRuntimeDesktopSequenceCoreEventLines(sequenceResultWithLifecycle, toolCall);

  return runtimeCoreEventLines.length
    ? createAgentRuntimeResult({
        ...sequenceResultWithLifecycle,
        observations: [
          ...(sequenceResultWithLifecycle.observations ?? []),
          ...runtimeCoreEventLines,
        ],
        receipt: sequenceResultWithLifecycle.receipt
          ? {
              ...sequenceResultWithLifecycle.receipt,
              evidenceLines: [
                ...(sequenceResultWithLifecycle.receipt.evidenceLines ?? []),
                ...runtimeCoreEventLines,
              ],
              summaryLines: [
                ...sequenceResultWithLifecycle.receipt.summaryLines,
                'Runtime Core events: attached',
              ],
            }
          : sequenceResultWithLifecycle.receipt,
      })
    : sequenceResultWithLifecycle;

}
