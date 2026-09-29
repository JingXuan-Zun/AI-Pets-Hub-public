import {
  type AgentChatCommandResult,
  type AgentDesktopActionEvidence,
  type AgentStructuredToolRecoveryEvidence,
} from './agentChatCommand';

export type AgentActionLifecycleStatus =
  | 'blocked_permission'
  | 'complete'
  | 'failed_no_effect'
  | 'fallback_available'
  | 'needs_observation'
  | 'unverified_wait';

export interface AgentActionLifecycleDecision {
  reason: string;
  recommendedRecovery: string;
  status: AgentActionLifecycleStatus;
}

function normalizeAgentActionLifecycleText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
}

function getAgentActionLifecyclePostActionState(result: AgentChatCommandResult | null) {
  return normalizeAgentActionLifecycleText(
    result?.stateSummary?.structuredEvidence?.postActionState
      ?? result?.receipt?.stateSummary?.structuredEvidence?.postActionState,
  );
}

function getAgentActionLifecycleRecovery(result: AgentChatCommandResult | null): AgentStructuredToolRecoveryEvidence | null {
  return result?.stateSummary?.structuredEvidence?.postActionRecovery
    ?? result?.receipt?.stateSummary?.structuredEvidence?.postActionRecovery
    ?? null;
}

function getAgentActionLifecycleEvidence(result: AgentChatCommandResult | null): AgentDesktopActionEvidence | null {
  return result?.stateSummary?.actionEvidence
    ?? result?.receipt?.stateSummary?.actionEvidence
    ?? null;
}

function getAgentActionLifecycleText(result: AgentChatCommandResult | null) {
  return [
    result?.responseText,
    result?.verification,
    result?.errorText,
    result?.receipt?.verification,
    ...(result?.observations ?? []),
    ...(result?.stateSummary?.missingEvidence ?? []),
    ...(result?.stateSummary?.recommendedRecovery ?? []),
    ...(result?.receipt?.stateSummary?.missingEvidence ?? []),
    ...(result?.receipt?.stateSummary?.recommendedRecovery ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC').toLowerCase();
}

export function evaluateAgentActionLifecycle(result: AgentChatCommandResult | null): AgentActionLifecycleDecision {
  const postActionState = getAgentActionLifecyclePostActionState(result);
  const recovery = getAgentActionLifecycleRecovery(result);
  const actionEvidence = getAgentActionLifecycleEvidence(result);
  const text = getAgentActionLifecycleText(result);

  if (result?.ok === false || result?.receipt?.status === 'blocked' || result?.receipt?.status === 'failed') {
    if (/(?:uipi|integrity|elevat|admin|permission|denied|access\s+is\s+denied|uac|\u7ba1\u7406\u5458|\u6743\u9650)/iu.test(text)) {
      return {
        reason: 'Action is blocked by permission, elevation, or integrity-boundary evidence.',
        recommendedRecovery: 'Use matching elevation/UIAccess where allowed, or switch to a non-injected UIA/API path instead of retrying the same input.',
        status: 'blocked_permission',
      };
    }

    return {
      reason: 'Action failed or was blocked before verification could prove progress.',
      recommendedRecovery: recovery?.reason ?? 'Refresh target evidence before retrying or reporting the blocker.',
      status: 'failed_no_effect',
    };
  }

  if (
    postActionState !== 'launched'
    && (actionEvidence?.outcome === 'blocked' || actionEvidence?.outcome === 'no-op')
  ) {
    return {
      reason: 'Action evidence reports a blocked, failed, or unchanged outcome.',
      recommendedRecovery: recovery?.reason ?? 'Refresh target evidence before retrying or reporting completion.',
      status: 'failed_no_effect',
    };
  }

  if (
    postActionState !== 'launched'
    && (result?.receipt?.status === 'unverified' || actionEvidence?.outcome === 'uncertain')
  ) {
    return {
      reason: 'Action result is unverified; additional observation is needed before retrying or completing.',
      recommendedRecovery: recovery?.reason ?? 'Run targeted observation and verify the requested final state before retrying.',
      status: 'needs_observation',
    };
  }

  if (postActionState === 'launched' || result?.receipt?.status === 'success') {
    return {
      reason: postActionState === 'launched'
        ? 'Post-action state is launched.'
        : 'Receipt status is success.',
      recommendedRecovery: 'No recovery required for this action.',
      status: 'complete',
    };
  }

  if (postActionState === 'waiting_target' || postActionState === 'loading' || postActionState === 'updating') {
    return {
      reason: `Post-action state is ${postActionState}; the action may be accepted but the final target is not ready yet.`,
      recommendedRecovery: recovery?.reason ?? 'Wait and poll target window/process evidence instead of retrying the same primitive.',
      status: 'unverified_wait',
    };
  }

  if (postActionState === 'login_required') {
    return {
      reason: 'Post-action state is login_required; continue through safe remembered-login controls or stop only for captcha/2FA/manual gates.',
      recommendedRecovery: recovery?.reason ?? 'Locate safe login continuation controls before asking the user.',
      status: 'needs_observation',
    };
  }

  if (recovery?.nextTool) {
    return {
      reason: `Action is unverified and has a recovery tool: ${recovery.nextTool}.`,
      recommendedRecovery: recovery.reason ?? `Run ${recovery.nextTool} to refresh evidence or recover.`,
      status: recovery.nextTool === 'execute_desktop_input' ? 'fallback_available' : 'needs_observation',
    };
  }

  if (actionEvidence?.outcome === 'no-op' || postActionState === 'unchanged') {
    return {
      reason: 'Action completed but runtime evidence indicates no visible UI change.',
      recommendedRecovery: 'Diagnose foreground, elevation, UIA support, and coordinate correctness before retrying.',
      status: 'failed_no_effect',
    };
  }

  return {
    reason: 'No blocking or unverified lifecycle evidence was found.',
    recommendedRecovery: 'No recovery required for this action.',
    status: 'complete',
  };
}
