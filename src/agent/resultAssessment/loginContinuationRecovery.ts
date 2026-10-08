import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import {
  createAgentToolCommand,
} from '../runtime/agentToolCommandFactory';
import {
  isAgentExecutionStrategyAmbiguousTargetText,
  isAgentExecutionStrategySafeKeyboardContinuationTarget,
} from '../agentExecutionStrategy';
import {
  hasAgentAuthenticationHardGateCue,
  hasAgentAuthenticationManualVerificationCue,
} from '../runtime/agentAuthenticationGate';
import {
  resolveAgentTargetInteractionVerification,
} from '../runtime/agentRuntimeVerificationEvidence';
import {
  getAgentResultStructuredEvidence,
  collectAgentResultAssessmentText,
  getAgentResultStructuredEvidenceRecord,
} from './resultEvidenceAssessment';

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

export function hasAgentResultLoginContinuationCue(result: AgentChatCommandResult) {
  const text = collectAgentResultAssessmentText(result);
  return /(?:快速安全登录|安全登录|快速登录|登录|登陆|sign\s*in|log\s*in|continue|confirm|ok)/iu.test(text)
    && !hasAgentAuthenticationManualVerificationCue(text);
}

export function isAgentResultLowConfidenceVisualEvidence(evidence: AgentStructuredToolEvidence | null) {
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
  return /(?:快速安全登录|安全登录|快速登录|登录|log\s*in|sign\s*in|continue|confirm|ok|登陆)/iu.test(text);
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

export function resolveAgentResultLoginContinuationPoint(result: AgentChatCommandResult) {
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

export function createAgentLoginContinuationExecuteCommand(
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

export function createAgentLoginContinuationLocateCommand(
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
