import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence, type AgentToolCallName } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { getAgentStructuredEvidence } from '../runtime/agentPlanningSignalEvidence';
import { createAgentSubgoalId, createAgentToolCommand } from '../runtime/agentToolCommandFactory';
import {
  createAgentTargetSelectionCoordinateStepReason,
  createAgentTargetSelectionUiAutomationStepReason,
  createAgentVisualInputStepReason,
  createAgentVisualInvokeSubmitStepReason,
  createAgentVisualInvokeTextInputStepReason,
  createAgentVisualInvokeWindowUiStepReason,
  type AgentVisualInputFallbackMode,
} from '../runtime/agentApprovalReasonSignals';
import { hasAgentVisualSafeLoginContinuationApprovalEvidence as hasAgentSessionV2SafeLoginContinuationApprovalEvidence } from './visualCandidateEvidence';
import { type createAgentProductionVisualRetryEvidence } from './visualRetryEvidence';
import {
  getAgentProductionCandidateUiActions as getAgentSessionV2CandidateUiActions,
  inferAgentProductionWindowUiAction as inferAgentSessionV2WindowUiAction,
  extractAgentProductionWindowUiSetValueText as extractAgentSessionV2WindowUiSetValueText,
  hasAgentProductionWindowUiTextEntryIntent as hasAgentSessionV2WindowUiTextEntryIntent,
  inferAgentProductionKeyboardSubmitKey as inferAgentSessionV2KeyboardSubmitKey,
} from './windowUiActionIntent';

export function createAgentProductionVisualSequenceCommands(options: {
  isLoginControlEvidence: (evidence: AgentStructuredToolEvidence | null) => boolean;
  retryEvidence: Pick<ReturnType<typeof createAgentProductionVisualRetryEvidence>, 'hasAgentProductionSameRetryAvoidanceWindowUiCandidate'>;
}) {
  const isAgentSessionV2LoginControlEvidence = options.isLoginControlEvidence;
  const { hasAgentProductionSameRetryAvoidanceWindowUiCandidate: hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate } = options.retryEvidence;

  function resolveAgentProductionVisualPostVerifyQuery(
    evidence: AgentStructuredToolEvidence | null,
    sourceText: string,
    userGoal: string,
  ) {
    const candidates = [
      evidence?.targetMatched,
      evidence?.primaryAction,
      evidence?.elementDescription,
      sourceText,
      userGoal,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return '';
  }

  function createAgentProductionVisualInputSequenceCommand(options: {
    entry: AgentRuntimeToolResultEntry;
    evidence?: AgentStructuredToolEvidence | null;
    forceLoginContinuationInput?: boolean;
    inputAction?: AgentVisualInputFallbackMode;
    point: { x: number; y: number };
    sourceText: string;
    userGoal: string;
  }) {
    const evidence = options.evidence ?? getAgentStructuredEvidence(options.entry);
    const targetText = evidence?.targetMatched?.trim() || 'visual target';
    const primaryActionText = evidence?.primaryAction?.trim() || 'primary action';
    const inputAction = options.inputAction ?? 'click';
    const isLoginControl = isAgentSessionV2LoginControlEvidence(evidence);
    const targetWindowHwnd = Number(evidence?.finalWindow?.hwnd);
    const targetWindowPid = Number(evidence?.finalWindow?.pid);
    const targetWindowIdentity = {
      ...(Number.isFinite(targetWindowHwnd) && targetWindowHwnd > 0
        ? { expectedForegroundHwnd: Math.round(targetWindowHwnd) }
        : {}),
      ...(Number.isFinite(targetWindowPid) && targetWindowPid > 0
        ? { expectedForegroundPid: Math.round(targetWindowPid) }
        : {}),
    };
    const inputSteps: Array<{ args: Record<string, unknown>; reason: string; tool: 'execute_desktop_input' }> = inputAction === 'click_then_enter' || inputAction === 'click_then_space'
      ? [
          {
            args: {
              action: 'click',
              button: 'left',
              ...targetWindowIdentity,
              x: options.point.x,
              y: options.point.y,
            },
            reason: createAgentVisualInputStepReason({
              action: 'click',
              inputAction,
              point: options.point,
              primaryActionText,
              targetText,
            }),
            tool: 'execute_desktop_input',
          },
          {
            args: {
              action: 'hotkey',
              hotkey: inputAction === 'click_then_space' ? 'Space' : 'Enter',
            },
            reason: createAgentVisualInputStepReason({
              action: 'confirm',
              inputAction,
              keyName: inputAction === 'click_then_space' ? 'Space' : 'Enter',
              point: options.point,
              primaryActionText,
              targetText,
            }),
            tool: 'execute_desktop_input',
          },
        ]
      : [
          {
            args: {
              action: inputAction,
              button: 'left',
              ...targetWindowIdentity,
              ...(options.forceLoginContinuationInput ? {
                coordinateSpace: 'native-screen',
                forceMouseEventFallback: true,
                holdMs: 140,
                intervalMs: 160,
                preClickDelayMs: 180,
                repeat: 1,
              } : {}),
              x: options.point.x,
              y: options.point.y,
            },
            reason: createAgentVisualInputStepReason({
              action: 'single_input',
              inputAction,
              point: options.point,
              primaryActionText,
              targetText,
            }),
            tool: 'execute_desktop_input',
          },
        ];
    if (options.forceLoginContinuationInput && inputAction === 'click') {
      inputSteps.push({
        args: {
          action: 'send_keys',
          keys: '{ENTER}',
        },
        reason: 'Fallback: send Enter after login continuation click in case the launcher button accepted focus but ignored synthetic mouse-up.',
        tool: 'execute_desktop_input',
      });
    }
    const steps: Array<{
      args: Record<string, unknown>;
      reason: string;
      tool: 'execute_desktop_action' | 'execute_desktop_input';
    }> = targetWindowHwnd > 0
      ? [
          {
            args: {
              action: 'focus_window',
              hwnd: Math.round(targetWindowHwnd),
              ...(targetWindowPid > 0 ? { pid: Math.round(targetWindowPid) } : {}),
            },
            reason: `Focus the live target window before dispatching the visual input at (${options.point.x}, ${options.point.y}).`,
            tool: 'execute_desktop_action',
          },
          ...inputSteps,
        ]
      : inputSteps;
    return createAgentToolCommand({
      actionScope: {
        completion: options.forceLoginContinuationInput ? 'intermediate' : 'terminal',
        subgoalId: createAgentSubgoalId({
          completion: options.forceLoginContinuationInput ? 'intermediate' : 'terminal',
          targetRef: targetText,
        }),
        targetRef: targetText,
      },
      args: {
        postVerifyRequired: true,
        postVerifyQuery: isLoginControl
          ? `Verify authentication after activating "${primaryActionText}" for "${targetText}": determine whether the login overlay remains, the application main interface is visible, or manual verification is required.`
          : resolveAgentProductionVisualPostVerifyQuery(evidence, options.sourceText, options.userGoal),
        postVerifyVisualQuery: isLoginControl
          ? `Verify authentication after activating "${primaryActionText}" for "${targetText}": determine whether the login overlay remains, the application main interface is visible, or manual verification is required.`
          : resolveAgentProductionVisualPostVerifyQuery(evidence, options.sourceText, options.userGoal),
        stepsJson: JSON.stringify(steps),
      },
      sourceText: options.sourceText,
      toolName: 'execute_desktop_sequence',
      userGoal: options.userGoal,
    });
  }

  function createAgentProductionTargetSelectionPostVerifyQuery(
    evidence: AgentStructuredToolEvidence | null,
    sourceText: string,
    userGoal: string,
  ) {
    const targetText = evidence?.targetMatched?.trim()
      || resolveAgentProductionVisualPostVerifyQuery(evidence, sourceText, userGoal)
      || 'the requested target';
    return [
      `Verify whether "${targetText}" is now the current selected/detail item.`,
      'Return selectionVerificationStatus as selected, visible-only, mismatch, or unknown.',
      'Do not treat the target merely being visible as selected/current.',
      'A detail/main page whose title, banners, or own start/play button belong to the target counts as selected/current even without a highlighted list item.',
      'If selected/current is confirmed, then locate the associated primary open/start/play action; otherwise report the current selected/detail item and missing evidence.',
    ].join(' ');
  }

  function createAgentProductionTargetSelectionSequenceCommand(options: {
    candidate: AgentStructuredToolCandidateEvidence;
    entry: AgentRuntimeToolResultEntry;
    point?: { x: number; y: number } | null;
    sourceText: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal: string;
  }) {
    const evidence = getAgentStructuredEvidence(options.entry);
    const targetText = options.candidate.name?.trim()
      || options.candidate.label?.trim()
      || evidence?.targetMatched?.trim()
      || 'target item';
    const query = options.candidate.window?.title?.trim()
      || options.candidate.window?.processName?.trim()
      || (typeof options.entry.command.toolCall?.input?.query === 'string' ? options.entry.command.toolCall.input.query.trim() : '')
      || (typeof options.entry.command.toolCall?.input?.sourceQuery === 'string' ? options.entry.command.toolCall.input.sourceQuery.trim() : '');
    const hwnd = Number(options.candidate.window?.hwnd);
    const candidateActions = getAgentSessionV2CandidateUiActions(options.candidate);
    const repeatedFailedCandidate = hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate({
      candidate: options.candidate,
      evidence,
      toolResults: options.toolResults,
    });
    const alternateUiAction = repeatedFailedCandidate && candidateActions.includes('scroll-into-view')
      ? 'scroll_into_view'
      : repeatedFailedCandidate && candidateActions.includes('focus')
        ? 'focus'
        : '';
    const supportsSelect = candidateActions.includes('select');
    const effectiveUiAction = alternateUiAction || (supportsSelect ? 'select' : '');
    const steps: Array<{ args: Record<string, unknown>; reason: string; tool: AgentToolCallName }> = effectiveUiAction
      ? [
          {
            args: {
              action: 'interact_window_ui',
              uiAction: effectiveUiAction,
              ...(options.candidate.automationId?.trim() ? { automationId: options.candidate.automationId.trim() } : {}),
              ...(options.candidate.controlType?.trim() ? { controlType: options.candidate.controlType.trim() } : {}),
              ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
              ...(query ? { query } : {}),
              ...(options.point ? { fallbackX: options.point.x, fallbackY: options.point.y, x: options.point.x, y: options.point.y } : {}),
              targetDescription: [
                options.candidate.description?.trim(),
                evidence?.relation?.trim(),
                'Selection recovery: select the target item before looking for its primary action.',
              ].filter(Boolean).join(' | '),
              targetText,
            },
            reason: createAgentTargetSelectionUiAutomationStepReason({
              alternateUiAction,
              targetText,
            }),
            tool: 'execute_desktop_action',
          },
        ]
      : options.point
        ? [
            {
              args: {
                action: 'click',
                button: 'left',
                x: options.point.x,
                y: options.point.y,
              },
              reason: createAgentTargetSelectionCoordinateStepReason({ targetText }),
              tool: 'execute_desktop_input',
            },
          ]
        : [];
    if (!steps.length) {
      return null;
    }

    const postVerifyQuery = createAgentProductionTargetSelectionPostVerifyQuery(
      evidence,
      options.sourceText,
      options.userGoal,
    );
    return createAgentToolCommand({
      actionScope: {
        completion: 'intermediate',
        subgoalId: createAgentSubgoalId({
          completion: 'intermediate',
          targetRef: targetText,
        }),
        targetRef: targetText,
      },
      args: {
        postVerifyQuery,
        postVerifyVisualQuery: postVerifyQuery,
        stepsJson: JSON.stringify(steps),
        stopOnError: true,
      },
      sourceText: options.sourceText,
      toolName: 'execute_desktop_sequence',
      userGoal: options.userGoal,
    });
  }

  function createAgentProductionVisualInvokeSequenceCommand(options: {
    candidate: AgentStructuredToolCandidateEvidence;
    entry: AgentRuntimeToolResultEntry;
    point?: { x: number; y: number } | null;
    sourceText: string;
    userGoal: string;
  }) {
    const evidence = getAgentStructuredEvidence(options.entry);
    const targetText = options.candidate.name?.trim()
      || options.candidate.label?.trim()
      || evidence?.primaryAction?.trim()
      || evidence?.targetMatched?.trim()
      || 'UI control';
    const query = options.candidate.window?.title?.trim()
      || options.candidate.window?.processName?.trim()
      || (typeof options.entry.command.toolCall?.input?.query === 'string' ? options.entry.command.toolCall.input.query.trim() : '')
      || (typeof options.entry.command.toolCall?.input?.sourceQuery === 'string' ? options.entry.command.toolCall.input.sourceQuery.trim() : '');
    const hwnd = Number(options.candidate.window?.hwnd);
    const uiAction = inferAgentSessionV2WindowUiAction(
      options.candidate,
      evidence,
      options.sourceText,
      options.userGoal,
    );
    const setValueText = uiAction === 'set_value'
      ? extractAgentSessionV2WindowUiSetValueText(options.sourceText, options.userGoal)
      : '';
    if (uiAction === 'set_value' && !setValueText) {
      return null;
    }
    const focusText = uiAction === 'focus' && hasAgentSessionV2WindowUiTextEntryIntent(options.sourceText, options.userGoal)
      ? extractAgentSessionV2WindowUiSetValueText(options.sourceText, options.userGoal)
      : '';
    const submitKey = focusText ? inferAgentSessionV2KeyboardSubmitKey(options.sourceText, options.userGoal) : '';
    const isIntermediateContinuation = hasAgentSessionV2SafeLoginContinuationApprovalEvidence({
      evidence,
      result: options.entry.result,
    });
    const windowUiStep = {
      args: {
        action: 'interact_window_ui',
        uiAction,
        ...(options.candidate.automationId?.trim() ? { automationId: options.candidate.automationId.trim() } : {}),
        ...(options.candidate.controlType?.trim() ? { controlType: options.candidate.controlType.trim() } : {}),
        ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
        ...(query ? { query } : {}),
        ...(setValueText ? { value: setValueText } : {}),
        ...(options.point ? { fallbackX: options.point.x, fallbackY: options.point.y, x: options.point.x, y: options.point.y } : {}),
        targetDescription: [
          options.candidate.description?.trim(),
          evidence?.relation?.trim(),
        ].filter(Boolean).join(' | '),
        targetText,
      },
      reason: createAgentVisualInvokeWindowUiStepReason({
        targetText,
        uiAction,
      }),
      tool: 'execute_desktop_action',
    };
    const steps = [
      windowUiStep,
      ...(focusText
        ? [
            {
              args: {
                action: 'type_text',
                text: focusText,
              },
              reason: createAgentVisualInvokeTextInputStepReason({ targetText }),
              tool: 'execute_desktop_input',
            },
          ]
        : []),
      ...(submitKey
        ? [
            {
              args: {
                action: 'hotkey',
                hotkey: submitKey,
              },
              reason: createAgentVisualInvokeSubmitStepReason({
                submitKey,
                targetText,
              }),
              tool: 'execute_desktop_input',
            },
          ]
        : []),
    ];

    return createAgentToolCommand({
      actionScope: {
        completion: isIntermediateContinuation ? 'intermediate' : 'terminal',
        subgoalId: createAgentSubgoalId({
          completion: isIntermediateContinuation ? 'intermediate' : 'terminal',
          targetRef: targetText,
        }),
        targetRef: targetText,
      },
      args: {
        postVerifyQuery: resolveAgentProductionVisualPostVerifyQuery(
          evidence,
          options.sourceText,
          options.userGoal,
        ),
        postVerifyVisualQuery: resolveAgentProductionVisualPostVerifyQuery(
          evidence,
          options.sourceText,
          options.userGoal,
        ),
        stepsJson: JSON.stringify(steps),
      },
      sourceText: options.sourceText,
      toolName: 'execute_desktop_sequence',
      userGoal: options.userGoal,
    });
  }

  return {
    createAgentProductionVisualInputSequenceCommand,
    createAgentProductionTargetSelectionSequenceCommand,
    createAgentProductionVisualInvokeSequenceCommand,
  };
}
