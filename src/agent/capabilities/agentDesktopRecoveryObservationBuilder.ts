import {
  type AgentChatCommand,
} from '../agentChatCommand';

import {
  type AgentRuntimeToolResultEntry as AgentDesktopToolResultEntry,
} from '../runtime/agentRuntimeContract';

import {
  getAgentStructuredEvidence as getAgentDesktopStructuredEvidence,
} from '../runtime/agentToolEvidence';

import {
  resolveAgentDesktopAutoRecoveryQuery,
} from './agentDesktopRecoveryCommandBuilder';

import {
  createAgentToolCommand as createAgentDesktopToolCommand,
} from '../runtime/agentToolCommandFactory';

import {
  type AgentDesktopAutoRecoveryObservationBuilderDependencies,
  normalizeAgentDesktopToolActionName,
  isAgentDesktopAutoRecoveryReadCommand,
  isAgentDesktopAutoRecoveryWaitCapReadCommand,
  countAgentDesktopAutoRecoveryWaits,
  resolveAgentDesktopAutoRecoveryMaxWaits,
  resolveAgentDesktopAutoRecoveryFallbackWaitMs,
  resolveAgentDesktopAutoRecoveryWaitMs,
  shouldContinueAgentDesktopAfterWaitCapRead,
} from './recoveryObservation/recoveryObservationBudget';

import {
  createAgentDesktopVisualTimeoutRecoveryCommand,
  createAgentDesktopAutoRecoveryQuestion,
  createAgentDesktopAutoRecoveryReadCommand,
  createAgentDesktopAutoRecoveryWaitCapReadCommand,
  createAgentDesktopAutoRecoveryStateReadCommand,
  createAgentDesktopAutoRecoveryWindowObservationCommand,
  createAgentDesktopAutoRecoveryWindowUiInspectionCommand,
} from './recoveryObservation/recoveryObservationCommands';

export function createAgentDesktopAutoRecoveryObservationCommand(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry | null;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const { dependencies, latestEntry, sourceText, toolResults, userGoal } = options;
  if (!latestEntry) {
    return null;
  }

  // A wait can return valid window/process evidence while its optional visual
  // supplement times out. That is a different state from "window missing":
  // switch to one fresh window-level locate before applying repeat-read caps.
  const visualTimeoutRecovery = createAgentDesktopVisualTimeoutRecoveryCommand({
    latestEntry,
    sourceText,
    userGoal,
  });
  if (visualTimeoutRecovery) {
    return visualTimeoutRecovery;
  }

  const continueAfterWaitCapRead = shouldContinueAgentDesktopAfterWaitCapRead({
    dependencies,
    latestEntry,
    sourceText,
    toolResults,
    userGoal,
  });

  if (
    isAgentDesktopAutoRecoveryWaitCapReadCommand(latestEntry.command)
    && !continueAfterWaitCapRead
  ) {
    return null;
  }

  if (
    isAgentDesktopAutoRecoveryReadCommand(latestEntry.command)
    && !continueAfterWaitCapRead
  ) {
    return null;
  }

  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });
  const recovery = getAgentDesktopStructuredEvidence(latestEntry)?.postActionRecovery;
  if (postActionState === 'waiting_window' || postActionState === 'waiting_target') {
    const maxWaits = resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, latestEntry, toolResults);
    const previousWaits = countAgentDesktopAutoRecoveryWaits(toolResults, postActionState);
    if (maxWaits <= 0 || previousWaits >= maxWaits) {
      return createAgentDesktopAutoRecoveryWaitCapReadCommand({
        dependencies,
        latestEntry,
        recovery,
        sourceText,
        toolResults,
        userGoal,
      });
    }

    const fallbackWaitMs = resolveAgentDesktopAutoRecoveryFallbackWaitMs(postActionState, previousWaits + 1);
    const recoveryArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object'
      ? recovery.nextArgs
      : {};
    const query = resolveAgentDesktopAutoRecoveryQuery({
      latestEntry,
      recoveryArgs,
      sourceText,
      userGoal,
    });
    return createAgentDesktopToolCommand({
      args: {
        action: 'wait_and_observe',
        forceRefresh: true,
        includeVisual: false,
        limit: 12,
        ...(query ? { query } : {}),
        question: createAgentDesktopAutoRecoveryQuestion({
          maxWaits,
          postActionState,
          query,
          reason: recovery?.reason ?? 'The requested app/window is not verified yet; wait and poll lightweight window/process state before visual recovery.',
          waitAttempt: previousWaits + 1,
        }),
        recoveryAttempt: previousWaits + 1,
        recoveryMaxAttempts: maxWaits,
        recoveryPostActionState: postActionState,
        waitMs: resolveAgentDesktopAutoRecoveryWaitMs(recoveryArgs.waitMs, fallbackWaitMs),
      },
      sourceText,
      toolName: 'execute_desktop_observation',
      userGoal,
    });
  }

  if (recovery?.nextTool === 'locate_screen_elements') {
    return createAgentDesktopAutoRecoveryReadCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    });
  }

  if (recovery?.nextTool === 'observe_windows_and_apps') {
    return createAgentDesktopAutoRecoveryWindowObservationCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    });
  }

  const windowUiInspectionRecovery = createAgentDesktopAutoRecoveryWindowUiInspectionCommand({
    dependencies,
    latestEntry,
    recovery,
    sourceText,
    toolResults,
    userGoal,
  });
  if (windowUiInspectionRecovery) {
    return windowUiInspectionRecovery;
  }

  const maxWaits = resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, latestEntry, toolResults);
  const previousWaits = countAgentDesktopAutoRecoveryWaits(toolResults, postActionState);
  if (maxWaits <= 0 || previousWaits >= maxWaits) {
    return createAgentDesktopAutoRecoveryWaitCapReadCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    }) ?? createAgentDesktopAutoRecoveryStateReadCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    });
  }

  if (recovery?.nextTool && recovery.nextTool !== 'execute_desktop_observation') {
    return null;
  }

  const recoveryArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object'
    ? recovery.nextArgs
    : {};
  const action = typeof recoveryArgs.action === 'string'
    ? normalizeAgentDesktopToolActionName(recoveryArgs.action)
    : 'wait_and_observe';
  if (action !== 'wait_and_observe') {
    return null;
  }

  const waitAttempt = previousWaits + 1;
  const fallbackWaitMs = resolveAgentDesktopAutoRecoveryFallbackWaitMs(postActionState, waitAttempt);
  const query = resolveAgentDesktopAutoRecoveryQuery({
    latestEntry,
    recoveryArgs,
    sourceText,
    userGoal,
  });
  return createAgentDesktopToolCommand({
    args: {
      action: 'wait_and_observe',
      forceRefresh: true,
      includeVisual: true,
      limit: 12,
      ...(query ? { query } : {}),
      question: createAgentDesktopAutoRecoveryQuestion({
        maxWaits,
        postActionState,
        query,
        reason: recovery?.reason ?? null,
        waitAttempt,
      }),
      recoveryAttempt: waitAttempt,
      recoveryMaxAttempts: maxWaits,
      recoveryPostActionState: postActionState,
      waitMs: resolveAgentDesktopAutoRecoveryWaitMs(recoveryArgs.waitMs, fallbackWaitMs),
    },
    sourceText,
    toolName: 'execute_desktop_observation',
    userGoal,
  });
}

export {
  AGENT_DESKTOP_AUTO_RECOVERY_MARKER,
  type AgentDesktopAutoRecoveryObservationBuilderDependencies,
  isAgentDesktopAutoRecoveryWaitCommand,
  isAgentDesktopAutoRecoveryReadCommand,
  isAgentDesktopAutoRecoveryWaitCapReadCommand,
  isAgentDesktopAutoRecoveryCommand,
  countAgentDesktopAutoRecoveryWaits,
  collectAgentDesktopAutoRecoveryEvidenceText,
  resolveAgentDesktopAutoRecoveryMaxWaits,
  hasAgentDesktopAutoRecoveryWaitBudgetRemaining,
  findLatestAgentDesktopAutoRecoverySourceEntry,
} from './recoveryObservation/recoveryObservationBudget';
