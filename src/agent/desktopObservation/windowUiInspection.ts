import {
  desktopPetShellRuntime,
} from '../../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  createFailedWindowUiInspectionStructuredEvidence,
  createWindowUiStructuredEvidence,
} from './windowUiInspectionEvidence';
import {
  type WindowUiInspectionResultLike,
  isWindowUiControlActionable,
  formatWindowUiControlLine,
} from './windowUiCandidates';
import {
  getToolNumberInput,
  getToolStringInput,
} from '../desktopTools/desktopToolInput';

export async function executeInspectWindowUi(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.inspectWindowUi({
    hwnd: getToolNumberInput(toolCall, 'hwnd') ?? undefined,
    limit: getToolNumberInput(toolCall, 'limit') ?? undefined,
    maxDepth: getToolNumberInput(toolCall, 'maxDepth') ?? undefined,
    query: getToolStringInput(toolCall, ['query', 'target', 'name', 'title', 'processName']),
    targetDescription: getToolStringInput(toolCall, ['targetDescription', 'description', 'element']),
    targetText: getToolStringInput(toolCall, ['targetText', 'text', 'label', 'targetElement']),
  }) as WindowUiInspectionResultLike;
  const controls = Array.isArray(result?.controls) ? result.controls : [];
  const matchedControls = Array.isArray(result?.matchedControls) ? result.matchedControls : [];
  const actionableControls = controls.filter((control) => isWindowUiControlActionable(control));
  const structuredEvidence = createWindowUiStructuredEvidence(result);
  const windowLabel = result?.window?.title || result?.window?.processName || result?.query || 'target window';
  const matchedLines = matchedControls.slice(0, 8).map(formatWindowUiControlLine);
  const actionableLines = actionableControls.slice(0, 8).map(formatWindowUiControlLine);
  const sampleLines = controls.slice(0, 12).map(formatWindowUiControlLine);
  const observations = [
    `Window UI query: ${result?.query || ''}`,
    `Target text: ${result?.targetText || ''}`,
    result?.window?.processName ? `Window process: ${result.window.processName}` : '',
    result?.window?.title ? `Window title: ${result.window.title}` : '',
    typeof result?.window?.hwnd === 'number' ? `Window hwnd: ${result.window.hwnd}` : '',
    `UI Automation controls: ${result?.controlCount ?? controls.length}`,
    matchedLines.length ? `Matched controls:\n${matchedLines.join('\n')}` : '',
    actionableLines.length ? `Actionable controls:\n${actionableLines.join('\n')}` : '',
    sampleLines.length ? `Control sample:\n${sampleLines.join('\n')}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);

  if (result?.ok) {
    const postActionRecoveryLine = structuredEvidence?.postActionRecovery
      ? [
          `postActionRecoveryStrategy=${structuredEvidence.postActionRecovery.strategy}`,
          structuredEvidence.postActionRecovery.nextTool ? `nextTool=${structuredEvidence.postActionRecovery.nextTool}` : '',
          structuredEvidence.postActionRecovery.nextArgs ? `nextArgs=${JSON.stringify(structuredEvidence.postActionRecovery.nextArgs)}` : '',
          structuredEvidence.postActionRecovery.reason ? `reason=${structuredEvidence.postActionRecovery.reason}` : '',
        ].filter(Boolean).join(' | ')
      : '';
    const launcherVerificationBlocked = Boolean(
      structuredEvidence?.launcherVerification?.status
        && structuredEvidence.launcherVerification.status !== 'ready',
    );
    const missingEvidence = structuredEvidence?.visualActionReadiness === 'ready' && !launcherVerificationBlocked
      ? []
      : [
          structuredEvidence?.launcherVerification?.status && structuredEvidence.launcherVerification.status !== 'ready'
            ? `Launcher verification failed: ${structuredEvidence.launcherVerification.reason ?? structuredEvidence.launcherVerification.status}.`
            : '',
          structuredEvidence?.postActionState
            ? `UI Automation post-action state is ${structuredEvidence.postActionState}.`
            : '',
          matchedControls.length
            ? 'Target/action relation is not fully proven by UI Automation alone.'
            : 'No exact UI Automation match for the requested target text.',
        ].filter(Boolean);
    const recommendedRecovery = structuredEvidence?.visualActionReadiness === 'ready' && !launcherVerificationBlocked
      ? []
      : postActionRecoveryLine
        ? [
            structuredEvidence?.launcherVerification?.status && structuredEvidence.launcherVerification.status !== 'ready'
              ? `Recover launcher state: ${structuredEvidence.launcherVerification.reason ?? structuredEvidence.launcherVerification.status}.`
              : '',
            postActionRecoveryLine,
          ].filter(Boolean)
        : [
            'Use locate_screen_elements with focus crop around a UI Automation candidate, or ask one short clarification if multiple candidates remain ambiguous.',
          ];

    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations.slice(0, 40),
        status: missingEvidence.length ? 'unverified' : 'success',
        summaryLines: [
          'Call: execute_desktop_observation inspect_window_ui',
          `Window: ${windowLabel}`,
          `Controls: ${result.controlCount ?? controls.length}`,
          `Matched: ${matchedControls.length}`,
        ],
        title: 'Agent window UI inspection',
        toolName: 'execute_desktop_observation',
        verification: `Read ${result.controlCount ?? controls.length} UI Automation controls from ${windowLabel}.`,
      },
      responseText: [
        `Inspected UI controls in ${windowLabel}.`,
        `controls=${result.controlCount ?? controls.length}, matched=${matchedControls.length}, actionable=${actionableControls.length}`,
        matchedLines.length ? `Matched controls:\n${matchedLines.join('\n')}` : '',
      ].filter(Boolean).join('\n'),
      stateSummary: {
        missingEvidence,
        observedState: observations,
        recommendedRecovery,
        structuredEvidence,
        verificationEvidence: [
          `UI Automation returned ${result.controlCount ?? controls.length} controls for ${windowLabel}.`,
          matchedControls.length ? `Matched ${matchedControls.length} controls against target text.` : '',
        ].filter(Boolean),
      },
      verification: `Window UI inspection returned current control names, types, actions, and screen bounds for ${windowLabel}.`,
    };
  }

  const failedStructuredEvidence = structuredEvidence ?? createFailedWindowUiInspectionStructuredEvidence(result ?? {});
  const recovery = failedStructuredEvidence.postActionRecovery;
  const recoveryLine = recovery
    ? [
        `postActionRecoveryStrategy=${recovery.strategy}`,
        recovery.nextTool ? `nextTool=${recovery.nextTool}` : '',
        recovery.nextArgs ? `nextArgs=${JSON.stringify(recovery.nextArgs)}` : '',
        recovery.reason ? `reason=${recovery.reason}` : '',
      ].filter(Boolean).join(' | ')
    : 'Use visual snapshot or locate_screen_elements as a fallback when UI Automation is unavailable.';

  return {
    errorText: result?.error || 'Window UI inspection failed.',
    observations,
    ok: false,
    responseText: `Window UI inspection failed: ${result?.error || 'unknown error'}.`,
    stateSummary: {
      missingEvidence: [
        'Window UI Automation controls were not available.',
        'Need visual/OCR evidence for visible target text, primary action, status text, and coordinates.',
      ],
      observedState: observations,
      recommendedRecovery: [
        recoveryLine,
      ],
      structuredEvidence: failedStructuredEvidence,
      verificationEvidence: [],
    },
    verification: result?.error || null,
  };
}
