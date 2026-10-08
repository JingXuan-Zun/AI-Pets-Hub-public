import {
  createAgentAttemptedActionCoverage,
  createAgentRequestedActionCoverage,
  hasAgentDirectActionIntent,
  isAgentActionKindCovered,
  type AgentActionCoverageDependencies,
} from './agentActionCoverage';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

import {
  getStructuredEvidence,
  normalizeSearchText,
  resolveAgentTargetResolutionHints,
  isTargetResolutionCommand,
  resolveWindowSourceHint,
  hasOuterAppWindowEvidence,
  windowEvidenceNamesRequestedApp,
  findLatestOuterAppWindowEvidenceEntry,
  resolveOuterAppWindowHwnd,
} from './targetResolution/windowEvidenceAndHints';
export {
  AGENT_RUNTIME_TARGET_RESOLUTION_MARKER,
  resolveAgentObservedWindowTargetEvidence,
  resolveAgentTargetResolutionHints,
} from './targetResolution/windowEvidenceAndHints';

export interface AgentTargetResolutionContext {
  alreadyResolvedSinceLastDispatch: boolean;
  directActionRequested: boolean;
  missingInAppActionCoverage: boolean;
  sourceHwnd?: number | null;
  sourceQuery?: string | null;
  targetText?: string | null;
  windowEvidenceAvailable: boolean;
}

function isUsableTargetEvidence(entry: AgentRuntimeToolResultEntry) {
  const receiptStatus = entry.result.receipt?.status?.trim().toLowerCase();
  return entry.result.ok === true
    && receiptStatus !== 'failed'
    && receiptStatus !== 'blocked'
    && receiptStatus !== 'unverified'
    && getStructuredEvidence(entry)?.observationFreshness !== 'stale-fallback';
}

function hasPendingAuthenticationGate(entry: AgentRuntimeToolResultEntry | null) {
  if (!entry || entry.result.ok === false) {
    return false;
  }
  const evidence = getStructuredEvidence(entry);
  if (evidence?.postActionState === 'login_required') {
    return true;
  }
  const text = [
    entry.result.responseText,
    entry.result.verification,
    ...(entry.result.observations ?? []),
    ...(entry.result.stateSummary?.observedState ?? []),
    ...(entry.result.stateSummary?.missingEvidence ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC');
  if (/(?:captcha|qr\s*code|scan\s*(?:code|qr)|verification\s*code|\u9a8c\u8bc1\u7801|\u4e8c\u6b21\u9a8c\u8bc1|\u626b\u7801)/iu.test(text)) {
    return false;
  }
  return /(?:login\s+(?:page|screen|overlay|panel)|sign\s*in\s+(?:page|screen|overlay|panel)|\u767b\u5f55(?:\u754c\u9762|\u9875|\u9762\u677f|\u8986\u76d6|\u5165\u53e3|\u6309\u94ae)|\u5feb\u901f\s*安全\s*登录|\u8d26\u53f7\s*(?:选择|下拉)|\u767b\u5f55\s*面板|\u767b\u5f55\s*\/\s*活动)/iu.test(text);
}

export function hasAgentActionableWindowTargetEvidence(entry: AgentRuntimeToolResultEntry | null) {
  if (!entry || entry.command.toolCall?.name !== 'locate_screen_elements') {
    return false;
  }

  const input = entry.command.toolCall.input;
  if (input.sourceType !== 'window' || typeof input.sourceQuery !== 'string' || !input.sourceQuery.trim()) {
    return false;
  }

  const evidence = getStructuredEvidence(entry);
  if (!evidence || evidence.visualActionReadiness !== 'ready' || !isUsableTargetEvidence(entry)) {
    return false;
  }

  return Boolean(
    evidence.targetMatched?.trim()
      && evidence.primaryAction?.trim()
      && (
        evidence.elementCenter
        || evidence.elementCenterRatio
        || evidence.elementBounds
        || evidence.actionCandidates?.some((candidate) => (
          candidate.enabled !== false
            && candidate.offscreen !== true
            && Boolean(candidate.center || candidate.centerRatio || candidate.bounds)
        ))
      ),
  );
}

function normalizeToolActionName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
}

function getDesktopInputActions(entry: AgentRuntimeToolResultEntry) {
  const toolName = entry.command.toolCall?.name ?? '';
  const input = entry.command.toolCall?.input ?? {};
  if (toolName === 'execute_desktop_input') {
    const action = typeof input.action === 'string' ? normalizeToolActionName(input.action) : '';
    return action ? [action] : [];
  }

  if (toolName !== 'execute_desktop_sequence' || typeof input.stepsJson !== 'string') {
    return [];
  }

  try {
    const steps = JSON.parse(input.stepsJson) as unknown;
    if (!Array.isArray(steps)) {
      return [];
    }

    return steps.flatMap((step) => {
      if (!step || typeof step !== 'object') {
        return [];
      }
      const record = step as Record<string, unknown>;
      const nestedArgs = record.args && typeof record.args === 'object'
        ? record.args as Record<string, unknown>
        : {};
      if (record.tool !== 'execute_desktop_input') {
        return [];
      }
      const action = typeof nestedArgs.action === 'string'
        ? normalizeToolActionName(nestedArgs.action)
        : '';
      return action ? [action] : [];
    });
  } catch {
    return [];
  }
}

export function hasAgentTargetResolutionSinceLastDispatch(
  toolResults: AgentRuntimeToolResultEntry[],
) {
  let latestLocateIndex = -1;
  for (let index = toolResults.length - 1; index >= 0; index -= 1) {
    const entry = toolResults[index];
    if (
      entry
      && isUsableTargetEvidence(entry)
      && (isTargetResolutionCommand(entry) || hasAgentActionableWindowTargetEvidence(entry))
    ) {
      latestLocateIndex = index;
      break;
    }
  }
  if (latestLocateIndex < 0) {
    return false;
  }

  const hasNewerInAppDispatch = toolResults.slice(latestLocateIndex + 1).some((entry) => (
    isUsableTargetEvidence(entry) && getDesktopInputActions(entry).length > 0
  ));
  return !hasNewerInAppDispatch;
}

export function createAgentTargetResolutionContext(options: {
  actionCoverageDependencies: AgentActionCoverageDependencies;
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentTargetResolutionContext {
  const requestText = normalizeSearchText(`${options.sourceText}
${options.userGoal}`);
  const outerAppEntry = hasOuterAppWindowEvidence(options.latestEntry)
    && windowEvidenceNamesRequestedApp(options.latestEntry!, requestText)
    ? options.latestEntry
    : findLatestOuterAppWindowEvidenceEntry(options.toolResults, requestText);
  const latestAuthenticationEntry = [...options.toolResults]
    .reverse()
    .find(hasPendingAuthenticationGate) ?? null;
  const hints = resolveAgentTargetResolutionHints(options.sourceText, options.userGoal);
  const targetText = hasPendingAuthenticationGate(options.latestEntry)
    || hasPendingAuthenticationGate(latestAuthenticationEntry)
    ? '登录或继续控件（若账号已填充则使用现有账号继续）'
    : hints?.targetText;
  const requestedCoverage = createAgentRequestedActionCoverage({
    dependencies: options.actionCoverageDependencies,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const attemptedCoverage = createAgentAttemptedActionCoverage({
    dependencies: options.actionCoverageDependencies,
    toolResults: options.toolResults,
  });
  const missingInAppActionCoverage = requestedCoverage.has('in-app-action')
    && !isAgentActionKindCovered('in-app-action', attemptedCoverage);

  return {
    alreadyResolvedSinceLastDispatch: hasAgentTargetResolutionSinceLastDispatch(options.toolResults),
    directActionRequested: hasAgentDirectActionIntent(options.sourceText, options.userGoal),
    missingInAppActionCoverage,
    sourceHwnd: resolveOuterAppWindowHwnd(getStructuredEvidence(outerAppEntry)),
    sourceQuery: hints?.sourceQuery || resolveWindowSourceHint(outerAppEntry),
    targetText,
    windowEvidenceAvailable: Boolean(outerAppEntry),
  };
}
