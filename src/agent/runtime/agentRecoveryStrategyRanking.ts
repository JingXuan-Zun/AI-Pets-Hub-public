import {
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import {
  compactAgentPlanningSignalText,
  getAgentPostActionState,
  getAgentStructuredEvidence,
  hasAgentCandidateLocationEvidence,
} from './agentPlanningSignalEvidence';
import {
  countAgentRecoveryStrategyRuns,
  getAgentRecoveryStrategyBudget,
} from './agentRecoveryStrategyBudget';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export interface AgentRecoveryStrategyScore {
  budgetFallback?: string;
  budgetMax?: number;
  budgetStatus?: 'available' | 'exhausted';
  budgetUsed?: number;
  reason: string;
  score: number;
  strategy: string;
  tool: string;
}

export interface AgentRecoveryStrategyRankingDependencies {
  countAutoRecoveryWaits: (
    toolResults: AgentRuntimeToolResultEntry[],
    postActionState?: string,
  ) => number;
  resolveAutoRecoveryMaxWaits: (
    postActionState: string,
    latestEntry?: AgentRuntimeToolResultEntry | null,
    toolResults?: AgentRuntimeToolResultEntry[],
  ) => number;
}

function normalizeAgentRecoveryCueText(text: string) {
  return text.normalize('NFKC').toLowerCase();
}

function hasAgentRecoveryCue(text: string, pattern: RegExp) {
  return pattern.test(normalizeAgentRecoveryCueText(text));
}

function hasAgentErrorCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:error|failed|failure|exception|crash|unable|cannot|\u9519\u8bef|\u5931\u8d25|\u5d29\u6e83)/iu);
}

function hasAgentBlockerCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:blocked|permission|denied|modal|confirmation|gate|policy|administrator|admin|uac|\u963b\u6b62|\u62e6\u622a|\u6743\u9650|\u62d2\u7edd|\u5f39\u7a97|\u786e\u8ba4|\u7ba1\u7406\u5458)/iu);
}

function hasAgentCoordinateCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:coordinate|coordinates|center|bounds|screen coordinate|elementcenter|\u5750\u6807|\u4e2d\u5fc3|\u8fb9\u754c|\u8303\u56f4)/iu);
}

function hasAgentTargetActionRelationCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:primary action|button|relation|associated|belongs|target action|\u4e3b\u8981\u64cd\u4f5c|\u6309\u94ae|\u5173\u8054|\u5c5e\u4e8e)/iu);
}

function hasAgentLoginCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:login|sign\s*in|password|account|captcha|qr\s*code|administrator|admin|uac|\u767b\u5f55|\u8d26\u53f7|\u5bc6\u7801|\u9a8c\u8bc1|\u4e8c\u7ef4\u7801|\u7ba1\u7406\u5458)/iu);
}

function hasAgentTransitionalCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:loading|launching|updating|downloading|installing|progress|initializing|connecting|preparing|\u52a0\u8f7d|\u542f\u52a8|\u66f4\u65b0|\u4e0b\u8f7d|\u5b89\u88c5|\u8fdb\u5ea6|\u51c6\u5907)/iu);
}

function hasAgentUnchangedCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:unchanged|same screen|no visible change|unknown|did not change|did not advance|\u672a\u53d8\u5316|\u6ca1\u6709\u53d8\u5316|\u65e0\u53d8\u5316|\u672a\u77e5)/iu);
}

function hasAgentActionableControlCue(text: string) {
  return hasAgentRecoveryCue(text, /(?:button|retry|continue|start|open|launch|\u6309\u94ae|\u91cd\u8bd5|\u7ee7\u7eed|\u5f00\u59cb|\u6253\u5f00|\u542f\u52a8)/iu);
}

function applyAgentRecoveryStrategyBudgets(options: {
  strategies: AgentRecoveryStrategyScore[];
  toolResults?: AgentRuntimeToolResultEntry[] | null;
}) {
  const withBudgets = options.strategies.map((strategy) => {
    const budget = getAgentRecoveryStrategyBudget(strategy.strategy);
    const used = Number.isFinite(Number(strategy.budgetUsed))
      ? Number(strategy.budgetUsed)
      : countAgentRecoveryStrategyRuns(options.toolResults, strategy.strategy);
    const max = Number.isFinite(Number(strategy.budgetMax))
      ? Number(strategy.budgetMax)
      : budget.max;
    const exhausted = used >= max;
    return {
      ...strategy,
      budgetFallback: strategy.budgetFallback ?? budget.fallback,
      budgetMax: max,
      budgetStatus: exhausted ? 'exhausted' as const : 'available' as const,
      budgetUsed: used,
      reason: exhausted
        ? `${strategy.reason}; strategy budget exhausted, prefer fallback ${strategy.budgetFallback ?? budget.fallback}`
        : strategy.reason,
      score: exhausted ? Math.max(1, strategy.score - 45) : strategy.score,
    };
  });
  const existingStrategies = new Set(withBudgets.map((strategy) => strategy.strategy));
  const fallbackStrategies: AgentRecoveryStrategyScore[] = [];

  for (const strategy of withBudgets) {
    if (
      strategy.budgetStatus !== 'exhausted'
      || !strategy.budgetFallback
      || existingStrategies.has(strategy.budgetFallback)
    ) {
      continue;
    }

    const fallbackBudget = getAgentRecoveryStrategyBudget(strategy.budgetFallback);
    const fallbackUsed = countAgentRecoveryStrategyRuns(options.toolResults, strategy.budgetFallback);
    fallbackStrategies.push({
      budgetFallback: fallbackBudget.fallback,
      budgetMax: fallbackBudget.max,
      budgetStatus: fallbackUsed >= fallbackBudget.max ? 'exhausted' : 'available',
      budgetUsed: fallbackUsed,
      reason: `fallback because ${strategy.strategy} reached ${strategy.budgetUsed}/${strategy.budgetMax}`,
      score: Math.max(50, Math.min(84, strategy.score + 40)),
      strategy: strategy.budgetFallback,
      tool: strategy.budgetFallback === 'final_blocked_with_evidence'
        ? 'final_answer'
        : strategy.budgetFallback.startsWith('ask_user')
          ? 'ask_user'
          : 'locate_screen_elements',
    });
    existingStrategies.add(strategy.budgetFallback);
  }

  return [...withBudgets, ...fallbackStrategies];
}

function createAgentRecoveryStrategyText(strategies: AgentRecoveryStrategyScore[]) {
  if (!strategies.length) {
    return '';
  }

  const bestByKey = new Map<string, AgentRecoveryStrategyScore>();
  for (const strategy of strategies) {
    const key = `${strategy.strategy}:${strategy.tool}`;
    const existing = bestByKey.get(key);
    if (!existing || existing.score < strategy.score) {
      bestByKey.set(key, strategy);
    }
  }

  return [...bestByKey.values()]
    .sort((a, b) => b.score - a.score || a.strategy.localeCompare(b.strategy))
    .slice(0, 5)
    .map((strategy, index) => [
      `${index + 1}. score=${strategy.score}`,
      `strategy=${strategy.strategy}`,
      `tool=${strategy.tool}`,
      strategy.budgetStatus ? `budget=${strategy.budgetStatus}` : '',
      Number.isFinite(Number(strategy.budgetUsed)) && Number.isFinite(Number(strategy.budgetMax))
        ? `used=${strategy.budgetUsed}/${strategy.budgetMax}`
        : '',
      strategy.budgetFallback ? `fallback=${strategy.budgetFallback}` : '',
      `reason=${compactAgentPlanningSignalText(strategy.reason, 220)}`,
    ].filter(Boolean).join(' '))
    .join(' | ');
}

function normalizeAgentScreenPoint(
  point: AgentStructuredToolEvidence['elementCenter'] | AgentStructuredToolCandidateEvidence['center'],
) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const coordinateSpace = point?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  return coordinateSpace === 'native-screen' ? { x, y } : null;
}

function normalizeAgentRectCenter(rect: AgentStructuredToolEvidence['elementBounds']) {
  const x = Number(rect?.x);
  const y = Number(rect?.y);
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  const coordinateSpace = rect?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  return coordinateSpace === 'native-screen'
    ? { x: x + width / 2, y: y + height / 2 }
    : null;
}

function hasAgentVisualActionPoint(evidence: AgentStructuredToolEvidence | null) {
  const coordinateAuditStatus = evidence?.coordinateAuditStatus ?? evidence?.coordinateAudit?.status ?? null;
  if (coordinateAuditStatus && coordinateAuditStatus !== 'coordinate_ok') {
    return false;
  }

  if (
    normalizeAgentScreenPoint(evidence?.elementCenter)
    || normalizeAgentRectCenter(evidence?.elementBounds)
  ) {
    return true;
  }

  const ratioX = Number(evidence?.elementCenterRatio?.x);
  const ratioY = Number(evidence?.elementCenterRatio?.y);
  const sourceX = Number(evidence?.sourceBounds?.x);
  const sourceY = Number(evidence?.sourceBounds?.y);
  const sourceWidth = Number(evidence?.sourceBounds?.width);
  const sourceHeight = Number(evidence?.sourceBounds?.height);
  const sourceCoordinateSpace = evidence?.sourceBounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  return Boolean(
    Number.isFinite(ratioX)
    && Number.isFinite(ratioY)
    && ratioX >= 0
    && ratioX <= 1
    && ratioY >= 0
    && ratioY <= 1
    && [sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite)
    && sourceWidth > 0
    && sourceHeight > 0
    && sourceCoordinateSpace === 'native-screen'
  );
}

export function createAgentRankedRecoveryStrategies(options: {
  dependencies: AgentRecoveryStrategyRankingDependencies;
  entry: AgentRuntimeToolResultEntry;
  postActionState?: string | null;
  previousAttemptSignature?: string | null;
  toolResults?: AgentRuntimeToolResultEntry[] | null;
}) {
  const { entry, previousAttemptSignature } = options;
  const result = entry.result;
  const structuredEvidence = getAgentStructuredEvidence(entry);
  const postActionState = (options.postActionState || getAgentPostActionState(entry) || 'unknown').trim().toLowerCase();
  const readiness = structuredEvidence?.visualActionReadiness ?? null;
  const targetCandidates = Array.isArray(structuredEvidence?.targetCandidates)
    ? structuredEvidence.targetCandidates
    : [];
  const actionCandidates = Array.isArray(structuredEvidence?.actionCandidates)
    ? structuredEvidence.actionCandidates
    : [];
  const hasCandidateLocation = [...targetCandidates, ...actionCandidates].some(hasAgentCandidateLocationEvidence);
  const hasPoint = hasAgentVisualActionPoint(structuredEvidence);
  const missingText = [
    ...(result.stateSummary?.missingEvidence ?? []),
    ...(result.stateSummary?.recommendedRecovery ?? []),
    result.errorText ?? '',
    result.responseText ?? '',
    ...(result.observations ?? []),
  ].join('\n').toLowerCase();
  const strategies: AgentRecoveryStrategyScore[] = [];
  const addStrategy = (strategy: AgentRecoveryStrategyScore) => {
    strategies.push({
      ...strategy,
      score: Math.max(1, Math.min(100, Math.round(strategy.score))),
    });
  };

  if (postActionState === 'login_required' || hasAgentLoginCue(missingText)) {
    addStrategy({
      reason: 'login/account continuation appears required; locate safe login/continue controls first and ask the user only for captcha, QR scan, 2FA, empty credentials, or admin confirmation',
      score: 96,
      strategy: 'refresh_or_relocate_target',
      tool: 'locate_screen_elements',
    });
  }

  if (
    postActionState === 'loading'
    || postActionState === 'updating'
    || hasAgentTransitionalCue(missingText)
  ) {
    const waitBudgetMax = options.dependencies.resolveAutoRecoveryMaxWaits(
      postActionState,
      entry,
      options.toolResults ?? undefined,
    );
    const waitBudgetUsed = options.dependencies.countAutoRecoveryWaits(
      options.toolResults ?? [],
      postActionState,
    );
    const waitBudgetExhausted = waitBudgetMax > 0 && waitBudgetUsed >= waitBudgetMax;
    addStrategy({
      budgetFallback: 'read_error_or_recovery_controls',
      budgetMax: waitBudgetMax || undefined,
      budgetUsed: waitBudgetMax ? waitBudgetUsed : undefined,
      reason: waitBudgetExhausted
        ? 'UI still appears transitional, but the automatic wait budget for this post-action state is exhausted'
        : 'UI still appears transitional, so waiting gives better evidence than clicking',
      score: waitBudgetExhausted
        ? 48
        : postActionState === 'updating' ? 94 : 91,
      strategy: 'wait_and_observe',
      tool: 'execute_desktop_observation',
    });
  }

  if (readiness === 'ready' && hasPoint) {
    addStrategy({
      reason: previousAttemptSignature
        ? 'target/action/coordinate are ready, but the retry must change the previous primitive or use new evidence'
        : 'target/action/coordinate are ready for a permission-gated action',
      score: previousAttemptSignature ? 89 : 94,
      strategy: previousAttemptSignature ? 'execute_adjusted_action' : 'execute_ready_action',
      tool: 'execute_desktop_sequence',
    });
  }

  if (
    hasCandidateLocation
    && (
      targetCandidates.length + actionCandidates.length > 1
      || readiness === 'needs-target-selection'
      || readiness === 'needs-primary-action'
      || readiness === 'needs-relation'
      || readiness === 'low-confidence'
    )
  ) {
    addStrategy({
      reason: 'candidate regions exist but target/action/relation confidence is not decisive',
      score: 90,
      strategy: 'focus_candidate_crop',
      tool: 'locate_screen_elements',
    });
  }

  if (readiness === 'needs-coordinate' || hasAgentCoordinateCue(missingText)) {
    addStrategy({
      reason: 'action target lacks reliable coordinate or bounds evidence',
      score: 88,
      strategy: 'relocate_with_coordinates',
      tool: 'locate_screen_elements',
    });
  }

  if (
    readiness === 'needs-primary-action'
    || readiness === 'needs-relation'
    || hasAgentTargetActionRelationCue(missingText)
  ) {
    addStrategy({
      reason: 'target/action association is still unclear',
      score: 86,
      strategy: 'clarify_target_action_relation',
      tool: 'locate_screen_elements',
    });
  }

  if (
    postActionState === 'unchanged'
    || postActionState === 'unknown'
    || hasAgentUnchangedCue(missingText)
  ) {
    addStrategy({
      reason: 'last action did not visibly advance the UI, so refresh target evidence before retrying',
      score: postActionState === 'unchanged' ? 85 : 78,
      strategy: 'refresh_or_relocate_target',
      tool: 'locate_screen_elements',
    });
  }

  if (/(?:capture\s+source|source\s+bounds|sourceid|window|active\s+window|display|\u622a\u56fe\u6e90|\u7a97\u53e3|\u6d3b\u52a8\u7a97\u53e3|\u5c4f\u5e55|\u663e\u793a\u5668)/iu.test(missingText)) {
    addStrategy({
      reason: 'source/window/display evidence is insufficient for reliable input coordinates',
      score: 82,
      strategy: 'observe_window_or_capture_source',
      tool: 'observe_windows_and_apps',
    });
  }

  if (postActionState === 'error' || hasAgentErrorCue(missingText)) {
    addStrategy({
      reason: 'visible error evidence should be read or reported before another action',
      score: hasPoint ? 80 : 87,
      strategy: 'read_error_or_recovery_controls',
      tool: 'locate_screen_elements',
    });
  }

  if (postActionState === 'blocked' || hasAgentBlockerCue(missingText)) {
    addStrategy({
      reason: 'a blocker, modal, or permission gate appears to be preventing progress',
      score: hasPoint ? 79 : 87,
      strategy: 'read_blocker_or_gate',
      tool: 'locate_screen_elements',
    });
  }

  if (
    !strategies.length
    || (
      (postActionState === 'error' || postActionState === 'blocked')
      && !hasPoint
      && !hasCandidateLocation
      && !hasAgentActionableControlCue(missingText)
    )
  ) {
    addStrategy({
      reason: 'no safe actionable recovery is evident yet; report only concrete blocker evidence',
      score: strategies.length ? 45 : 60,
      strategy: 'final_blocked_with_evidence',
      tool: 'final_answer',
    });
  }

  return createAgentRecoveryStrategyText(
    applyAgentRecoveryStrategyBudgets({
      strategies,
      toolResults: options.toolResults,
    }),
  );
}
