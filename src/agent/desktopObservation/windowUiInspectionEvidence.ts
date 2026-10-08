import { type AgentStructuredToolEvidence } from '../agentChatCommand';
import { createStructuredWindowEvidence } from './windowAppObservation';
import {
  type WindowUiControlLike,
  type WindowUiInspectionResultLike,
  createWindowUiInspectionTextBlob,
  isWindowUiControlActionable,
  getWindowUiControlCenter,
  resolveWindowUiBestEnabledAlternateAction,
  getWindowUiControlBounds,
  createWindowUiCandidate,
  createWindowUiSelectionEvidence,
  getWindowUiControlLabel,
  createWindowUiLauncherVerification,
  getWindowUiControlConfidence,
} from './windowUiCandidates';

function inferWindowUiInspectionPostActionState(options: {
  bestMatchedAction: WindowUiControlLike | null;
  controls: WindowUiControlLike[];
  matchedControls: WindowUiControlLike[];
  result: WindowUiInspectionResultLike;
}) {
  const { bestMatchedAction, controls, matchedControls, result } = options;
  const text = createWindowUiInspectionTextBlob(result, controls, matchedControls);
  const hasDisabledMatchedTarget = matchedControls.some((control) => (
    control.enabled === false
    || control.offscreen === true
  ));

  if (bestMatchedAction) {
    return null;
  }

  if (/(?:login|sign\s*in|password|account|qr\s*code|captcha|verification|verify|\u767b\u5f55|\u767b\u9646|\u8d26\u53f7|\u8d26\u6237|\u5bc6\u7801|\u626b\u7801|\u9a8c\u8bc1)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:error|failed|failure|exception|crash|\u9519\u8bef|\u5931\u8d25|\u5f02\u5e38|\u5d29\u6e83|\u62a5\u9519)/iu.test(text)) {
    return 'error';
  }

  if (/(?:permission|denied|modal|confirmation|confirm|allow|blocked|gate|\u6743\u9650|\u62d2\u7edd|\u5f39\u7a97|\u786e\u8ba4|\u5141\u8bb8|\u963b\u6b62|\u62e6\u622a)/iu.test(text)) {
    return 'blocked';
  }

  if (/(?:updating|update|download|install|patch|verifying|extracting|preparing|queued|queue|\u66f4\u65b0|\u4e0b\u8f7d|\u5b89\u88c5|\u4fee\u8865|\u8865\u4e01|\u6821\u9a8c|\u9a8c\u8bc1\u4e2d|\u89e3\u538b|\u51c6\u5907|\u6392\u961f)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|initializing|connecting|please\s*wait|progress|spinner|waiting|\u52a0\u8f7d|\u542f\u52a8\u4e2d|\u6b63\u5728\u542f\u52a8|\u521d\u59cb\u5316|\u8fde\u63a5|\u7b49\u5f85|\u8fdb\u5ea6)/iu.test(text)) {
    return 'loading';
  }

  if (hasDisabledMatchedTarget) {
    return 'blocked';
  }

  return null;
}

function createWindowUiInspectionPostActionRecovery(options: {
  postActionState: string | null;
  result: WindowUiInspectionResultLike;
}) {
  const { postActionState, result } = options;
  if (!postActionState) {
    return null;
  }

  const query = result.query?.trim()
    || result.window?.title?.trim()
    || result.window?.processName?.trim()
    || '';
  const targetText = result.targetText?.trim() || '';
  const withQuery = (args: Record<string, unknown>) => (
    query ? { ...args, query } : args
  );

  switch (postActionState) {
    case 'loading':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 2500,
        }),
        nextTool: 'execute_desktop_observation' as const,
        reason: 'UI Automation found the target unavailable while the window looks like it is loading or starting. Wait briefly and observe again before retrying.',
        strategy: 'wait-and-observe' as const,
      };

    case 'updating':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 5000,
        }),
        nextTool: 'execute_desktop_observation' as const,
        reason: 'UI Automation found update/download/install/progress evidence. Wait and observe progress instead of clicking disabled controls.',
        strategy: 'wait-and-observe' as const,
      };

    case 'error':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: targetText
            ? `Read visible error text and safe retry/recovery controls related to ${targetText}. Do not click anything.`
            : 'Read visible error text and safe retry/recovery controls. Do not click anything.',
          targetDescription: 'visible error text and recovery controls',
          ...(targetText ? { targetText } : {}),
        }),
        nextTool: 'locate_screen_elements' as const,
        reason: 'UI Automation text suggests an error. Read the visible error before retrying or reporting a blocker.',
        strategy: 'read-error' as const,
      };

    case 'blocked':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: targetText
            ? `Read why ${targetText} is unavailable: blocker, modal, permission prompt, disabled-state reason, and safe alternate controls. Do not click anything.`
            : 'Read visible blocker, modal, permission prompt, disabled-state reason, and safe alternate controls. Do not click anything.',
          targetDescription: 'visible blocker, permission prompt, modal, disabled-state reason, and alternate controls',
          ...(targetText ? { targetText } : {}),
        }),
        nextTool: 'locate_screen_elements' as const,
        reason: 'UI Automation found the requested control disabled/offscreen or blocked by a gate. Read the blocker/reason before retrying.',
        strategy: 'read-blocker' as const,
      };

    case 'login_required':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: [
            targetText
              ? `Read the login/account page related to ${targetText}.`
              : 'Read the visible login/account page.',
            'Find safe login continuation controls such as 登录, 快速登录, 安全登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered.',
            'Also report any captcha, QR-code scan, SMS code, two-factor verification, empty required input, or admin/UAC gate. Do not click anything.',
          ].join(' '),
          targetDescription: 'login continuation controls and non-automatable verification gates',
          targetText: '登录 快速登录 安全登录 Sign in Log in Continue Confirm OK',
        }),
        nextTool: 'locate_screen_elements' as const,
        reason: 'UI Automation text suggests a login/account page. Read safe login continuation controls first; only ask the user for captcha, QR scan, 2FA, empty credentials, or admin confirmation.',
        strategy: 're-locate-target' as const,
      };

    default:
      return null;
  }
}

export function createFailedWindowUiInspectionStructuredEvidence(
  result: WindowUiInspectionResultLike,
): AgentStructuredToolEvidence {
  const query = result.query?.trim()
    || result.window?.title?.trim()
    || result.window?.processName?.trim()
    || '';
  const targetText = result.targetText?.trim() || '';
  const targetDescription = result.targetDescription?.trim() || '';
  const nextArgs: Record<string, unknown> = {
    action: 'describe_elements',
    forceRefresh: true,
    question: [
      'UI Automation failed or returned no usable controls. Use vision/OCR to read the current window, visible target text, primary action buttons, disabled/loading/error text, and reliable coordinates. Do not click anything.',
      targetText ? `Requested target: ${targetText}.` : '',
      targetDescription ? `Target description: ${targetDescription}.` : '',
    ].filter(Boolean).join(' '),
    targetDescription: targetDescription || 'visible target text, primary action buttons, status text, and safe coordinates',
  };
  if (query) {
    nextArgs.query = query;
    nextArgs.sourceQuery = query;
  }
  if (targetText) {
    nextArgs.targetText = targetText;
  }

  const finalWindow = createStructuredWindowEvidence(result.window);
  const processPresent = Boolean(finalWindow?.pid || finalWindow?.processName);
  const windowPresent = Boolean(finalWindow?.hwnd || finalWindow?.title);
  return {
    appExecutionProfile: 'unknown',
    captureAvailable: null,
    confidence: 'low',
    coordinateConfidence: 'low',
    desktopTargetPresence: processPresent || windowPresent ? 'present_unreadable' : 'unknown',
    finalWindow,
    foreground: null,
    interactionReady: false,
    postActionRecovery: {
      nextArgs,
      nextTool: 'locate_screen_elements',
      reason: result.error
        ? `UI Automation failed before controls could be inspected: ${result.error}`
        : 'UI Automation did not return usable controls. Fall back to visual/OCR screen element location.',
      strategy: 're-locate-target',
    },
    postActionState: 'unknown',
    relation: 'UI Automation did not provide usable control evidence; visual/OCR observation is needed before deciding the next action.',
    processPresent,
    status: 'failed',
    targetMatched: targetText || null,
    uiAutomationAvailable: false,
    visualReadable: null,
    visualActionReadiness: 'low-confidence',
    windowPresent,
  };
}

export function createWindowUiStructuredEvidence(
  result: WindowUiInspectionResultLike,
): AgentStructuredToolEvidence | null {
  const controls = Array.isArray(result.controls) ? result.controls : [];
  const matchedControls = Array.isArray(result.matchedControls) ? result.matchedControls : [];
  const actionableControls = controls
    .filter((control) => isWindowUiControlActionable(control) && getWindowUiControlCenter(control))
    .sort((first, second) => (
      Number(second.matchScore ?? 0) - Number(first.matchScore ?? 0)
      || Number(first.depth ?? 0) - Number(second.depth ?? 0)
      || Number(first.index ?? 0) - Number(second.index ?? 0)
    ));
  const targetText = result.targetText?.trim() ?? '';
  const directBestMatchedAction = actionableControls.find((control) => Number(control.matchScore ?? 0) >= 78) ?? null;
  const alternateBestMatchedAction = directBestMatchedAction
    ? null
    : resolveWindowUiBestEnabledAlternateAction({
        actionableControls,
        matchedControls,
        requireTargetAssociation: true,
        targetText,
      });
  const bestMatchedAction = directBestMatchedAction ?? alternateBestMatchedAction;
  const bestMatchedActionIsAlternate = Boolean(alternateBestMatchedAction);
  const bestMatchedActionIsNearbyAction = Boolean(
    alternateBestMatchedAction
      && !matchedControls.some((control) => control.enabled === false || control.offscreen === true),
  );
  const targetCandidates = matchedControls
    .filter((control) => getWindowUiControlCenter(control) || getWindowUiControlBounds(control))
    .slice(0, 8)
    .map((control) => createWindowUiCandidate(control, result.window));
  const rankedActionControls = [
    ...(bestMatchedAction ? [bestMatchedAction] : []),
    ...actionableControls.filter((control) => control !== bestMatchedAction),
  ];
  const actionCandidates = rankedActionControls
    .slice(0, 8)
    .map((control) => createWindowUiCandidate(control, result.window));
  const bestBounds = bestMatchedAction ? getWindowUiControlBounds(bestMatchedAction) : null;
  const bestCenter = bestMatchedAction ? getWindowUiControlCenter(bestMatchedAction) : null;
  const selectionEvidence = createWindowUiSelectionEvidence({
    matchedControls,
    result,
    targetCandidates,
  });

  if (!controls.length && !matchedControls.length) {
    return null;
  }

  const readiness: AgentStructuredToolEvidence['visualActionReadiness'] = bestMatchedAction && bestCenter
    ? 'ready'
    : targetText && targetCandidates.length > 1
      ? 'needs-target-selection'
      : targetText && targetCandidates.length === 1
        ? 'needs-primary-action'
        : targetText
          ? 'low-confidence'
          : 'not-actionable';
  const postActionState = inferWindowUiInspectionPostActionState({
    bestMatchedAction,
    controls,
    matchedControls,
    result,
  });
  const postActionRecovery = createWindowUiInspectionPostActionRecovery({
    postActionState,
    result,
  });
  const primaryAction = bestMatchedAction ? getWindowUiControlLabel(bestMatchedAction) : null;
  const relation = bestMatchedActionIsAlternate
    ? bestMatchedActionIsNearbyAction
      ? 'UI Automation matched the requested target as a non-action control and selected a nearby enabled primary action control.'
      : 'UI Automation found the requested target unavailable, but selected a nearby enabled alternate action control with relevant action text.'
    : bestMatchedAction
    ? 'The target text matched an actionable UI Automation control.'
    : postActionState === 'loading' || postActionState === 'updating'
      ? 'UI Automation indicates the target is not actionable yet because the app is in a transitional state.'
      : postActionState === 'blocked'
        ? 'UI Automation indicates the requested control is unavailable or blocked; visible reason should be read before retrying.'
        : targetCandidates.length || actionCandidates.length
          ? 'UI Automation returned candidate controls; use visual/OCR focus crop when target/action relation is unclear.'
          : null;
  const targetMatched = bestMatchedAction
    ? (targetText || getWindowUiControlLabel(bestMatchedAction))
    : targetCandidates[0]?.label ?? null;
  const targetInteractionVerification = createWindowUiLauncherVerification({
    actionCandidates,
    currentSelection: selectionEvidence.currentSelection,
    primaryAction,
    readiness,
    relation,
    selectionVerificationStatus: selectionEvidence.selectionVerificationStatus,
    targetCandidates,
    targetMatched,
  });
  const finalWindow = createStructuredWindowEvidence(result.window);
  const processPresent = Boolean(finalWindow?.pid || finalWindow?.processName);
  const windowPresent = Boolean(finalWindow?.hwnd || finalWindow?.title);
  const interactionReady = readiness === 'ready';

  return {
    actionCandidates: actionCandidates.length ? actionCandidates : null,
    appExecutionProfile: 'unknown',
    captureAvailable: null,
    confidence: bestMatchedAction ? getWindowUiControlConfidence(bestMatchedAction) : targetCandidates.length ? 'medium' : 'low',
    coordinateConfidence: bestCenter ? 'high' : targetCandidates.length || actionCandidates.length ? 'medium' : 'low',
    currentSelection: selectionEvidence.currentSelection,
    elementBounds: bestBounds,
    elementCenter: bestCenter,
    elementDescription: bestMatchedAction ? getWindowUiControlLabel(bestMatchedAction) : null,
    desktopTargetPresence: interactionReady ? 'present_interactable' : 'present_unreadable',
    finalWindow,
    foreground: null,
    interactionReady,
    launcherVerification: targetInteractionVerification,
    primaryAction,
    postActionRecovery,
    postActionState,
    processPresent,
    relation,
    selectionEvidence: selectionEvidence.selectionEvidence.length ? selectionEvidence.selectionEvidence : null,
    selectionVerificationStatus: selectionEvidence.selectionVerificationStatus,
    status: result.ok ? 'success' : 'failed',
    targetCandidates: targetCandidates.length ? targetCandidates : null,
    targetMatched,
    targetInteractionVerification,
    uiAutomationAvailable: true,
    visibleTextCandidates: controls
      .map((control) => control.name?.trim())
      .filter((name): name is string => Boolean(name))
      .slice(0, 20),
    visualReadable: null,
    visualActionReadiness: readiness,
    windowPresent,
  };
}
