import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
} from '../agentChatCommand';
import {
  getAgentResultStructuredEvidenceRecord,
  collectAgentResultAssessmentText,
  getAgentResultStructuredEvidence,
  resolveAgentResultFollowUpActions,
  getAgentResultPostActionState,
  getAgentResultActionLifecycleStatus,
} from './resultEvidenceAssessment';
import {
  isAgentResultLowConfidenceVisualEvidence,
  resolveAgentResultLoginContinuationPoint,
  hasAgentResultLoginContinuationCue,
  createAgentLoginContinuationExecuteCommand,
  createAgentLoginContinuationLocateCommand,
} from './loginContinuationRecovery';

export type AgentRunnableFollowUpAction = Extract<AgentChatFollowUpAction, { kind: 'run-command' }>;

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
