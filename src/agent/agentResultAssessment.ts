import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
  type AgentChatResultAssessment,
  type AgentStructuredToolEvidence,
  type AgentToolStateSummary,
} from './agentChatCommand';
import { createAgentToolCommand } from './runtime/agentToolCommandFactory';
import { buildAgentPermissionRoute } from './agentPermissionRouter';
import { getAgentToolLifecycleMetadata } from './agentToolRegistry';
import {
  isAgentExecutionStrategyAmbiguousTargetText,
  isAgentExecutionStrategySafeKeyboardContinuationTarget,
} from './agentExecutionStrategy';
import { isAgentReadOnlyObservationForVisualLocateRequest } from './agentReadOnlyActionCompletionEvidence';
import { hasAgentEffectiveDirectActionIntent } from './runtime/agentActionCoverage';
import {
  hasAgentAuthenticationHardGateCue,
  hasAgentAuthenticationManualVerificationCue,
} from './runtime/agentAuthenticationGate';
import { resolveAgentTargetInteractionVerification } from './runtime/agentRuntimeVerificationEvidence';

type AgentRunnableFollowUpAction = Extract<AgentChatFollowUpAction, { kind: 'run-command' }>;

export function resolveAgentResultFollowUpActions(result: AgentChatCommandResult) {
  return result.followUpActions?.length
    ? result.followUpActions
    : result.followUpAction
      ? [result.followUpAction]
      : [];
}

function compactAgentResultText(value: string | null | undefined, maxLength = 900) {
  const normalizedValue = value?.replace(/\s+/gu, ' ').trim() ?? '';
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 3))}...`;
}

function compactAgentAssessmentEvidence(lines: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return lines
    .map((line) => line?.trim() ?? '')
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .slice(0, 6);
}

function compactAgentFollowUpActions(actions: AgentChatFollowUpAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.kind === 'run-command'
      ? `${action.kind}:${action.command.kind}:${action.command.toolCall?.name ?? ''}:${action.label}`
      : `${action.kind}:${action.label}:${action.prompt}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, 4);
}

function getAgentResultStructuredEvidenceRecord(result: AgentChatCommandResult): Record<string, unknown> | null {
  const evidence = result.stateSummary?.structuredEvidence ?? result.receipt?.stateSummary?.structuredEvidence;
  return evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    ? evidence as Record<string, unknown>
    : null;
}

function collectAgentResultAssessmentText(result: AgentChatCommandResult) {
  return [
    result.responseText,
    result.verification,
    result.receipt?.verification,
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.stateSummary?.missingEvidence ?? []),
    ...(result.stateSummary?.recommendedRecovery ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.receipt?.summaryLines ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC');
}

function inferAgentLoginContinuationFocusQuery(
  sourceText: string,
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  const input = command.toolCall?.input ?? {};
  const explicitQuery = [
    input.sourceQuery,
    input.windowQuery,
    input.windowTitle,
    input.sourceName,
  ].find((value) => typeof value === 'string' && value.trim());
  if (typeof explicitQuery === 'string' && explicitQuery.trim()) {
    return explicitQuery.trim();
  }

  const evidence = getAgentResultStructuredEvidence(result);
  const candidateWindow = [
    evidence?.finalWindow,
    ...(evidence?.actionCandidates ?? []).map((candidate) => candidate.window),
    ...(evidence?.targetCandidates ?? []).map((candidate) => candidate.window),
  ].find((window) => window?.title?.trim() || window?.processName?.trim());
  return candidateWindow?.title?.trim() || candidateWindow?.processName?.trim() || '';
}

function getAgentResultPostActionState(result: AgentChatCommandResult) {
  const record = getAgentResultStructuredEvidenceRecord(result);
  const explicit = typeof record?.postActionState === 'string'
    ? record.postActionState.trim().toLowerCase()
    : '';
  if (explicit) {
    return explicit;
  }

  const text = collectAgentResultAssessmentText(result).toLowerCase();
  const match = text.match(/post-action\s+(?:visual\s+)?state\s*:\s*([a-z_]+)/iu);
  return match?.[1]?.trim().toLowerCase() ?? '';
}

function getAgentResultActionLifecycleStatus(result: AgentChatCommandResult) {
  const record = getAgentResultStructuredEvidenceRecord(result);
  const lifecycle = record?.actionLifecycle && typeof record.actionLifecycle === 'object'
    ? record.actionLifecycle as Record<string, unknown>
    : null;
  return typeof lifecycle?.status === 'string'
    ? lifecycle.status.trim().toLowerCase()
    : '';
}

function createAgentLifecycleRecoveryCommand(
  sourceText: string,
  result: AgentChatCommandResult,
): AgentChatCommand | null {
  const record = getAgentResultStructuredEvidenceRecord(result);
  const recovery = record?.postActionRecovery && typeof record.postActionRecovery === 'object'
    ? record.postActionRecovery as Record<string, unknown>
    : null;
  const nextTool = typeof recovery?.nextTool === 'string' ? recovery.nextTool.trim() : '';
  const nextArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object' && !Array.isArray(recovery.nextArgs)
    ? recovery.nextArgs as Record<string, unknown>
    : {};
  if (nextTool !== 'execute_desktop_observation' && nextTool !== 'locate_screen_elements') {
    return null;
  }

  return {
    capabilityId: 'desktop-observation',
    instruction: nextTool === 'execute_desktop_observation'
      ? 'Run lifecycle observation recovery'
      : 'Run lifecycle visual recovery',
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: 'Continue the action lifecycle with the recommended read-only recovery.',
      input: nextArgs,
      name: nextTool,
    },
  };
}

function hasAgentResultLoginContinuationCue(result: AgentChatCommandResult) {
  const text = collectAgentResultAssessmentText(result);
  return /(?:快速安全登录|安全登录|快速登录|登录|登陆|sign\s*in|log\s*in|continue|confirm|ok)/iu.test(text)
    && !hasAgentAuthenticationManualVerificationCue(text);
}

function getAgentResultStructuredEvidence(result: AgentChatCommandResult): AgentStructuredToolEvidence | null {
  return result.stateSummary?.structuredEvidence ?? result.receipt?.stateSummary?.structuredEvidence ?? null;
}

function isAgentResultLowConfidenceVisualEvidence(evidence: AgentStructuredToolEvidence | null) {
  const targetInteractionVerification = resolveAgentTargetInteractionVerification(evidence);
  return Boolean(
    evidence
    && (
      evidence.confidence === 'low'
      || evidence.coordinateConfidence === 'low'
      || evidence.visualActionReadiness === 'low-confidence'
      || targetInteractionVerification?.status === 'low-confidence'
      || evidence.coordinateAuditStatus === 'coordinate_unknown'
      || evidence.coordinateAudit?.status === 'coordinate_unknown'
    ),
  );
}

function isAgentResultSafeLoginContinuationEvidence(evidence: AgentStructuredToolEvidence | null) {
  if (!evidence) {
    return false;
  }
  const targetInteractionVerification = resolveAgentTargetInteractionVerification(evidence);

  if (evidence.visualActionReadiness && evidence.visualActionReadiness !== 'ready') {
    return false;
  }

  if (targetInteractionVerification?.status && targetInteractionVerification.status !== 'ready') {
    return false;
  }

  if (targetInteractionVerification?.targetSelected === false || targetInteractionVerification?.detailMatchesTarget === false) {
    return false;
  }

  if (targetInteractionVerification && targetInteractionVerification.primaryActionMatchesTarget !== true) {
    return false;
  }

  if (evidence.selectionVerificationStatus === 'visible-only' || evidence.selectionVerificationStatus === 'mismatch') {
    return false;
  }

  if (evidence.confidence === 'low' || evidence.coordinateConfidence === 'low') {
    return false;
  }

  const primaryActionText = evidence?.primaryAction?.trim() ?? '';
  const targetText = evidence?.targetMatched?.trim() ?? '';
  const combinedText = [primaryActionText, targetText].filter(Boolean).join('\n');
  if (!combinedText || isAgentExecutionStrategyAmbiguousTargetText(combinedText)) {
    return false;
  }

  return isAgentExecutionStrategySafeKeyboardContinuationTarget(combinedText);
}

function isAgentResultLoginContinuationEvidenceUnclear(result: AgentChatCommandResult) {
  const evidence = getAgentResultStructuredEvidence(result);
  if (!evidence || evidence.postActionState !== 'login_required') {
    return false;
  }
  const targetInteractionVerification = resolveAgentTargetInteractionVerification(evidence);

  if (isAgentResultSafeLoginContinuationEvidence(evidence)) {
    return false;
  }

  const text = collectAgentResultAssessmentText(result);
  const primaryActionText = evidence.primaryAction?.trim() ?? '';
  const targetText = evidence.targetMatched?.trim() ?? '';
  const relationText = evidence.relation?.trim() ?? '';
  if (
    isAgentExecutionStrategyAmbiguousTargetText([primaryActionText, targetText].filter(Boolean).join('\n'))
    || /(?:未明确|目标未匹配|不明确|ambiguous|unclear target|target\s+not\s+matched|not\s+matched)/iu.test([
      primaryActionText,
      targetText,
      relationText,
    ].join('\n'))
  ) {
    return false;
  }

  return Boolean(
    (evidence.visualActionReadiness === 'ready' || evidence.visualActionReadiness === 'low-confidence')
      && (
        /(?:无法确认|不能确认|未确认|不确定|unclear|not\s+confirmed|cannot\s+confirm)/iu.test(text)
        || hasAgentResultSafeLoginControlCue(result)
        || targetInteractionVerification?.status === 'needs-relation'
        || targetInteractionVerification?.status === 'low-confidence'
        || targetInteractionVerification?.primaryActionMatchesTarget === false
      ),
  );
}

function hasAgentResultSafeLoginControlCue(result: AgentChatCommandResult) {
  const text = collectAgentResultAssessmentText(result);
  return /(?:快速安全登录|安全登录|快速登录|登录|log\s*in|sign\s*in|continue|confirm|ok|蹇€熷畨鍏ㄧ櫥褰晐瀹夊叏鐧诲綍|蹇€熺櫥褰晐鐧诲綍|鐧婚檰)/iu.test(text);
}

function hasAgentResultHardLoginGateCue(result: AgentChatCommandResult) {
  const text = collectAgentResultAssessmentText(result);
  return hasAgentAuthenticationHardGateCue(text);
}

function resolveAgentResultCandidatePoint(
  candidate: NonNullable<AgentStructuredToolEvidence['actionCandidates']>[number],
  evidence: AgentStructuredToolEvidence,
) {
  const bounds = candidate.bounds;
  const boundsX = Number(bounds?.x);
  const boundsY = Number(bounds?.y);
  const boundsWidth = Number(bounds?.width);
  const boundsHeight = Number(bounds?.height);
  const boundsSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (
    [boundsX, boundsY, boundsWidth, boundsHeight].every(Number.isFinite)
    && boundsWidth > 0
    && boundsHeight > 0
  ) {
    if (boundsSpace === 'native-screen') {
      return {
        x: Math.round(boundsX + boundsWidth / 2),
        y: Math.round(boundsY + boundsHeight / 2),
      };
    }

    const sourceX = Number(evidence.sourceBounds?.x);
    const sourceY = Number(evidence.sourceBounds?.y);
    const sourceWidth = Number(evidence.sourceBounds?.width);
    const sourceHeight = Number(evidence.sourceBounds?.height);
    const sourceSpace = evidence.sourceBounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
    if (
      sourceSpace === 'native-screen'
      && [sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite)
      && sourceWidth > 0
      && sourceHeight > 0
    ) {
      return {
        x: Math.round(sourceX + sourceWidth * (boundsX + boundsWidth / 2)),
        y: Math.round(sourceY + sourceHeight * (boundsY + boundsHeight / 2)),
      };
    }
  }

  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  const centerSpace = candidate.center?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (centerSpace === 'native-screen' && Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return { x: Math.round(centerX), y: Math.round(centerY) };
  }

  const ratioX = Number(candidate.centerRatio?.x);
  const ratioY = Number(candidate.centerRatio?.y);
  const sourceX = Number(evidence.sourceBounds?.x);
  const sourceY = Number(evidence.sourceBounds?.y);
  const sourceWidth = Number(evidence.sourceBounds?.width);
  const sourceHeight = Number(evidence.sourceBounds?.height);
  if (
    Number.isFinite(ratioX)
    && Number.isFinite(ratioY)
    && ratioX >= 0
    && ratioX <= 1
    && ratioY >= 0
    && ratioY <= 1
    && [sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite)
    && sourceWidth > 0
    && sourceHeight > 0
  ) {
    return {
      x: Math.round(sourceX + sourceWidth * ratioX),
      y: Math.round(sourceY + sourceHeight * ratioY),
    };
  }

  return null;
}

function isAgentResultLoginActionCandidate(
  candidate: NonNullable<AgentStructuredToolEvidence['actionCandidates']>[number],
) {
  return /(?:login|log\s*in|sign\s*in|continue|confirm|submit|\u767b\u5f55|\u767b\u9646|\u7ee7\u7eed|\u786e\u8ba4|\u63d0\u4ea4)/iu.test([
    candidate.label,
    candidate.name,
    candidate.description,
    candidate.relation,
  ].filter(Boolean).join('\n'));
}

function resolveAgentResultLoginContinuationPoint(result: AgentChatCommandResult) {
  const evidence = getAgentResultStructuredEvidence(result);
  if (evidence?.captureSourceType !== 'window') {
    return null;
  }
  const auditStatus = evidence?.coordinateAuditStatus ?? evidence?.coordinateAudit?.status ?? null;
  if (auditStatus && auditStatus !== 'coordinate_ok') {
    return null;
  }

  const actionCandidates = evidence?.actionCandidates ?? [];
  const loginCandidate = actionCandidates.find((candidate) => (
    candidate.enabled !== false
    && candidate.offscreen !== true
    && isAgentResultLoginActionCandidate(candidate)
    && resolveAgentResultCandidatePoint(candidate, evidence)
  ));
  const candidatePoint = loginCandidate
    ? resolveAgentResultCandidatePoint(loginCandidate, evidence)
    : null;
  if (candidatePoint) {
    return candidatePoint;
  }

  const ratioX = Number(evidence?.elementCenterRatio?.x);
  const ratioY = Number(evidence?.elementCenterRatio?.y);
  const sourceX = Number(evidence?.sourceBounds?.x);
  const sourceY = Number(evidence?.sourceBounds?.y);
  const sourceWidth = Number(evidence?.sourceBounds?.width);
  const sourceHeight = Number(evidence?.sourceBounds?.height);
  const sourceSpace = evidence?.sourceBounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (
    Number.isFinite(ratioX)
    && Number.isFinite(ratioY)
    && ratioX >= 0
    && ratioX <= 1
    && ratioY >= 0
    && ratioY <= 1
    && [sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite)
    && sourceWidth > 0
    && sourceHeight > 0
    && sourceSpace === 'native-screen'
  ) {
    return {
      x: Math.round(sourceX + sourceWidth * ratioX),
      y: Math.round(sourceY + sourceHeight * ratioY),
    };
  }

  const x = Number(evidence?.elementCenter?.x);
  const y = Number(evidence?.elementCenter?.y);
  const pointSpace = evidence?.elementCenter?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (
    Number.isFinite(x)
    && Number.isFinite(y)
    && pointSpace === 'native-screen'
    && auditStatus === 'coordinate_ok'
  ) {
    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  return null;
}

function createAgentLoginContinuationExecuteCommand(
  sourceText: string,
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommand | null {
  if (hasAgentResultHardLoginGateCue(result) && !hasAgentResultSafeLoginControlCue(result)) {
    return null;
  }

  const point = resolveAgentResultLoginContinuationPoint(result);
  if (!point) {
    return null;
  }

  const evidence = getAgentResultStructuredEvidence(result);
  if (
    !isAgentResultSafeLoginContinuationEvidence(evidence)
    && !isAgentResultLoginContinuationEvidenceUnclear(result)
  ) {
    return null;
  }

  const targetText = evidence?.primaryAction?.trim()
    || evidence?.targetMatched?.trim()
    || 'safe login continuation button';
  const userGoal = command.toolCall?.goal || command.sourceText || sourceText;
  const focusQuery = inferAgentLoginContinuationFocusQuery(sourceText, command, result);
  const targetWindowHwnd = Number(evidence?.finalWindow?.hwnd);
  const targetWindowPid = Number(evidence?.finalWindow?.pid);
  const focusStep = focusQuery
    ? {
        args: {
          action: 'focus_window',
          query: focusQuery,
        },
        reason: `Focus "${focusQuery}" before synthetic login input so the click is delivered to the target app, not the Agent/chat window.`,
        tool: 'execute_desktop_action' as const,
      }
    : null;

  if (!Number.isFinite(targetWindowHwnd) || targetWindowHwnd <= 0) {
    return null;
  }

  return createAgentToolCommand({
    args: {
      executionStrategy: 'coordinate',
      executionStrategyReason: isAgentResultSafeLoginContinuationEvidence(evidence)
        ? `Safe login continuation control is visible with audited coordinates (${point.x}, ${point.y}).`
        : `Login continuation control is visible with audited coordinates (${point.x}, ${point.y}); user approval is required because credential/button certainty is incomplete.`,
      postVerify: true,
      postVerifyRequired: true,
      postVerifyQuery: userGoal,
      postVerifyVisualQuery: userGoal,
      stepsJson: JSON.stringify([
        ...(focusStep ? [focusStep] : []),
        {
          args: {
            action: 'click',
            button: 'left',
            coordinateSpace: 'native-screen',
            holdMs: 140,
            intervalMs: 160,
            preClickDelayMs: 180,
            forceMouseEventFallback: true,
            ...(Number.isFinite(targetWindowHwnd) && targetWindowHwnd > 0
              ? { expectedForegroundHwnd: Math.round(targetWindowHwnd) }
              : {}),
            ...(Number.isFinite(targetWindowPid) && targetWindowPid > 0
              ? { expectedForegroundPid: Math.round(targetWindowPid) }
              : {}),
            repeat: 1,
            x: point.x,
            y: point.y,
          },
          reason: `Click safe login continuation control "${targetText}" at audited native-screen coordinate (${point.x}, ${point.y}) with single click, preClickDelayMs=180, holdMs=140, intervalMs=160, and forced mouse_event fallback.`,
          tool: 'execute_desktop_input',
        },
        {
          args: {
            action: 'send_keys',
            keys: '{ENTER}',
          },
          reason: 'Fallback: send Enter after login continuation click in case the launcher button accepted focus/hover but ignored injected mouse-up.',
          tool: 'execute_desktop_input',
        },
      ]),
    },
    sourceText,
    toolName: 'execute_desktop_sequence',
    userGoal,
  });
}

function createAgentLoginContinuationLocateCommand(
  sourceText: string,
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommand {
  const input = command.toolCall?.input ?? {};
  const record = getAgentResultStructuredEvidenceRecord(result);
  const windowRecord = record?.finalWindow && typeof record.finalWindow === 'object'
    ? record.finalWindow as Record<string, unknown>
    : null;
  const queryCandidates = [
    inferAgentLoginContinuationFocusQuery(sourceText, command, result),
    typeof input.query === 'string' ? input.query : null,
    typeof input.target === 'string' ? input.target : null,
    typeof record?.targetMatched === 'string' ? record.targetMatched : null,
    typeof windowRecord?.title === 'string' ? windowRecord.title : null,
    typeof windowRecord?.processName === 'string' ? windowRecord.processName : null,
    command.toolCall?.goal,
  ];
  const query = queryCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() ?? '';
  return {
    capabilityId: 'desktop-observation',
    instruction: 'Locate safe login continuation control',
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: 'Locate a safe login continuation button after the launcher opened.',
      input: {
        action: 'describe_elements',
        forceRefresh: true,
        question: [
          'The app appears to be on a login/account page.',
          'Locate safe login continuation controls such as 快速安全登录, 安全登录, 快速登录, 登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered.',
          'Also report captcha, QR-code scan, SMS code, two-factor verification, empty required input, or admin/UAC gates. Do not click anything.',
        ].join(' '),
        ...(query ? { sourceQuery: query } : {}),
        targetDescription: 'safe login continuation controls and non-automatable verification gates',
        targetText: '快速安全登录 安全登录 快速登录 登录 Sign in Log in Continue Confirm OK',
      },
      name: 'locate_screen_elements',
    },
  };
}

function createAgentVisualLocateRecoveryCommand(
  sourceText: string,
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommand | null {
  if (command.toolCall?.name !== 'observe_windows_and_apps') {
    return null;
  }

  const input = command.toolCall.input ?? {};
  const resultGoalText = (result.observations ?? [])
    .map((line) => /^Goal:\s*(.+)$/iu.exec(line)?.[1]?.trim() ?? '')
    .filter(Boolean)
    .join('\n');
  const requestText = [
    command.sourceText,
    command.instruction,
    command.toolCall.goal,
    result.assessment?.nextStep,
    result.followUp,
    resultGoalText,
  ].filter(Boolean).join('\n').normalize('NFKC');
  const text = [
    requestText,
    collectAgentResultAssessmentText(result),
  ].filter(Boolean).join('\n').normalize('NFKC');
  const wantsVisualLocate = /(?:locate|find|where|position|button|ui\s*element|screen\s*element|login|log\s*in|sign\s*in|定位|找|位置|按钮|登录|登入|登陆)/iu.test(requestText);
  if (!wantsVisualLocate) {
    return null;
  }

  const explicitSourceQuery = [
    input.sourceQuery,
    input.windowQuery,
    input.windowTitle,
    input.query,
  ].find((value) => typeof value === 'string' && value.trim());
  const record = getAgentResultStructuredEvidence(result);
  const evidenceWindow = record?.finalWindow;
  const candidateWindow = [
    evidenceWindow,
    ...(record?.actionCandidates ?? []).map((candidate) => candidate.window),
    ...(record?.targetCandidates ?? []).map((candidate) => candidate.window),
  ].find((window) => window?.title?.trim() || window?.processName?.trim());
  const sourceQuery = (typeof explicitSourceQuery === 'string' && explicitSourceQuery.trim())
    || candidateWindow?.title?.trim()
    || candidateWindow?.processName?.trim()
    || '';
  const isLoginTarget = /(?:login|log\s*in|sign\s*in|登录|登入|登陆)/iu.test(text);
  const targetText = isLoginTarget
    ? '登录 登入 登陆 Sign in Log in Login Continue Confirm OK'
    : 'button control primary action';

  return {
    capabilityId: 'desktop-observation',
    instruction: isLoginTarget
      ? 'Locate login button visually'
      : 'Locate requested UI control visually',
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: isLoginTarget
        ? 'Locate the login button in the target app window.'
        : 'Locate the requested UI element in the target app window.',
      input: {
        action: 'describe_elements',
        forceRefresh: true,
        question: isLoginTarget
          ? 'Locate the visible login/sign-in button. Report elementCenter, elementCenterRatio, elementRegion, confidence, and whether captcha, QR scan, SMS/2FA, empty credentials, or admin/UAC gates are present. Do not click anything.'
          : 'Locate the requested visible UI control. Report elementCenter, elementCenterRatio, elementRegion, confidence, and uncertainty. Do not click anything.',
        ...(sourceQuery ? { sourceQuery } : {}),
        targetDescription: isLoginTarget
          ? 'login/sign-in button and non-automatable verification gates'
          : 'requested UI control or primary action',
        targetText,
      },
      name: 'locate_screen_elements',
    },
  };
}

function createAgentWaitAndObserveCommand(
  sourceText: string,
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommand {
  const input = command.toolCall?.input ?? {};
  const record = getAgentResultStructuredEvidenceRecord(result);
  const query = [
    typeof input.query === 'string' ? input.query : null,
    typeof input.target === 'string' ? input.target : null,
    typeof record?.targetMatched === 'string' ? record.targetMatched : null,
    command.toolCall?.goal,
  ].find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() ?? '';
  return {
    capabilityId: 'desktop-observation',
    instruction: 'Wait for the app to finish loading',
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: 'Wait for the app to finish loading before deciding the next action.',
      input: {
        action: 'wait_and_observe',
        forceRefresh: true,
        includeVisual: true,
        limit: 12,
        ...(query ? { query } : {}),
        question: 'The app is still loading. Wait briefly, then report whether it is ready, still loading, on a login page, blocked, or errored.',
        recoveryPostActionState: 'loading',
        waitMs: 3000,
      },
      name: 'execute_desktop_observation',
    },
  };
}

function createAgentRetryCommand(
  sourceText: string,
  command: AgentChatCommand,
): AgentChatCommand {
  const targetText = [
    command.toolCall?.goal,
    command.instruction,
    command.sourceText,
    sourceText,
  ].find((value) => typeof value === 'string' && value.trim())?.trim()
    || 'the requested action';

  return {
    ...command,
    instruction: `Retry the same logical action for: ${targetText}. Re-observe the current state first, preserve the original target and parameters, and do not claim success without fresh evidence.`,
    sourceText: sourceText.trim() || command.sourceText,
    toolCall: command.toolCall
      ? {
          ...command.toolCall,
          goal: `Retry the same logical action for: ${targetText}.`,
        }
      : command.toolCall,
  };
}

function createAgentReobserveCommand(
  sourceText: string,
  command: AgentChatCommand,
): AgentChatCommand | null {
  if (command.kind === 'desktop-organization' || command.toolCall?.name === 'organize_desktop_icons') {
    const organization = command.desktopOrganization ?? {
      displayTarget: typeof command.toolCall?.input.targetDisplay === 'string'
        ? command.toolCall.input.targetDisplay as NonNullable<AgentChatCommand['desktopOrganization']>['displayTarget']
        : typeof command.toolCall?.input.displayTarget === 'string'
          ? command.toolCall.input.displayTarget as NonNullable<AgentChatCommand['desktopOrganization']>['displayTarget']
          : undefined,
      groupBy: typeof command.toolCall?.input.groupBy === 'string'
        ? command.toolCall.input.groupBy as NonNullable<AgentChatCommand['desktopOrganization']>['groupBy']
        : undefined,
      scope: typeof command.toolCall?.input.sourceScope === 'string'
        ? command.toolCall.input.sourceScope as NonNullable<AgentChatCommand['desktopOrganization']>['scope']
        : typeof command.toolCall?.input.scope === 'string'
          ? command.toolCall.input.scope as NonNullable<AgentChatCommand['desktopOrganization']>['scope']
          : undefined,
      sourceDisplay: typeof command.toolCall?.input.sourceDisplay === 'string'
        ? command.toolCall.input.sourceDisplay as NonNullable<AgentChatCommand['desktopOrganization']>['sourceDisplay']
        : undefined,
      targetDisplay: typeof command.toolCall?.input.targetDisplay === 'string'
        ? command.toolCall.input.targetDisplay as NonNullable<AgentChatCommand['desktopOrganization']>['targetDisplay']
        : undefined,
    };
    const displayTarget = organization.targetDisplay ?? organization.displayTarget;
    const sourceScope = organization.sourceScope ?? organization.scope;

    return {
      capabilityId: 'desktop-organization',
      desktopOrganization: {
        displayTarget,
        groupBy: organization.groupBy,
        mode: 'preview',
        scope: sourceScope,
        sourceDisplay: organization.sourceDisplay,
        sourceScope,
        targetDisplay: displayTarget,
      },
      instruction: 'Re-observe the current desktop icon layout and preserve the original organization scope before deciding whether a new preview or execution is safe.',
      kind: 'desktop-organization',
      sourceText,
    };
  }

  if (command.kind === 'desktop-icon-placement' || command.toolCall?.name === 'place_desktop_icon') {
    return createAgentRetryCommand(sourceText, command);
  }

  if (command.toolCall?.name === 'inspect_local_project' || command.toolCall?.name === 'run_local_project_action') {
    const input = command.toolCall.input ?? {};
    const localPath = input.path ?? input.projectPath ?? input.folderPath ?? input.filePath ?? input.query;
    if (typeof localPath !== 'string' || !localPath.trim()) {
      return null;
    }

    return {
      capabilityId: 'local-project-inspector',
      instruction: 'Reinspect local project',
      kind: 'tool-call',
      sourceText,
      toolCall: {
        goal: 'Reinspect local project',
        input: {
          path: localPath,
          question: sourceText,
        },
        name: 'inspect_local_project',
      },
    };
  }

  if (
    command.toolCall?.name === 'get_display_info'
    || command.toolCall?.name === 'get_system_info'
    || command.kind === 'app-launch'
    || command.toolCall?.name === 'launch_local_app'
  ) {
    return createAgentRetryCommand(sourceText, command);
  }

  return null;
}

function isDesktopOrganizationExecuteCommand(command: AgentChatCommand) {
  return command.kind === 'desktop-organization'
    ? command.desktopOrganization?.mode === 'execute'
    : command.toolCall?.name === 'organize_desktop_icons'
      && command.toolCall.input?.mode === 'execute';
}

function shouldOfferRunCommandRecovery(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  if (result.ok === false && isDesktopOrganizationExecuteCommand(command)) {
    return false;
  }

  return true;
}

export function createAgentRecoveryFollowUpActions(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatFollowUpAction[] {
  const assessmentStatus = result.assessment?.status;
  if (assessmentStatus === 'completed') {
    return [];
  }

  const actions = [...resolveAgentResultFollowUpActions(result)];
  const sourceText = result.assessment?.nextStep ?? result.followUp ?? command.sourceText;
  const shouldRetry = assessmentStatus === 'unverified' || assessmentStatus === 'failed';
  const shouldAskUser = assessmentStatus === 'needs-user'
    || (result.ok === false && Boolean(result.followUp || result.errorText));
  const canOfferRunCommandRecovery = shouldOfferRunCommandRecovery(command, result);
  const reobserveCommand = createAgentReobserveCommand(`continue: re-observe and verify ${command.sourceText}`, command);
  const postActionState = getAgentResultPostActionState(result);
  const actionLifecycleStatus = getAgentResultActionLifecycleStatus(result);
  const structuredEvidence = getAgentResultStructuredEvidence(result);
  const hasLowConfidenceVisualEvidence = isAgentResultLowConfidenceVisualEvidence(structuredEvidence);
  const lifecycleRecoveryCommand = createAgentLifecycleRecoveryCommand(
    `continue: ${actionLifecycleStatus || 'action-lifecycle'} recovery`,
    result,
  );
  const visualLocateRecoveryCommand = createAgentVisualLocateRecoveryCommand(
    `continue: visually locate requested control`,
    command,
    result,
  );
  const shouldLocateLoginContinuation = canOfferRunCommandRecovery
    && shouldRetry
    && (!hasLowConfidenceVisualEvidence || Boolean(resolveAgentResultLoginContinuationPoint(result)))
    && (
      (actionLifecycleStatus === 'needs_observation' && postActionState === 'login_required')
      || postActionState === 'login_required'
      || hasAgentResultLoginContinuationCue(result)
    );
  const shouldWaitForLoading = canOfferRunCommandRecovery
    && shouldRetry
    && !shouldLocateLoginContinuation
    && (
      actionLifecycleStatus === 'unverified_wait'
      || postActionState === 'loading'
      || postActionState === 'waiting_window'
      || postActionState === 'waiting_target'
    );
  const shouldUseLifecycleReadRecovery = canOfferRunCommandRecovery
    && shouldRetry
    && !shouldLocateLoginContinuation
    && !shouldWaitForLoading
    && Boolean(lifecycleRecoveryCommand)
    && (
      actionLifecycleStatus === 'needs_observation'
      || actionLifecycleStatus === 'fallback_available'
      || actionLifecycleStatus === 'failed_no_effect'
    );

  if (shouldLocateLoginContinuation) {
    const executeLoginCommand = createAgentLoginContinuationExecuteCommand(
      'continue: click safe login continuation control',
      command,
      result,
    );
    if (executeLoginCommand) {
      actions.push({
        command: executeLoginCommand,
        kind: 'run-command',
        label: 'Click login button',
        requiresApproval: true,
      });
    } else {
      actions.push({
        command: createAgentLoginContinuationLocateCommand(
          'continue: locate safe login continuation control',
          command,
          result,
        ),
        kind: 'run-command',
        label: 'Locate login button',
      });
    }
  }

  if (shouldWaitForLoading) {
    actions.push({
      command: lifecycleRecoveryCommand ?? createAgentWaitAndObserveCommand(
        'continue: wait for app loading',
        command,
        result,
      ),
      kind: 'run-command',
      label: 'Wait for app readiness',
    });
  }

  if (shouldUseLifecycleReadRecovery && lifecycleRecoveryCommand) {
    actions.push({
      command: lifecycleRecoveryCommand,
      kind: 'run-command',
      label: actionLifecycleStatus === 'failed_no_effect'
        ? 'Diagnose no effect'
        : 'Continue lifecycle recovery',
    });
  }

  if (shouldRetry && !shouldLocateLoginContinuation && !shouldWaitForLoading && !shouldUseLifecycleReadRecovery && visualLocateRecoveryCommand && canOfferRunCommandRecovery) {
    actions.push({
      command: visualLocateRecoveryCommand,
      kind: 'run-command',
      label: /(?:login|log\s*in|sign\s*in|登录|登入|登陆)/iu.test([
        sourceText,
        command.sourceText,
        command.instruction,
        command.toolCall?.goal,
      ].filter(Boolean).join('\n').normalize('NFKC'))
        ? 'Locate login button'
        : 'Locate UI control',
    });
  }

  if (shouldRetry && !shouldLocateLoginContinuation && !shouldWaitForLoading && !shouldUseLifecycleReadRecovery && !visualLocateRecoveryCommand && reobserveCommand && canOfferRunCommandRecovery) {
    actions.push({
      command: reobserveCommand,
      kind: 'run-command',
      label: command.kind === 'app-launch' || command.toolCall?.name === 'launch_local_app'
        ? 'Find window again'
        : 'Re-observe and verify',
    });
  }

  if (shouldRetry && !shouldLocateLoginContinuation && !shouldWaitForLoading && !shouldUseLifecycleReadRecovery && !visualLocateRecoveryCommand && !reobserveCommand && canOfferRunCommandRecovery) {
    actions.push({
      command: createAgentRetryCommand(`continue: retry ${command.sourceText}`, command),
      kind: 'run-command',
      label: 'Retry once',
      requiresApproval: command.kind !== 'tool-call'
        || command.toolCall?.name === 'run_local_project_action'
        || command.toolCall?.name === 'launch_local_app',
    });
  }

  if (shouldAskUser) {
    actions.push({
      kind: 'ask-user',
      label: 'Need details',
      prompt: result.followUp || result.errorText || result.assessment?.nextStep || 'Please provide more detail so I can continue.',
    });
  }

  if (assessmentStatus === 'can-continue' && !actions.length && result.followUp) {
    actions.push({
      kind: 'ask-user',
      label: 'Continue note',
      prompt: result.followUp,
    });
  }

  return compactAgentFollowUpActions(actions).map((action) => (
    action.kind === 'run-command'
      ? {
          ...action,
          command: {
            ...action.command,
            sourceText: action.command.sourceText || sourceText,
          },
        }
      : action
  ));
}

export function createAgentDecisionSummary(result: AgentChatCommandResult, followUpActions: AgentChatFollowUpAction[]) {
  const status = result.assessment?.status ?? 'unverified';
  if (status === 'completed') {
    return 'Result verified; ready for character reply';
  }

  if (status === 'can-continue') {
    return followUpActions.length
      ? `Can continue: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Result can continue, but no direct action was prepared';
  }

  if (status === 'needs-user') {
    return followUpActions.length
      ? `Needs user input: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Needs user input before continuing';
  }

  if (status === 'failed') {
    return followUpActions.length
      ? `Execution failed; recovery options: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Execution failed; no reliable recovery action is available';
  }

  return followUpActions.length
    ? `Result is not fully verified; recovery options: ${followUpActions.map((action) => action.label).join(', ')}`
    : 'Result is not fully verified; waiting for whether to continue';
}
function compactAgentToolStateItems(
  lines: Array<string | null | undefined>,
  options: {
    maxItems?: number;
    maxLength?: number;
  } = {},
) {
  const maxItems = options.maxItems ?? 8;
  const maxLength = options.maxLength ?? 220;
  const seen = new Set<string>();

  return lines
    .map((line) => compactAgentResultText(line, maxLength))
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .slice(0, maxItems);
}

function createOptionalAgentToolStateItems(lines: Array<string | null | undefined>) {
  const items = compactAgentToolStateItems(lines);
  return items.length ? items : undefined;
}

function resolveAgentCommandToolName(command: AgentChatCommand) {
  if (command.toolCall?.name) {
    return command.toolCall.name;
  }

  if (command.kind === 'app-launch') {
    return 'launch_local_app';
  }

  if (command.kind === 'app-alias-save') {
    return 'remember_local_app';
  }

  if (command.kind === 'desktop-organization') {
    return 'organize_desktop_icons';
  }

  if (command.kind === 'desktop-icon-placement') {
    return 'place_desktop_icon';
  }

  return null;
}

function hasAgentResultEvidence(result: AgentChatCommandResult) {
  return Boolean(
    result.verification
    || result.receipt?.verification
    || result.receipt?.status === 'success'
    || result.receipt?.evidenceLines?.length
    || result.observations?.length
    || result.stateSummary?.observedState?.length
    || result.stateSummary?.verificationEvidence?.length
    || result.receipt?.stateSummary?.observedState?.length
    || result.receipt?.stateSummary?.verificationEvidence?.length,
  );
}

function normalizeAgentAssessmentSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
    : '';
}

function isAgentReadonlyObservationTool(command: AgentChatCommand) {
  const toolName = resolveAgentCommandToolName(command);
  if (
    toolName === 'observe_windows_and_apps'
    || toolName === 'list_running_apps'
    || toolName === 'get_active_window_info'
    || toolName === 'get_display_info'
    || toolName === 'locate_screen_elements'
    || toolName === 'execute_memory_action'
  ) {
    return true;
  }

  if (toolName === 'execute_desktop_observation') {
    return true;
  }

  if (toolName === 'execute_desktop_action') {
    const action = normalizeAgentAssessmentSearchText(command.toolCall?.input.action);
    return action === 'list_running_apps'
      || action === 'get_active_window_info'
      || action === 'get_default_app_for_uri';
  }

  return false;
}

function isAgentReadOnlyObservationForDirectActionRequest(command: AgentChatCommand) {
  if (!isAgentReadonlyObservationTool(command)) {
    return false;
  }

  const text = normalizeAgentAssessmentSearchText([
    command.sourceText,
    command.instruction,
    command.toolCall?.goal,
  ].filter(Boolean).join(' '));
  if (!text) {
    return false;
  }

  const hasActionIntent = hasAgentEffectiveDirectActionIntent(
    command.sourceText ?? '',
    [command.instruction, command.toolCall?.goal].filter(Boolean).join(' '),
  );
  const hasReadOnlyIntent = /(?:what|which|list|show|check|observe|inspect|find|search|where|status|\u4ec0\u4e48|\u54ea(?:濠电姷鏁告慨鐑藉极閸涘﹥鍙忛柣鎴ｆ閺嬩線鏌涘☉姗堟敾闁告瑥绻橀弻锝夊箣閿濆棭妫勯梺鍝勵儎缁舵岸寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ゆい顓犲厴瀵鏁愭径濠勭杸濡炪倖甯婇悞锕傚磿閹剧粯鈷戦柟鑲╁仜婵″ジ鏌涙繝鍌涘仴鐎殿喛顕ч埥澶愬閳哄倹娅囬梻浣瑰缁诲倸螞濞戔懞鍥Ψ瑜忕壕钘壝归敐鍛儓鐏忓繘姊洪崨濠庢畷濠电偛锕ら锝嗙節濮橆厼浜滅紒鐐妞存悂寮查鍕拺缂侇垱娲栨晶鍙夈亜閵娿儲顥㈢€规洘濞婇幃婊兾熼懖鈺婂晭闂備礁澹婇崑渚€宕曢幎鑺ュ仼婵炲樊浜濋悡娑氣偓鍏夊亾閻庯綆鍓涜摫闂備浇顕栭崹鍗炍涢崘顔衡偓浣糕槈濮楀棛鍙嗛梺鍛婄☉閹锋垹绱炴担鍓叉綎婵炲樊浜濋悞濠氭煟閹邦垰钄奸悗姘嵆閺屾稑螣閸忓吋姣堥梺鍝勬湰閻╊垱淇婇幖浣肝ㄦい鏃€鍎抽幃鎴炰繆閵堝洤啸闁稿鐩弫鍐敂閸垹绁﹀┑顔姐仜閸嬫捇鏌熼鐣岀煉闁糕晝鍋ら獮鍡氼槺濠㈣娲熷娲箰鎼淬垻顦ラ梺绋匡工閹诧繝宕曢锔解拻濞达絽鎽滈弸鍐╀繆濡炵厧濮傞柟铏殜瀹曞ジ寮撮埀顒勫炊椤掆偓缁狙勭箾閸℃瑥浜鹃悗闈涚焸濮婃椽妫冨☉姘暫濠碘槅鍋呴悷褎绂嶉幖浣哥骇婵炲棗澧介崬鐢告煟閻斿摜鎳冮悗姘煎幘缁牏鈧綆鍏橀崑鎾舵喆閸曨剛顦ㄩ梺鎼炲妼濞硷繝鎮伴鍢夌喖宕楅悡搴ｅ酱闂備浇鍋愰埛鍫ュ礈閿曞倸鐤€光偓閳ь剛妲?e2a|\u4e9b)|\u5217\u51fa|\u663e\u793a|\u67e5(?:闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚敐澶婄闁挎繂鎲涢幘缁樼厱濠电姴鍊归崑銉╂煛鐏炶濮傜€殿喗娼欒灃闁逞屽墯缁傚秹骞嗚濞撳鏌曢崼婵堝嚬缂併劌顭烽弻娑㈡偄閸涘﹤鍞夐梺缁樹緱閸ｏ綁鐛崶顒夋晣闁绘柨鍢叉俊鎶芥⒒娴ｇ懓顕滅紒璇插€婚埀顒佺▓閺呯娀寮婚妸鈺佄ч柛鈩冪懅閻﹀牓姊哄Ч鍥х伈婵炰匠鍐懃闂傚倷鐒︾€笛兠鸿箛娑樼９婵犻潧顑呯粻鏍喐瀹ュ鈧箓濡搁埡渚€鍞跺┑鐘绘涧濞层劑鍩€椤掑澧紒缁樼洴楠炴﹢寮堕幋鐘插Р闂備胶顭堥鍡涘箲閸ヮ剙钃熼柨娑樺濞岊亪鏌涢幘妤€瀚崹閬嶆⒒娴ｈ姤銆冪紒鈧笟鈧畷鎰板锤濡も偓缁犳牗绻涢崱妯绘儎闁轰礁妫濋弻宥堫檨闁告挾鍠庨悾?be2)|\u89c2\u5bdf|\u68c0\u67e5|\u627e(?:闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鎯у⒔閹虫捇鈥旈崘顏佸亾閿濆簼绨奸柟鐧哥秮閺岋綁顢橀悙鎼闂侀潧妫欑敮鎺楋綖濠靛鏅查柛娑卞墮椤ユ艾鈹戞幊閸婃鎱ㄩ悜钘夌；婵炴垟鎳為崶顒佸仺缂佸瀵ч悗顒勬倵楠炲灝鍔氭い锔诲灣缁牏鈧綆鍋佹禍婊堟煙閸濆嫮肖闁告柨绉甸妵鍕棘閹稿骸鏋犲┑顔硷功缁垶骞忛崨瀛樻優闁荤喐澹嗛濂告⒒娴ｅ憡鍟炴慨濠傜秺閹冾煥閸涱厼鐏婃繝鐢靛Т濞层倗绮荤紒妯镐簻闁哄啫鍊哥敮鍫曟煕閵堝棗鐏存慨濠冩そ瀹曨偊宕熼锝嗩唲闂備胶绮〃鍛存晝椤忓牆绠栭柨鐔哄У閸嬪嫰鏌涜箛姘汗闁告ü绮欏楦裤亹閹烘垳鍠婇梺鍛婎焽閺咁偆妲愰悙鍝勭闁挎梻鏅崢?e00\u4e0b)?|\u641c\u7d22|\u72b6\u6001)/iu.test(text);

  return hasActionIntent && !(
    hasReadOnlyIntent
    && !/(?:open|launch|start|run|focus|move|click|type|select|invoke|control|close|organize|arrange|\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u5173\u95ed|\u6574\u7406)/iu.test(text)
  );
}

function splitAgentAssessmentSearchTokens(value: string | null | undefined) {
  return normalizeAgentAssessmentSearchText(value)
    .split(/[^a-z0-9\u4e00-\u9fff]+/iu)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function hasAgentAssessmentTokenOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = splitAgentAssessmentSearchTokens(left);
  const rightTokens = splitAgentAssessmentSearchTokens(right);
  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  return leftTokens.some((leftToken) => (
    rightTokens.some((rightToken) => leftToken.includes(rightToken) || rightToken.includes(leftToken))
  ));
}

function getAgentAssessmentRequestedTargetText(result: AgentChatCommandResult) {
  const record = result.stateSummary?.structuredEvidence && typeof result.stateSummary.structuredEvidence === 'object'
    ? result.stateSummary.structuredEvidence as Record<string, unknown>
    : null;
  const queryFromObservedState = [
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.receipt?.evidenceLines ?? []),
  ].map((line) => /Windows\/apps query:\s*(.+)$/iu.exec(line)?.[1]?.trim() ?? '')
    .find(Boolean);
  const requestedTarget = [
    record?.requestedTarget,
    record?.query,
    queryFromObservedState,
  ].find((value) => typeof value === 'string' && value.trim());

  return typeof requestedTarget === 'string'
    ? requestedTarget.trim()
    : typeof record?.targetMatched === 'string'
      ? record.targetMatched.trim()
      : '';
}

function hasAgentReadOnlyObservationTargetMatch(result: AgentChatCommandResult) {
  const structuredEvidence = result.stateSummary?.structuredEvidence;
  if (!structuredEvidence || typeof structuredEvidence !== 'object' || Array.isArray(structuredEvidence)) {
    return false;
  }

  const record = structuredEvidence as Record<string, unknown>;
  const requestedTarget = getAgentAssessmentRequestedTargetText(result);
  const directTargetText = [
    record.targetMatched,
    record.selectedTarget,
    record.currentTarget,
    typeof record.finalWindow === 'object' && record.finalWindow
      ? [
          (record.finalWindow as Record<string, unknown>).title,
          (record.finalWindow as Record<string, unknown>).processName,
        ].filter(Boolean).join(' ')
      : null,
    typeof record.targetWindow === 'object' && record.targetWindow
      ? [
          (record.targetWindow as Record<string, unknown>).title,
          (record.targetWindow as Record<string, unknown>).processName,
        ].filter(Boolean).join(' ')
      : null,
  ].filter(Boolean).join(' ');
  if (hasAgentAssessmentTokenOverlap(requestedTarget, directTargetText)) {
    return true;
  }

  const candidates = Array.isArray(record.targetCandidates) ? record.targetCandidates : [];
  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }

    const candidateRecord = candidate as Record<string, unknown>;
    const candidateText = [
      candidateRecord.label,
      candidateRecord.name,
      candidateRecord.description,
      typeof candidateRecord.window === 'object' && candidateRecord.window
        ? [
            (candidateRecord.window as Record<string, unknown>).title,
            (candidateRecord.window as Record<string, unknown>).processName,
          ].filter(Boolean).join(' ')
        : null,
    ].filter(Boolean).join(' ');
    return hasAgentAssessmentTokenOverlap(requestedTarget, candidateText);
  });
}

function hasAgentReadOnlyObservationActionCompletionEvidence(result: AgentChatCommandResult) {
  const structuredEvidence = result.stateSummary?.structuredEvidence;
  if (structuredEvidence && typeof structuredEvidence === 'object' && !Array.isArray(structuredEvidence)) {
    const record = structuredEvidence as Record<string, unknown>;
    const statusText = normalizeAgentAssessmentSearchText([
      record.status,
      record.postActionState,
      result.assessment?.status,
      result.receipt?.status,
    ].filter(Boolean).join(' '));
    if (!/(?:failed|failure|error|unverified|blocked|unknown|visible[-\s]?only|mismatch)/iu.test(statusText)) {
      if (hasAgentReadOnlyObservationTargetMatch(result)) {
        return true;
      }

      if ((record.targetWindow || record.windowMatched) && getAgentAssessmentRequestedTargetText(result)) {
        return true;
      }

      if (/(?:satisfied|completed|launched|running|open|opened|focused|verified)/iu.test(statusText)) {
        const targetText = normalizeAgentAssessmentSearchText([
          record.targetMatched,
          record.selectedTarget,
          record.currentTarget,
        ].filter(Boolean).join(' '));
        if (targetText && hasAgentReadOnlyObservationTargetMatch(result)) {
          return true;
        }
      }
    }
  }

  const evidenceText = normalizeAgentAssessmentSearchText([
    result.responseText,
    result.verification,
    result.receipt?.verification,
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.receipt?.evidenceLines ?? []),
  ].filter(Boolean).join(' '));
  if (!evidenceText) {
    return false;
  }

  if (/(?:running\s*=\s*0|no-window-match|no\s+(?:running|focusable|matching)\s+window|not\s+(?:running|open|launched|verified)|unverified|missing\s+(?:window|evidence|target))/iu.test(evidenceText)) {
    return false;
  }

  return Boolean(
    getAgentAssessmentRequestedTargetText(result)
    && hasAgentReadOnlyObservationTargetMatch(result)
    && /(?:running\s+(?:window|app)|final\s+window|matched\s+window|window\s+matched|target\s+(?:is\s+)?(?:running|open|opened|launched|focused|verified)|observed\s+.+\s+as\s+(?:a\s+)?(?:running|active|open))/iu.test(evidenceText)
  );
}
function resolveAgentToolStateSummaryStatus(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  if (result.assessment?.status) {
    return result.assessment.status;
  }

  if (result.ok === false) {
    return 'failed';
  }

  if (result.receipt?.status === 'failed' || result.receipt?.status === 'blocked') {
    return 'failed';
  }

  if (result.receipt?.status === 'unverified') {
    return 'unverified';
  }

  if (
    (isAgentReadOnlyObservationForDirectActionRequest(command)
      || isAgentReadOnlyObservationForVisualLocateRequest(command))
    && !hasAgentReadOnlyObservationActionCompletionEvidence(result)
  ) {
    return 'unverified';
  }

  return hasAgentResultEvidence(result) ? 'completed' : 'unverified';
}

function createAgentReadOnlyActionCompletionMissingEvidence(command: AgentChatCommand, result: AgentChatCommandResult) {
  return (
    isAgentReadOnlyObservationForDirectActionRequest(command)
      || isAgentReadOnlyObservationForVisualLocateRequest(command)
  )
    && !hasAgentReadOnlyObservationActionCompletionEvidence(result)
    ? [
        'missing:action-completion-evidence',
        isAgentReadOnlyObservationForVisualLocateRequest(command)
          ? 'missing:visual-element-location-evidence'
          : 'missing:target-window-or-running-app-evidence',
      ]
    : [];
}

function createAgentReadOnlyActionCompletionRecovery(command: AgentChatCommand, result: AgentChatCommandResult) {
  if (!hasAgentReadOnlyObservationActionCompletionEvidence(result)) {
    if (isAgentReadOnlyObservationForVisualLocateRequest(command)) {
      return [
        'tool:locate_screen_elements',
        'tool:summarize_visual_snapshot',
        'tool:list_capture_sources',
        'tool:get_active_window_info',
      ];
    }

    if (isAgentReadOnlyObservationForDirectActionRequest(command)) {
      return [
          'tool:observe_windows_and_apps',
          'tool:execute_desktop_action',
          'tool:execute_desktop_sequence',
          'tool:locate_screen_elements',
        ];
    }
  }

  return [];
}

function didAgentCommandMutateState(command: AgentChatCommand, result: AgentChatCommandResult) {
  if (result.ok === false || !hasAgentResultEvidence(result)) {
    return false;
  }

  const route = buildAgentPermissionRoute(command);
  return Boolean(route.plan?.steps.some((step) => (
    step.decision.allowed
    && (
      step.action.risk === 'reversible-write'
      || step.action.risk === 'launch'
      || step.action.risk === 'destructive'
    )
  )));
}

export function createAgentToolStateSummary(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentToolStateSummary | null {
  const toolName = resolveAgentCommandToolName(command);
  const lifecycle = toolName ? getAgentToolLifecycleMetadata(toolName) : null;
  const existing = result.stateSummary ?? {};
  const receiptState = result.receipt?.stateSummary ?? {};
  const hasExplicitObservedState = Boolean(
    existing.observedState?.length
    || receiptState.observedState?.length
    || result.observations?.length
    || result.receipt?.evidenceLines?.length,
  );
  const observedState = createOptionalAgentToolStateItems([
    ...(existing.observedState ?? []),
    ...(receiptState.observedState ?? []),
    ...(result.observations ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    !hasExplicitObservedState ? result.responseText : null,
  ]);
  const verificationEvidence = createOptionalAgentToolStateItems([
    ...(existing.verificationEvidence ?? []),
    ...(receiptState.verificationEvidence ?? []),
    result.verification,
    result.receipt?.verification,
    result.receipt?.status ? `receipt-status:${result.receipt.status}` : null,
  ]);
  const changedState = createOptionalAgentToolStateItems([
    ...(existing.changedState ?? []),
    ...(receiptState.changedState ?? []),
    ...(lifecycle && didAgentCommandMutateState(command, {
      ...result,
      stateSummary: {
        ...existing,
        observedState,
        verificationEvidence,
      },
    })
      ? lifecycle.mutates
      : []),
  ]);
  const status = resolveAgentToolStateSummaryStatus(command, {
    ...result,
    stateSummary: {
      ...existing,
      changedState,
      observedState,
      verificationEvidence,
    },
  });
  const shouldRecommendRecovery = status === 'failed'
    || status === 'needs-user'
    || status === 'unverified'
    || result.ok === false;
  const missingEvidence = createOptionalAgentToolStateItems([
    ...(existing.missingEvidence ?? []),
    ...(receiptState.missingEvidence ?? []),
    ...createAgentReadOnlyActionCompletionMissingEvidence(command, result),
    ...(lifecycle && shouldRecommendRecovery && (status === 'unverified' || !verificationEvidence?.length)
      ? lifecycle.verifies.map((item) => `missing:${item}`)
      : []),
    ...(!lifecycle && shouldRecommendRecovery && !verificationEvidence?.length
      ? ['missing:verification-evidence']
      : []),
    ...(!lifecycle && result.ok === false
      ? ['missing:successful-tool-result']
      : []),
  ]);
  const recommendedRecovery = createOptionalAgentToolStateItems([
    ...(existing.recommendedRecovery ?? []),
    ...(receiptState.recommendedRecovery ?? []),
    ...createAgentReadOnlyActionCompletionRecovery(command, result),
    ...(lifecycle && shouldRecommendRecovery
      ? lifecycle.recoversWith.map((name) => `tool:${name}`)
      : []),
    ...(!lifecycle && shouldRecommendRecovery && result.followUp
      ? [`follow-up:${result.followUp}`]
      : []),
  ]);
  const summary: AgentToolStateSummary = {
    actionEvidence: existing.actionEvidence ?? receiptState.actionEvidence ?? null,
    changedState,
    missingEvidence,
    observedState,
    recommendedRecovery,
    structuredEvidence: existing.structuredEvidence ?? receiptState.structuredEvidence ?? null,
    verificationEvidence,
  };
  const hasSummary = Object.values(summary).some((items) => (
    Array.isArray(items) ? items.length > 0 : Boolean(items)
  ));

  return hasSummary ? summary : null;
}

function createAgentResultAssessment(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatResultAssessment {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const askUserAction = followUpActions.find((action) => action.kind === 'ask-user') ?? null;
  const runCommandAction = followUpActions.find((action): action is AgentRunnableFollowUpAction => (
    action.kind === 'run-command'
  )) ?? null;
  const nextStep = result.followUp ?? askUserAction?.prompt ?? runCommandAction?.label ?? null;
  const hasEvidence = hasAgentResultEvidence(result);
  const readOnlyActionObservation = isAgentReadOnlyObservationForDirectActionRequest(command);
  const readOnlyVisualLocateObservation = isAgentReadOnlyObservationForVisualLocateRequest(command);
  const readOnlyActionVerified = !(readOnlyActionObservation || readOnlyVisualLocateObservation)
    || hasAgentReadOnlyObservationActionCompletionEvidence(result);
  const failed = result.ok === false
    || result.receipt?.status === 'failed'
    || result.receipt?.status === 'blocked';
  const receiptUnverified = result.receipt?.status === 'unverified';
  const needsUser = Boolean(askUserAction || (failed && nextStep));
  const canContinue = Boolean(!failed && (runCommandAction || result.followUp));

  const status: AgentChatResultAssessment['status'] = failed
    ? needsUser ? 'needs-user' : 'failed'
    : needsUser
      ? 'needs-user'
      : receiptUnverified
        ? 'unverified'
        : canContinue
          ? 'can-continue'
          : hasEvidence && readOnlyActionVerified
            ? 'completed'
            : 'unverified';

  const summary = (() => {
    if (status === 'needs-user') {
      return nextStep ? `Needs user input: ${nextStep}` : 'Needs user input before continuing';
    }

    if (status === 'failed') {
      return result.errorText ?? 'Execution failed and no automatic next step is available.';
    }

    if (status === 'can-continue') {
      return nextStep ? `Current step completed; can continue: ${nextStep}` : 'Current step completed and provided a follow-up action';
    }

    if (status === 'unverified') {
      return 'Tool returned, but user-level verification evidence is insufficient';
    }

    return result.verification ?? 'Current step completed with tool verification evidence';
  })();

  return {
    evidence: compactAgentAssessmentEvidence([
      command.toolCall?.name ? `tool:${command.toolCall.name}` : `command:${command.kind}`,
      result.verification ? `verification:${result.verification}` : null,
      result.errorText ? `error:${result.errorText}` : null,
      result.responseText ? `result:${result.responseText}` : null,
      result.followUp ? `next:${result.followUp}` : null,
      ...(result.observations ?? []).map((observation) => `observation:${observation}`),
      ...(result.stateSummary?.observedState ?? []).map((item) => `observedState:${item}`),
      ...(result.stateSummary?.changedState ?? []).map((item) => `changedState:${item}`),
      ...(result.stateSummary?.verificationEvidence ?? []).map((item) => `verificationEvidence:${item}`),
      ...(result.stateSummary?.missingEvidence ?? []).map((item) => `missingEvidence:${item}`),
      ...(result.stateSummary?.recommendedRecovery ?? []).map((item) => `recommendedRecovery:${item}`),
    ]),
    nextStep,
    status,
    summary,
  };
}
function enrichAgentResultWithRecoveryActions(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const followUpActions = createAgentRecoveryFollowUpActions(command, result);
  const nextStep = result.followUp
    ?? result.assessment?.nextStep
    ?? (followUpActions.length ? createAgentDecisionSummary(result, followUpActions) : null);

  return {
    ...result,
    followUp: nextStep,
    followUpAction: followUpActions[0] ?? result.followUpAction ?? null,
    followUpActions: followUpActions.length ? followUpActions : result.followUpActions ?? null,
  };
}

export function assessAgentCommandResult(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const statefulResult = {
    ...result,
    stateSummary: createAgentToolStateSummary(command, result),
  };
  const assessedResult = {
    ...statefulResult,
    assessment: statefulResult.assessment ?? createAgentResultAssessment(command, statefulResult),
  };
  const assessedStatefulResult = {
    ...assessedResult,
    stateSummary: createAgentToolStateSummary(command, assessedResult),
  };

  return enrichAgentResultWithRecoveryActions(command, assessedStatefulResult);
}
