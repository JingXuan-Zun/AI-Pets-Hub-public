import { type AgentChatCommand } from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';
import { hasAgentAuthenticationManualVerificationCue } from './agentAuthenticationGate';
import { collectAgentRunWindowIdentities, hasAgentPendingPostLoginTarget } from './agentPostLoginFollowUp';
import { hasAgentRuntimeCommittedInputDispatch } from './agentDispatchEvidence';
import {
  evaluateAgentEvidenceTerminal,
  type AgentEvidenceTerminalEvaluatorDependencies,
  type AgentEvidenceTerminalOutcome,
} from './agentEvidenceEngine';

export type AgentPostActionTerminalStatus = 'completed' | 'needs-user';
export type AgentPostActionTerminalStepAction = 'ask_user' | 'final_answer';

export type AgentPostActionTerminalEvaluatorDependencies = AgentEvidenceTerminalEvaluatorDependencies;
export type AgentPostActionTerminalEvaluation = AgentEvidenceTerminalOutcome;

function compactAgentPostActionEvidenceText(value: unknown, maxLength = 900) {
  const text = typeof value === 'string'
    ? value
    : value === undefined || value === null
      ? ''
      : JSON.stringify(value);
  const compactText = text.replace(/\s+/gu, ' ').trim();
  return compactText.length <= maxLength
    ? compactText
    : `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function createAgentPostActionEvidenceSummary(entry: AgentRuntimeToolResultEntry) {
  const lines = [
    ...(entry.result.stateSummary?.verificationEvidence ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []).slice(0, 4),
    ...(entry.result.observations ?? []).slice(0, 4),
    entry.result.verification ?? '',
    entry.result.responseText ?? '',
  ].filter((line): line is string => typeof line === 'string' && Boolean(line.trim()));

  return compactAgentPostActionEvidenceText([...new Set(lines)].join(' | '), 260);
}

function createAgentLaunchedCompletionAnswer(entry: AgentRuntimeToolResultEntry) {
  const evidence = createAgentPostActionEvidenceSummary(entry);
  return [
    '打开/启动成功。',
    evidence ? `依据：${evidence}` : '',
  ].filter(Boolean).join(' ');
}

function createAgentVerifiedActionCompletionAnswer(entry: AgentRuntimeToolResultEntry) {
  return entry.result.responseText?.trim()
    || createAgentPostActionEvidenceSummary(entry)
    || 'The requested action completed with verified state evidence.';
}

function createAgentLoginRequiredAnswer(entry: AgentRuntimeToolResultEntry) {
  const evidence = createAgentPostActionEvidenceSummary(entry);
  return [
    '这里需要你手动完成登录、验证或确认，我先停在这一步。',
    evidence ? `看到的依据：${evidence}` : '',
  ].filter(Boolean).join(' ');
}

function createAgentBlockedManualGateAnswer(entry: AgentRuntimeToolResultEntry) {
  const evidence = createAgentPostActionEvidenceSummary(entry);
  return [
    '这里出现了需要你手动处理的权限、确认或验证步骤，我先停在这里。',
    evidence ? `依据：${evidence}` : '',
  ].filter(Boolean).join(' ');
}

function isAgentAutoRecoveryWindowObservationCommand(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'observe_windows_and_apps') {
    return false;
  }

  const input = command.toolCall.input ?? {};
  return typeof input.recoveryPostActionState === 'string'
    && input.recoveryPostActionState.trim().length > 0;
}

function hasExplicitAgentWindowObservationTarget(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'observe_windows_and_apps') {
    return false;
  }

  const input = command.toolCall.input ?? {};
  return [
    input.query,
    input.target,
    input.name,
    input.title,
    input.processName,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);
}

function hasAgentManualGateEvidence(options: {
  dependencies: AgentPostActionTerminalEvaluatorDependencies;
  entry: AgentRuntimeToolResultEntry;
}) {
  const { dependencies, entry } = options;
  const text = [
    dependencies.collectAutoRecoveryEvidenceText(entry),
    ...(entry.result.stateSummary?.missingEvidence ?? []),
    ...(entry.result.stateSummary?.recommendedRecovery ?? []),
  ].join('\n').normalize('NFKC').toLowerCase();

  if (!text) {
    return false;
  }

  if (/(?:not\s+(?:confirmed|verified)|unconfirmed|unverified|not\s+visible|no\s+(?:evidence|window|target)|missing\s+evidence|\u672a(?:\u786e\u8ba4|\u9a8c\u8bc1)|\u6ca1\u6709.{0,24}(?:\u8bc1\u636e|\u7a97\u53e3|\u76ee\u6807))/iu.test(text)) {
    return false;
  }

  return /(?:administrator|admin|uac|permission|allow|approve|manual|user\s+(?:must|needs?|should|required)|requires?\s+user|sign\s*in|login|password|account|captcha|qr\s*code|\u7ba1\u7406\u5458|\u6743\u9650|\u5141\u8bb8|\u624b\u52a8|\u9700\u8981\u4f60|\u7528\u6237.{0,12}(?:\u786e\u8ba4|\u5904\u7406|\u64cd\u4f5c)|\u767b\u5f55|\u767b\u9646|\u8d26\u53f7|\u8d26\u6237|\u5bc6\u7801|\u9a8c\u8bc1|\u9a8c\u8bc1\u7801|\u626b\u7801)/iu.test(text)
    || /(?:confirmation|confirm|\u786e\u8ba4)/iu.test(text)
      && /(?:modal|dialog|prompt|button|click|press|approve|allow|permission|\u5f39\u7a97|\u6309\u94ae|\u70b9\u51fb|\u5141\u8bb8|\u6743\u9650)/iu.test(text);
}

function hasAgentNonAutomatableLoginGateEvidence(options: {
  dependencies: AgentPostActionTerminalEvaluatorDependencies;
  entry: AgentRuntimeToolResultEntry;
}) {
  const { dependencies, entry } = options;
  const text = [
    dependencies.collectAutoRecoveryEvidenceText(entry),
    ...(entry.result.stateSummary?.missingEvidence ?? []),
    ...(entry.result.stateSummary?.recommendedRecovery ?? []),
  ].join('\n').normalize('NFKC').toLowerCase();

  if (!text) {
    return false;
  }

  return hasAgentAuthenticationManualVerificationCue(text);
}

function hasAgentSafeLoginContinuationControl(options: {
  dependencies: AgentPostActionTerminalEvaluatorDependencies;
  entry: AgentRuntimeToolResultEntry;
}) {
  const { dependencies, entry } = options;
  const text = [
    dependencies.collectAutoRecoveryEvidenceText(entry),
    ...(entry.result.stateSummary?.observedState ?? []),
    ...(entry.result.stateSummary?.verificationEvidence ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []),
    entry.result.responseText,
  ].join('\n').normalize('NFKC').toLowerCase();
  const structuredEvidence = entry.result.stateSummary?.structuredEvidence
    ?? entry.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const auditStatus = structuredEvidence?.coordinateAuditStatus ?? structuredEvidence?.coordinateAudit?.status ?? null;
  const hasAuditedPoint = auditStatus === 'coordinate_ok'
    && (
      Number.isFinite(Number(structuredEvidence?.elementCenter?.x))
      && Number.isFinite(Number(structuredEvidence?.elementCenter?.y))
      || Number.isFinite(Number(structuredEvidence?.elementCenterRatio?.x))
      && Number.isFinite(Number(structuredEvidence?.elementCenterRatio?.y))
    );

  return hasAuditedPoint
    && /(?:快速安全登录|安全登录|快速登录|登录|sign\s*in|log\s*in|continue|confirm|ok|\u767b\u5f55|\u767b\u9646)/iu.test(text);
}

function hasAgentVerifiedAuthenticationCompletion(options: {
  entry: AgentRuntimeToolResultEntry;
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  const hasCommittedLoginDispatch = options.toolResults.some((entry) => {
    if (
      entry.command.toolCall?.name !== 'execute_desktop_sequence'
      || !hasAgentRuntimeCommittedInputDispatch(entry.command, entry.result)
    ) return false;
    const text = [
      entry.command.instruction,
      entry.command.sourceText,
      entry.command.toolCall?.goal,
      entry.command.toolCall?.input ? JSON.stringify(entry.command.toolCall.input) : '',
    ].filter(Boolean).join(' ');
    return /(?:login|log\s*in|sign\s*in|\u767b\u5f55|\u767b\u9646|\u5feb\u901f\s*安全\s*登录)/iu.test(text);
  });
  if (!hasCommittedLoginDispatch) return false;
  const dispatchText = options.toolResults
    .filter((entry) => entry.command.toolCall?.name === 'execute_desktop_sequence')
    .map((entry) => [
      entry.command.instruction,
      entry.command.sourceText,
      entry.command.toolCall?.goal,
      entry.command.toolCall?.input ? JSON.stringify(entry.command.toolCall.input) : '',
    ].filter(Boolean).join(' '))
    .join(' ');
  if (!/(?:login|log\s*in|sign\s*in|\u767b\u5f55|\u767b\u9646|\u5feb\u901f\s*安全\s*登录)/iu.test(dispatchText)) {
    return false;
  }
  return [options.entry, ...options.toolResults].some((candidateEntry) => {
    const evidence = candidateEntry.result.stateSummary?.structuredEvidence
      ?? candidateEntry.result.receipt?.stateSummary?.structuredEvidence
      ?? null;
    if (
      evidence?.postActionState !== 'launched'
      || evidence.observationFreshness === 'stale-fallback'
      || candidateEntry.result.ok !== true
      || ['failed', 'blocked', 'unverified'].includes(candidateEntry.result.receipt?.status?.trim().toLowerCase() ?? '')
    ) return false;
    const text = [
      candidateEntry.result.responseText,
      candidateEntry.result.verification,
      ...(candidateEntry.result.observations ?? []),
      ...(candidateEntry.result.stateSummary?.observedState ?? []),
      ...(candidateEntry.result.stateSummary?.verificationEvidence ?? []),
    ].filter(Boolean).join(' ').normalize('NFKC');
    return /(?:main\s+(?:interface|page)|home\s+(?:page|screen)|no\s+(?:login|sign\s*in)\s+(?:overlay|panel)|\u4e3b\u754c\u9762|\u9996\u9875|\u672a(?:出现|检测到)\s*登录(?:浮层|面板)|\u5df2登录)/iu.test(text)
      && !/(?:captcha|qr\s*code|scan\s*(?:code|qr)|verification\s*code|\u9a8c\u8bc1\u7801|\u4e8c\u6b21\u9a8c\u8bc1|\u626b\u7801)/iu.test(text);
  });
}

function shouldCompleteAgentLaunchedPostAction(options: {
  dependencies: AgentPostActionTerminalEvaluatorDependencies;
  entry: AgentRuntimeToolResultEntry;
  sourceText: string;
  toolResults?: AgentRuntimeToolResultEntry[] | null;
  userGoal: string;
}) {
  const { dependencies, entry } = options;
  if (
    entry.result.ok === false
    || !dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
  ) {
    return false;
  }
  // "登录后启动 X": login or the launcher window alone is not the requested result.
  if (hasAgentPendingPostLoginTarget({
    goalText: `${options.userGoal} | ${options.sourceText}`,
    windowIdentities: collectAgentRunWindowIdentities(options.toolResults ?? [entry]),
  })) {
    return false;
  }

  const requestedCoverage = dependencies.createRequestedActionCoverage({
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const attemptedCoverage = dependencies.createAttemptedActionCoverage(options.toolResults ?? [entry]);
  const verifiedAuthenticationCompletion = hasAgentVerifiedAuthenticationCompletion({
    entry,
    toolResults: options.toolResults ?? [entry],
  });
  const postActionState = dependencies.getPostActionState(entry);
  const verifiedTargetWindow = dependencies.isVerifiedTargetWindowObservation(entry);
  const hasAttemptedLaunchOrUiActionEvidence = attemptedCoverage.has('open-or-launch')
    || attemptedCoverage.has('desktop-input')
    || attemptedCoverage.has('in-app-action');
  const canTreatVerifiedTargetWindowAsLaunchedEvidence = verifiedTargetWindow
    && hasAttemptedLaunchOrUiActionEvidence
    && (
      isAgentAutoRecoveryWindowObservationCommand(entry.command)
      || dependencies.isPostApprovalVerificationCommand(entry.command)
      || hasExplicitAgentWindowObservationTarget(entry.command)
    );
  const hasLaunchedPostActionEvidence = (
    postActionState === 'launched'
    && (
      dependencies.isActionResultTool(entry.command)
      || dependencies.isPostApprovalVerificationCommand(entry.command)
      || dependencies.isAutoRecoveryWaitCommand(entry.command)
      || dependencies.isAutoRecoveryReadCommand(entry.command)
      || entry.command.toolCall?.name === 'observe_windows_and_apps'
    )
  ) || canTreatVerifiedTargetWindowAsLaunchedEvidence;
  if (requestedCoverage.has('in-app-action')) {
    if (!dependencies.isInAppActionCovered(attemptedCoverage) && !verifiedAuthenticationCompletion) {
      return false;
    }
  }

  // Authentication evidence can be split across the approved click and a
  // later observation. Do not let a weaker follow-up crop downgrade that pair.
  if (verifiedAuthenticationCompletion) {
    return true;
  }

  if (
    dependencies.inferSelectionPostActionState(entry)
    && !verifiedAuthenticationCompletion
  ) {
    return false;
  }

  if (postActionState !== 'launched' && !canTreatVerifiedTargetWindowAsLaunchedEvidence) {
    return false;
  }

  return hasLaunchedPostActionEvidence;
}

function shouldCompleteAgentVerifiedAction(options: {
  dependencies: AgentPostActionTerminalEvaluatorDependencies;
  entry: AgentRuntimeToolResultEntry;
  sourceText: string;
  toolResults?: AgentRuntimeToolResultEntry[] | null;
  userGoal: string;
}) {
  const { dependencies, entry } = options;
  if (
    entry.result.ok === false
    || entry.result.receipt?.status !== 'success'
    || dependencies.getPostActionState(entry) !== 'completed'
    || !dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
    || !dependencies.isActionResultTool(entry.command)
  ) {
    return false;
  }

  const requestedCoverage = dependencies.createRequestedActionCoverage({
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const attemptedCoverage = dependencies.createAttemptedActionCoverage(options.toolResults ?? [entry]);
  return [...requestedCoverage].every((kind) => attemptedCoverage.has(kind));
}

function shouldStopAgentBlockedManualGate(options: {
  dependencies: AgentPostActionTerminalEvaluatorDependencies;
  entry: AgentRuntimeToolResultEntry;
  sourceText: string;
  userGoal: string;
}) {
  const { dependencies, entry } = options;
  if (
    entry.result.ok === false
    || !dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
    || !dependencies.isAutoRecoveryReadCommand(entry.command)
  ) {
    return false;
  }

  const postActionState = dependencies.resolveRecoveryPostActionState({
    entry,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  return postActionState === 'blocked'
    && hasAgentManualGateEvidence({ dependencies, entry });
}

export function evaluateAgentPostActionTerminal(options: {
  dependencies: AgentPostActionTerminalEvaluatorDependencies;
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentPostActionTerminalEvaluation | null {
  const { dependencies, latestEntry } = options;
  if (!latestEntry) {
    return null;
  }

  const postActionState = dependencies.getPostActionState(latestEntry);
  const verifiedTargetWindow = dependencies.isVerifiedTargetWindowObservation(latestEntry);
  const verifiedAuthenticationCompletion = hasAgentVerifiedAuthenticationCompletion({
    entry: latestEntry,
    toolResults: options.toolResults,
  });
  if (shouldCompleteAgentVerifiedAction({
    dependencies,
    entry: latestEntry,
    sourceText: options.sourceText,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  })) {
    const evidenceEvaluation = evaluateAgentEvidenceTerminal({
      coverageComplete: true,
      directActionIntent: true,
      latestEntry,
      postActionState: 'completed',
      readOnlyOnly: false,
    });
    if (evidenceEvaluation.status === 'completed') {
      return {
        finalAnswer: createAgentVerifiedActionCompletionAnswer(latestEntry),
        historyReason: 'verified-action-state',
        kind: 'completed',
        postActionState: evidenceEvaluation.postActionState || 'completed',
        status: evidenceEvaluation.status,
        stepAction: 'final_answer',
        stepReason: evidenceEvaluation.reason,
      };
    }
  }

  if (shouldCompleteAgentLaunchedPostAction({
    dependencies,
    entry: latestEntry,
    sourceText: options.sourceText,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  })) {
    const authorizedPostActionState = verifiedTargetWindow && postActionState !== 'launched'
      ? 'launched'
      : postActionState;
    const evidenceEvaluation = evaluateAgentEvidenceTerminal({
      coverageComplete: true,
      directActionIntent: true,
      latestEntry,
      postActionState: authorizedPostActionState,
      readOnlyOnly: false,
      verifiedTargetState: verifiedTargetWindow || verifiedAuthenticationCompletion,
    });
    if (evidenceEvaluation.status === 'completed') {
      return {
        finalAnswer: createAgentLaunchedCompletionAnswer(latestEntry),
        historyReason: verifiedAuthenticationCompletion
          ? 'verified-authentication-completion'
          : verifiedTargetWindow ? 'verified-target-window' : undefined,
        kind: 'launched',
        postActionState: evidenceEvaluation.postActionState || authorizedPostActionState,
        status: evidenceEvaluation.status,
        stepAction: 'final_answer',
        stepReason: evidenceEvaluation.reason,
      };
    }
  }

  if (
    postActionState === 'login_required'
    && latestEntry.result.ok !== false
    && dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
    && hasAgentNonAutomatableLoginGateEvidence({ dependencies, entry: latestEntry })
    && !hasAgentSafeLoginContinuationControl({ dependencies, entry: latestEntry })
  ) {
    return {
      finalAnswer: createAgentLoginRequiredAnswer(latestEntry),
      kind: 'login-required',
      postActionState,
      status: 'needs-user',
      stepAction: 'ask_user',
      stepReason: 'Post-action evidence shows a private login or verification gate.',
    };
  }

  if (shouldStopAgentBlockedManualGate({
    dependencies,
    entry: latestEntry,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  })) {
    return {
      finalAnswer: createAgentBlockedManualGateAnswer(latestEntry),
      historyReason: 'manual-gate-blocker-read',
      kind: 'blocked-manual-gate',
      postActionState,
      status: 'needs-user',
      stepAction: 'ask_user',
      stepReason: 'Visible blocker evidence requires the user to handle a manual permission, confirmation, or verification gate.',
    };
  }

  return null;
}
