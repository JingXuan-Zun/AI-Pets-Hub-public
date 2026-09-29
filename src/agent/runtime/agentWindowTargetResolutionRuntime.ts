import {
  type AgentChatCommand,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
} from '../agentChatCommand';
import { createAgentToolCommand } from './agentToolCommandFactory';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';
import { resolveAgentObservedWindowTargetEvidence } from './agentTargetResolutionContext';

const STABLE_WINDOW_TARGET_ACTIONS = new Set([
  'close_window',
  'control_window',
  'focus_window',
  'move_window_to_display',
]);

const AGENT_WINDOW_INVENTORY_CLOCK_SKEW_TOLERANCE_MS = 250;

export type AgentWindowTargetResolutionDecision =
  | {
      kind: 'ready';
      args: Record<string, unknown>;
      reason: string;
    }
  | {
      kind: 'observe';
      command: AgentChatCommand;
      reason: string;
    }
  | {
      kind: 'repair';
      reason: string;
    }
  | {
      kind: 'not-applicable';
      reason: string;
    };

function normalizeAction(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function getStructuredEvidence(entry: AgentRuntimeToolResultEntry | null | undefined) {
  return entry?.result.stateSummary?.structuredEvidence
    ?? entry?.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

function getPositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : null;
}

function getWindowQueryCandidates(args: Record<string, unknown>) {
  const explicitCandidates = Array.isArray(args.queryCandidates)
    ? args.queryCandidates
    : [];
  const values = [
    args.query,
    args.target,
    args.title,
    args.processName,
    args.name,
    ...explicitCandidates,
  ];
  const seen = new Set<string>();
  return values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function isSideEffectDispatch(entry: AgentRuntimeToolResultEntry) {
  const toolName = entry.command.toolCall?.name;
  if (toolName === 'execute_desktop_input' || toolName === 'execute_desktop_sequence') {
    return true;
  }
  if (toolName !== 'execute_desktop_action') {
    return false;
  }
  return STABLE_WINDOW_TARGET_ACTIONS.has(normalizeAction(entry.command.toolCall?.input.action));
}

function hasWindowCandidates(evidence: AgentStructuredToolEvidence | null) {
  return Boolean(
    (evidence?.finalWindow && getPositiveInteger(evidence.finalWindow.hwnd))
      || evidence?.targetCandidates?.some((candidate) => getPositiveInteger(candidate.window?.hwnd)),
  );
}

function isFreshWindowInventory(entry: AgentRuntimeToolResultEntry) {
  const evidence = getStructuredEvidence(entry);
  if (evidence?.observationFreshness === 'stale-fallback') {
    return false;
  }
  const capturedAt = getPositiveInteger(evidence?.observationCapturedAt)
    ?? getPositiveInteger(entry.timing?.endedAt);
  if (!capturedAt) {
    return false;
  }

  const receiptStatus = entry.result.receipt?.status?.trim().toLowerCase();
  if (
    entry.result.ok !== true
    || receiptStatus === 'failed'
    || receiptStatus === 'blocked'
    || receiptStatus === 'unverified'
  ) {
    return false;
  }

  const age = Date.now() - capturedAt;
  return age >= -AGENT_WINDOW_INVENTORY_CLOCK_SKEW_TOLERANCE_MS && age <= 1500;
}

function isWindowIdentityEvidenceCommand(entry: AgentRuntimeToolResultEntry) {
  const toolName = entry.command.toolCall?.name;
  return toolName === 'observe_windows_and_apps'
    || toolName === 'locate_screen_elements'
    || toolName === 'execute_desktop_observation';
}

function findLatestFreshWindowInventory(toolResults: AgentRuntimeToolResultEntry[]) {
  let latestDispatchIndex = -1;
  toolResults.forEach((entry, index) => {
    if (isSideEffectDispatch(entry)) {
      latestDispatchIndex = index;
    }
  });

  for (let index = toolResults.length - 1; index > latestDispatchIndex; index -= 1) {
    const entry = toolResults[index];
    if (
      entry
      // Any fresh observation that carries a structured finalWindow is valid
      // identity evidence. This includes window-level visual observations and
      // wait_and_observe; restricting this to one tool can downgrade a valid
      // launcher window into an observation-only retry loop.
      && isWindowIdentityEvidenceCommand(entry)
      && entry.result.ok !== false
      && hasWindowCandidates(getStructuredEvidence(entry))
      && isFreshWindowInventory(entry)
    ) {
      return {
        entry,
        toolResults: toolResults.slice(index),
      };
    }
  }
  return null;
}

function collectWindowCandidates(
  evidence: AgentStructuredToolEvidence | null,
) {
  const windows = new Map<number, AgentStructuredToolWindowEvidence>();
  if (evidence?.finalWindow) {
    const hwnd = getPositiveInteger(evidence.finalWindow.hwnd);
    if (hwnd) {
      windows.set(hwnd, evidence.finalWindow);
    }
  }
  for (const candidate of evidence?.targetCandidates ?? []) {
    const hwnd = getPositiveInteger(candidate.window?.hwnd);
    if (hwnd && candidate.window) {
      windows.set(hwnd, candidate.window);
    }
  }
  return [...windows.values()];
}

function formatWindowCandidateSummary(evidence: AgentStructuredToolEvidence | null) {
  const candidates = collectWindowCandidates(evidence).slice(0, 16);
  return candidates.length
    ? candidates.map((window, index) => [
        `${index + 1}.`,
        `hwnd=${window.hwnd ?? 'unknown'}`,
        `pid=${window.pid ?? 'unknown'}`,
        `process=${window.processName || 'unknown'}`,
        `title=${window.title || 'unknown'}`,
      ].join(' ')).join('\n')
    : 'No structured running-window candidates were returned.';
}

function findUniqueWindowByPid(
  evidence: AgentStructuredToolEvidence | null,
  pid: number,
) {
  const matches = collectWindowCandidates(evidence)
    .filter((window) => getPositiveInteger(window.pid) === pid);
  return matches.length === 1 ? matches[0] : null;
}

function findWindowByHwnd(
  evidence: AgentStructuredToolEvidence | null,
  hwnd: number,
) {
  return collectWindowCandidates(evidence)
    .find((window) => getPositiveInteger(window.hwnd) === hwnd) ?? null;
}

function enrichArgsWithWindowIdentity(
  args: Record<string, unknown>,
  window: AgentStructuredToolWindowEvidence,
) {
  const queryCandidates = getWindowQueryCandidates({
    ...args,
    processName: window.processName,
    title: window.title,
  });
  return {
    ...args,
    ...(getPositiveInteger(window.hwnd) ? { hwnd: getPositiveInteger(window.hwnd) } : {}),
    ...(getPositiveInteger(window.pid) ? { pid: getPositiveInteger(window.pid) } : {}),
    ...(window.processName?.trim() ? { processName: window.processName.trim() } : {}),
    ...(window.title?.trim() ? { title: window.title.trim() } : {}),
    queryCandidates,
  };
}

export function createAgentWindowIdentityObservationCommand(
  action: string,
  sourceText: string,
  userGoal: string,
) {
  return createAgentToolCommand({
    args: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeDisplays: action === 'move_window_to_display',
      includeInstalledApps: false,
      includeRunningApps: true,
      includeTaskbarPinned: false,
      limit: 80,
    },
    sourceText,
    toolName: 'observe_windows_and_apps',
    userGoal,
  });
}

export function resolveAgentWindowTargetBeforeDispatch(options: {
  args: Record<string, unknown>;
  sourceText: string;
  toolName: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentWindowTargetResolutionDecision {
  const action = normalizeAction(options.args.action);
  if (
    options.toolName !== 'execute_desktop_action'
    || !STABLE_WINDOW_TARGET_ACTIONS.has(action)
  ) {
    return {
      kind: 'not-applicable',
      reason: 'The command is not a stable-window-target action.',
    };
  }

  const inventory = findLatestFreshWindowInventory(options.toolResults);
  if (!inventory) {
    return {
      command: createAgentWindowIdentityObservationCommand(action, options.sourceText, options.userGoal),
      kind: 'observe',
      reason: 'Resolve the live window identity from a fresh observation before routing a window-target action for approval or dispatch.',
    };
  }

  const evidence = getStructuredEvidence(inventory.entry);
  const explicitHwnd = getPositiveInteger(options.args.hwnd ?? options.args.windowHandle);
  const explicitPid = getPositiveInteger(options.args.pid);
  const queryCandidates = getWindowQueryCandidates(options.args);
  const semanticWindow = resolveAgentObservedWindowTargetEvidence({
    queryCandidates,
    sourceText: options.sourceText,
    toolResults: inventory.toolResults,
    userGoal: options.userGoal,
  });
  const identityWindow = explicitHwnd
    ? findWindowByHwnd(evidence, explicitHwnd)
    : explicitPid
      ? findUniqueWindowByPid(evidence, explicitPid)
      : null;
  if (explicitHwnd || explicitPid) {
    const identityPid = getPositiveInteger(identityWindow?.pid);
    const identityHwnd = getPositiveInteger(identityWindow?.hwnd);
    const semanticHwnd = getPositiveInteger(semanticWindow?.hwnd);
    const identityMatchesPid = !explicitPid || identityPid === explicitPid;
    const hasCompleteLiveIdentityPair = Boolean(
      explicitHwnd
      && explicitPid
      && identityHwnd === explicitHwnd
      && identityPid === explicitPid,
    );
    const identityConflictsWithSemanticTarget = Boolean(
      semanticHwnd
      && identityHwnd
      && identityHwnd !== semanticHwnd,
    );
    const identityIsValidated = Boolean(
      identityWindow
      && identityMatchesPid
      && !identityConflictsWithSemanticTarget
      && (semanticHwnd || hasCompleteLiveIdentityPair || !queryCandidates.length),
    );
    if (identityIsValidated && identityWindow) {
      return {
        args: enrichArgsWithWindowIdentity(options.args, identityWindow),
        kind: 'ready',
        reason: semanticHwnd
          ? 'The explicit window identity was validated against the latest live inventory and target semantics.'
          : 'The complete HWND/PID pair was validated against the latest live inventory without relying on cross-language target text.',
      };
    }

    if (!identityWindow && semanticWindow) {
      return {
        args: enrichArgsWithWindowIdentity(options.args, semanticWindow),
        kind: 'ready',
        reason: 'The stale explicit window identity was rebound to one uniquely resolved target in the latest live inventory.',
      };
    }

    if (!identityWindow && !semanticWindow) {
      return {
        command: createAgentWindowIdentityObservationCommand(action, options.sourceText, options.userGoal),
        kind: 'observe',
        reason: 'The requested window identity is no longer present in the latest inventory; refresh the live inventory before resolving again.',
      };
    }

    return {
      kind: 'repair',
      reason: [
        'The explicit window identity is not currently safe to dispatch. Runtime requires a fresh target resolution before approval or dispatch.',
        `Requested identity: hwnd=${explicitHwnd ?? 'none'} pid=${explicitPid ?? 'none'}.`,
        `Requested target hints: ${queryCandidates.join(' | ') || 'none'}.`,
        'Live candidates from the latest observation:',
        formatWindowCandidateSummary(evidence),
      ].join('\n'),
    };
  }

  const resolvedWindow = semanticWindow;
  if (resolvedWindow) {
    return {
      args: enrichArgsWithWindowIdentity(options.args, resolvedWindow),
      kind: 'ready',
      reason: 'The free-text target was bound to one observed live window identity.',
    };
  }

  return {
    kind: 'repair',
    reason: [
      'Window target identity is unresolved, so approval and dispatch are blocked.',
      'Choose exactly one live candidate from the latest window inventory and retry with its exact hwnd and pid.',
      'Resolve translated, localized, or friendly app names against the returned process/title yourself; do not ask the user merely because labels use different languages.',
      `Requested target hints: ${queryCandidates.join(' | ') || 'none'}.`,
      'Live candidates:',
      formatWindowCandidateSummary(evidence),
    ].join('\n'),
  };
}
