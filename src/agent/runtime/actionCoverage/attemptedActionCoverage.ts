import type { AgentChatCommand } from '../../agentChatCommand';
import type { AgentRuntimeToolResultEntry } from '../agentRuntimeContract';
import type { AgentRequestedActionKind, AgentActionCoverageDependencies } from '../agentActionCoverage';
import { resolveAgentTargetInteractionVerification } from '../agentRuntimeVerificationEvidence';
import { hasAgentRuntimeInAppDispatch, hasAgentRuntimeInputDispatch } from '../agentDispatchEvidence';
import { addAgentActionCoverage } from './requestedActionCoverage';
import {
  normalizeAgentToolActionName,
  getAgentToolInputString,
  isAgentProbablyUrlTarget,
  addAgentDesktopInputCoverage,
  addAgentDesktopActionCoverageFromArgs,
  addAgentFileManagementCoverageFromArgs,
  getAgentDesktopSequenceSteps,
  addAgentSequenceStepCoverage,
} from './commandActionCoverage';

function hasAgentVerifiedInAppActionEvidence(entry: AgentRuntimeToolResultEntry | null) {
  const evidence = entry?.result.stateSummary?.structuredEvidence
    ?? entry?.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const targetInteractionVerification = resolveAgentTargetInteractionVerification(evidence);
  if (
    targetInteractionVerification
    && (
      targetInteractionVerification.status !== 'ready'
      || targetInteractionVerification.targetVisible === false
      || targetInteractionVerification.targetSelected === false
      || targetInteractionVerification.detailMatchesTarget === false
      || targetInteractionVerification.primaryActionMatchesTarget !== true
    )
  ) {
    return false;
  }

  const text = [
    entry?.result.verification,
    entry?.result.responseText,
    ...(entry?.result.observations ?? []),
    ...(entry?.result.stateSummary?.verificationEvidence ?? []),
    ...(entry?.result.receipt?.evidenceLines ?? []),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join(' ')
    .normalize('NFKC')
    .toLowerCase();

  if (/(?:insufficient|inconclusive|unverified|not\s+(?:verified|confirmed)|needs[-\s]relation|needs[-\s]target|unknown|\u672a(?:\u9a8c\u8bc1|\u786e\u8ba4)|\u4e0d(?:\u786e\u5b9a|\u8db3|\u6e05\u695a))/iu.test(text)) {
    return false;
  }

  return Boolean(
    evidence?.postActionState === 'launched'
      || evidence?.status === 'success'
      && evidence.visualActionReadiness === 'ready'
      && (
        !targetInteractionVerification
        || targetInteractionVerification.primaryActionMatchesTarget === true
      )
      || /(?:verified|confirmed|belongs\s+to|launched|started|opened|target\s+(?:is\s+)?(?:running|open)|\u5df2(?:\u9a8c\u8bc1|\u786e\u8ba4|\u542f\u52a8|\u6253\u5f00)|\u9a8c\u8bc1(?:\u6210\u529f|\u901a\u8fc7)|\u5c5e\u4e8e)/iu.test(text),
  );
}

function hasAgentAuthenticationDispatch(entry: AgentRuntimeToolResultEntry) {
  const commandText = [
    entry.command.instruction,
    entry.command.sourceText,
    entry.command.toolCall?.goal,
    entry.command.toolCall?.input ? JSON.stringify(entry.command.toolCall.input) : '',
  ].filter(Boolean).join(' ');
  return entry.command.toolCall?.name === 'execute_desktop_sequence'
    && /(?:login|log\s*in|sign\s*in|\u767b\u5f55|\u767b\u9646|\u5feb\u901f\s*安全\s*登录)/iu.test(commandText)
    && getAgentDesktopSequenceSteps(entry.command).some((step) => {
      if (!step || typeof step !== 'object') return false;
      const record = step as Record<string, unknown>;
      const args = record.args && typeof record.args === 'object'
        ? record.args as Record<string, unknown>
        : {};
      return record.tool === 'execute_desktop_input'
        && ['click', 'double_click', 'send_keys', 'hotkey'].includes(
          normalizeAgentToolActionName(typeof args.action === 'string' ? args.action : ''),
        );
    });
}

function hasAgentAuthenticationCompletionEvidence(
  entry: AgentRuntimeToolResultEntry,
  authenticationDispatched: boolean,
) {
  if (!authenticationDispatched || entry.result.ok === false) return false;
  const evidence = entry.result.stateSummary?.structuredEvidence
    ?? entry.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  if (evidence?.postActionState !== 'launched') return false;
  const text = [
    entry.result.responseText,
    entry.result.verification,
    ...(entry.result.observations ?? []),
    ...(entry.result.stateSummary?.observedState ?? []),
    ...(entry.result.stateSummary?.verificationEvidence ?? []),
  ].filter(Boolean).join(' ').normalize('NFKC');
  return /(?:main\s+(?:interface|page)|home\s+(?:page|screen)|no\s+(?:login|sign\s*in)\s+(?:overlay|panel)|\u4e3b\u754c\u9762|\u9996\u9875|\u672a(?:出现|检测到)\s*登录(?:浮层|面板)|\u5df2登录)/iu.test(text)
    && !/(?:captcha|qr\s*code|scan\s*(?:code|qr)|verification\s*code|\u9a8c\u8bc1\u7801|\u4e8c\u6b21\u9a8c\u8bc1|\u626b\u7801)/iu.test(text);
}

function isAgentUiChangingDesktopActionCommand(command: AgentChatCommand) {
  return hasAgentRuntimeInputDispatch(command);
}

function isAgentInAppDispatchCommand(command: AgentChatCommand) {
  return hasAgentRuntimeInAppDispatch(command);
}

function isAgentIntermediateActionCommand(command: AgentChatCommand) {
  return command.toolCall?.actionScope?.completion === 'intermediate';
}

function hasAgentPostApprovalLaunchedEvidence(options: {
  dependencies: Pick<
    AgentActionCoverageDependencies,
    'getPostActionState'
      | 'isAutoRecoveryReadCommand'
      | 'isAutoRecoveryWaitCommand'
      | 'isPostApprovalVerificationCommand'
      | 'isVerifiedTargetWindowObservation'
  >;
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  const { dependencies, toolResults } = options;
  let sawPostApprovalVerification = false;
  let sawUiChangingDesktopAction = false;
  let sawInAppDispatch = false;
  let latestUiChangingActionIsIntermediate = false;

  for (const entry of toolResults) {
    if (dependencies.isPostApprovalVerificationCommand(entry.command)) {
      sawPostApprovalVerification = true;
    }

    if (isAgentUiChangingDesktopActionCommand(entry.command)) {
      sawUiChangingDesktopAction = true;
      latestUiChangingActionIsIntermediate = isAgentIntermediateActionCommand(entry.command);
      sawInAppDispatch = sawInAppDispatch || isAgentInAppDispatchCommand(entry.command);
    }

    if (
      sawUiChangingDesktopAction
      && sawInAppDispatch
      && !latestUiChangingActionIsIntermediate
      && dependencies.isVerifiedTargetWindowObservation(entry)
    ) {
      return true;
    }

    if (dependencies.getPostActionState(entry) !== 'launched') {
      continue;
    }

    if (dependencies.isPostApprovalVerificationCommand(entry.command)) {
      return !latestUiChangingActionIsIntermediate;
    }

    if (
      sawPostApprovalVerification
      && !latestUiChangingActionIsIntermediate
      && (
        dependencies.isAutoRecoveryWaitCommand(entry.command)
        || dependencies.isAutoRecoveryReadCommand(entry.command)
      )
    ) {
      return true;
    }
  }

  return false;
}

function hasAgentPostApprovalInAppDispatchEvidence(options: {
  dependencies: Pick<
    AgentActionCoverageDependencies,
    'isVerifiedTargetWindowObservation'
  >;
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  let sawInAppDispatch = false;
  let latestUiChangingActionIsIntermediate = false;

  for (const entry of options.toolResults) {
    if (isAgentUiChangingDesktopActionCommand(entry.command)) {
      latestUiChangingActionIsIntermediate = isAgentIntermediateActionCommand(entry.command);
      sawInAppDispatch = sawInAppDispatch || isAgentInAppDispatchCommand(entry.command);
    }

    if (
      sawInAppDispatch
      && !latestUiChangingActionIsIntermediate
      && options.dependencies.isVerifiedTargetWindowObservation(entry)
    ) {
      return true;
    }
  }

  return false;
}

export function createAgentAttemptedActionCoverage(options: {
  dependencies: Pick<
    AgentActionCoverageDependencies,
    'getPostActionState'
      | 'isAutoRecoveryReadCommand'
      | 'isAutoRecoveryWaitCommand'
      | 'isPostApprovalVerificationCommand'
      | 'isVerifiedTargetWindowObservation'
  >;
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  const { dependencies, toolResults } = options;
  const coverage = new Set<AgentRequestedActionKind>();
  let sawInAppLoadingOrUpdatingEvidence = false;
  let latestUiChangingActionIsIntermediate = false;
  let authenticationDispatched = false;

  for (const entry of toolResults) {
    const command = entry.command;
    const toolName = command.toolCall?.name ?? null;
    const input = command.toolCall?.input ?? {};
    const postActionState = dependencies.getPostActionState(entry);
    authenticationDispatched = authenticationDispatched || hasAgentAuthenticationDispatch(entry);
    if (isAgentUiChangingDesktopActionCommand(command)) {
      latestUiChangingActionIsIntermediate = isAgentIntermediateActionCommand(command);
    }
    if (
      (postActionState === 'loading' || postActionState === 'updating')
      && (
        toolName === 'execute_desktop_observation'
        || toolName === 'locate_screen_elements'
        || dependencies.isPostApprovalVerificationCommand(command)
        || dependencies.isAutoRecoveryReadCommand(command)
      )
    ) {
      sawInAppLoadingOrUpdatingEvidence = true;
    }

    if (command.kind === 'desktop-organization') {
      if (command.desktopOrganization?.mode === 'execute') {
        addAgentActionCoverage(coverage, 'desktop-organization-execute');
      }
      continue;
    }

    if (toolName === 'organize_desktop_icons') {
      if (input.mode === 'execute') {
        addAgentActionCoverage(coverage, 'desktop-organization-execute');
      }
      continue;
    }

    if (toolName === 'execute_desktop_sequence') {
      for (const step of getAgentDesktopSequenceSteps(command)) {
        addAgentSequenceStepCoverage(coverage, step);
      }
      if (
        !latestUiChangingActionIsIntermediate
        && (
          hasAgentVerifiedInAppActionEvidence(entry)
          || hasAgentAuthenticationCompletionEvidence(entry, authenticationDispatched)
        )
      ) {
        addAgentActionCoverage(coverage, 'in-app-action');
      }
      continue;
    }

    if (toolName === 'execute_desktop_input') {
      addAgentDesktopInputCoverage(coverage);
      continue;
    }

    if (toolName === 'execute_desktop_action') {
      addAgentDesktopActionCoverageFromArgs(coverage, input);
      continue;
    }

    if (toolName === 'launch_local_app' || toolName === 'open_resource' || toolName === 'focus_window') {
      addAgentActionCoverage(coverage, 'open-or-launch');
      if (toolName === 'open_resource' && isAgentProbablyUrlTarget(input.target)) {
        addAgentActionCoverage(coverage, 'browser-navigation');
      }
      continue;
    }

    if (toolName === 'close_window') {
      addAgentActionCoverage(coverage, 'close-window');
      continue;
    }

    if (toolName === 'search_web' || toolName === 'browser_search') {
      addAgentActionCoverage(coverage, 'browser-navigation');
      continue;
    }

    if (toolName === 'control_browser') {
      const action = normalizeAgentToolActionName(getAgentToolInputString(command, 'action'));
      if (action === 'open_url' || action === 'search_web' || action === 'focus_tab') {
        addAgentActionCoverage(coverage, 'browser-navigation');
      }
      continue;
    }

    if (toolName === 'execute_file_management_action') {
      addAgentFileManagementCoverageFromArgs(coverage, input);
    }

    if (
      postActionState === 'launched'
      && (
        dependencies.isAutoRecoveryReadCommand(command)
        || dependencies.isAutoRecoveryWaitCommand(command)
        || dependencies.isPostApprovalVerificationCommand(command)
      )
    ) {
      addAgentActionCoverage(coverage, 'open-or-launch');
      if (
        !latestUiChangingActionIsIntermediate
        && (
          hasAgentVerifiedInAppActionEvidence(entry)
          || hasAgentAuthenticationCompletionEvidence(entry, authenticationDispatched)
        )
      ) {
        addAgentActionCoverage(coverage, 'in-app-action');
      }
      if (!latestUiChangingActionIsIntermediate && sawInAppLoadingOrUpdatingEvidence) {
        addAgentActionCoverage(coverage, 'in-app-action');
      }
    }
  }

  if (authenticationDispatched && toolResults.some((entry) => (
    hasAgentAuthenticationCompletionEvidence(entry, true)
  ))) {
    addAgentActionCoverage(coverage, 'in-app-action');
  }

  if (
    hasAgentPostApprovalLaunchedEvidence({
      dependencies,
      toolResults,
    })
  ) {
    addAgentActionCoverage(coverage, 'open-or-launch');
  }

  if (
    hasAgentPostApprovalInAppDispatchEvidence({
      dependencies,
      toolResults,
    })
  ) {
    addAgentActionCoverage(coverage, 'in-app-action');
  }

  return coverage;
}
