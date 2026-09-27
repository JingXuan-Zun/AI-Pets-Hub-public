import {
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
} from '../agentChatCommand';
import {
  createAgentAttemptedActionCoverage,
  createAgentRequestedActionCoverage,
  hasAgentDirectActionIntent,
  isAgentActionKindCovered,
  type AgentActionCoverageDependencies,
} from './agentActionCoverage';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export const AGENT_RUNTIME_TARGET_RESOLUTION_MARKER = 'AgentRuntime target resolution';

export interface AgentTargetResolutionContext {
  alreadyResolvedSinceLastDispatch: boolean;
  directActionRequested: boolean;
  missingInAppActionCoverage: boolean;
  sourceHwnd?: number | null;
  sourceQuery?: string | null;
  targetText?: string | null;
  windowEvidenceAvailable: boolean;
}

function getStructuredEvidence(
  entry: AgentRuntimeToolResultEntry | null,
): AgentStructuredToolEvidence | null {
  return entry?.result.stateSummary?.structuredEvidence
    ?? entry?.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

function isUsableTargetEvidence(entry: AgentRuntimeToolResultEntry) {
  const receiptStatus = entry.result.receipt?.status?.trim().toLowerCase();
  return entry.result.ok === true
    && receiptStatus !== 'failed'
    && receiptStatus !== 'blocked'
    && receiptStatus !== 'unverified'
    && getStructuredEvidence(entry)?.observationFreshness !== 'stale-fallback';
}

function getToolInputAction(entry: AgentRuntimeToolResultEntry) {
  const action = entry.command.toolCall?.input.action;
  return typeof action === 'string' ? action.trim() : '';
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

function normalizeSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/gu, '').trim().toLowerCase()
    : '';
}

export function resolveAgentObservedWindowTargetEvidence(options: {
  queryCandidates: string[];
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentStructuredToolWindowEvidence | null {
  const normalizedIntent = normalizeSearchText(`${options.sourceText} ${options.userGoal}`);
  const normalizedQueries = options.queryCandidates
    .map(normalizeSearchText)
    .filter(Boolean);
  const matches = new Map<number, {
    score: number;
    window: AgentStructuredToolWindowEvidence;
  }>();

  const scoreWindow = (
    window: AgentStructuredToolWindowEvidence | null | undefined,
    candidateText: string,
  ) => {
    const hwnd = Number(window?.hwnd);
    if (!window || !Number.isFinite(hwnd) || hwnd <= 0) {
      return;
    }

    const normalizedProcessName = normalizeSearchText(window.processName);
    const normalizedTitle = normalizeSearchText(window.title);
    const normalizedCandidateText = normalizeSearchText(candidateText);
    let score = 0;
    if (normalizedProcessName && normalizedIntent.includes(normalizedProcessName)) {
      score += 100;
    }
    if (normalizedTitle && normalizedIntent.includes(normalizedTitle)) {
      score += 80;
    }
    if (normalizedCandidateText && normalizedIntent.includes(normalizedCandidateText)) {
      score += 40;
    }

    for (const query of normalizedQueries) {
      if (normalizedProcessName && (normalizedProcessName.includes(query) || query.includes(normalizedProcessName))) {
        score += 70;
      }
      if (normalizedTitle && (normalizedTitle.includes(query) || query.includes(normalizedTitle))) {
        score += 60;
      }
      if (normalizedCandidateText && (normalizedCandidateText.includes(query) || query.includes(normalizedCandidateText))) {
        score += 30;
      }
    }

    if (score <= 0) {
      return;
    }

    const normalizedHwnd = Math.round(hwnd);
    const current = matches.get(normalizedHwnd);
    if (!current || score > current.score) {
      matches.set(normalizedHwnd, { score, window });
    }
  };

  for (const entry of options.toolResults) {
    const evidence = getStructuredEvidence(entry);
    if (!evidence) {
      continue;
    }

    scoreWindow(evidence.finalWindow, [
      evidence.finalWindow?.processName,
      evidence.finalWindow?.title,
    ].filter(Boolean).join(' '));
    for (const candidate of [
      ...(evidence.targetCandidates ?? []),
      ...(evidence.actionCandidates ?? []),
    ]) {
      scoreWindow(candidate.window, [
        candidate.name,
        candidate.label,
        candidate.description,
      ].filter(Boolean).join(' '));
    }
  }

  const ranked = [...matches.values()].sort((left, right) => right.score - left.score);
  if (!ranked.length || (ranked[1] && ranked[0].score === ranked[1].score)) {
    return null;
  }
  return ranked[0].window;
}

function cleanInAppHintText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/gu, '')
    .replace(/[。！？!?，,；;：:]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function resolveAgentTargetResolutionHints(sourceText: string, userGoal: string) {
  const patterns: Array<{
    pattern: RegExp;
    sourceIndex: number;
    targetIndex: number;
  }> = [
    {
      pattern: /(?:在|从)\s*([^，,。！？!?]{1,80}?)(?:里|里面|内|中|上|平台|启动器)\s*(?:的)?\s*(?:打开|启动|运行|开始|播放|点击|点|按)\s*([^，,。！？!?]{1,80})/iu,
      sourceIndex: 1,
      targetIndex: 2,
    },
    {
      pattern: /(?:打开|启动|运行|开始|播放|点击|点|按)\s*([^，,。！？!?]{1,80}?)(?:里|里面|内|中|上|平台|启动器)\s*(?:的)?\s*([^，,。！？!?]{1,80})/iu,
      sourceIndex: 1,
      targetIndex: 2,
    },
    {
      pattern: /\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?|play(?:ing)?|click(?:ing)?|press(?:ing)?)\b\s+(.{1,80}?)\s+\b(?:inside|within|in|from)\b\s+(.{1,80}?)(?:[.!?，,。！？]|$)/iu,
      sourceIndex: 2,
      targetIndex: 1,
    },
    {
      pattern: /\b(?:inside|within|in|from)\b\s+(.{1,80}?),?\s*\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?|play(?:ing)?|click(?:ing)?|press(?:ing)?)\b\s+(.{1,80}?)(?:[.!?，,。！？]|$)/iu,
      sourceIndex: 1,
      targetIndex: 2,
    },
    {
      pattern: /\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?|play(?:ing)?)\b\s+(.{1,80}?)\s+\b(?:using|via|through|with)\b\s+(.{1,80}?)\s+\b(?:launcher|client|app|application|platform)\b/iu,
      sourceIndex: 2,
      targetIndex: 1,
    },
    {
      pattern: /\b(?:open(?:ing)?|launch(?:ing)?|start(?:ing)?|run(?:ning)?|play(?:ing)?)\b\s+(.{1,80}?)\s+\b(?:using|via|through|with)\b\s+(.{1,80}?)(?:[.!?，,。！？]|$)/iu,
      sourceIndex: 2,
      targetIndex: 1,
    },
  ];

  const texts = [userGoal, sourceText]
    .map((value) => value.normalize('NFKC').replace(/^\/agent\b/iu, '').replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  for (const text of texts) {
    for (const { pattern, sourceIndex, targetIndex } of patterns) {
      const match = text.match(pattern);
      const sourceQuery = cleanInAppHintText(match?.[sourceIndex] ?? '');
      const targetText = cleanInAppHintText(match?.[targetIndex] ?? '');
      if (sourceQuery && targetText && sourceQuery !== targetText) {
        return { sourceQuery, targetText };
      }
    }
  }

  return null;
}

function isTargetResolutionCommand(entry: AgentRuntimeToolResultEntry) {
  if (entry.command.toolCall?.name !== 'locate_screen_elements') {
    return false;
  }

  const question = entry.command.toolCall.input.question;
  return typeof question === 'string'
    && question.includes(AGENT_RUNTIME_TARGET_RESOLUTION_MARKER);
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

function resolveWindowSourceHint(entry: AgentRuntimeToolResultEntry | null) {
  if (!entry) {
    return '';
  }

  const input = entry.command.toolCall?.input ?? {};
  const evidence = getStructuredEvidence(entry);
  const text = [
    entry.result.responseText,
    entry.result.verification,
    entry.result.receipt?.verification,
    entry.result.receipt?.evidenceLines?.join('\n'),
    entry.result.receipt?.summaryLines?.join('\n'),
    entry.result.stateSummary?.observedState?.join('\n'),
    entry.result.stateSummary?.verificationEvidence?.join('\n'),
    entry.result.observations?.join('\n'),
  ].filter(Boolean).join('\n');
  const activeTitle = /active\s+title\s*:\s*([^\n\r]+)/iu.exec(text)?.[1]?.trim();
  const activeProcess = /active\s+process\s*:\s*([^\n\r]+)/iu.exec(text)?.[1]?.trim();
  const candidates = [
    input.sourceQuery,
    input.query,
    input.target,
    input.name,
    evidence?.finalWindow?.title,
    evidence?.finalWindow?.processName,
    evidence?.targetMatched,
    activeTitle,
    activeProcess,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function hasOuterAppWindowEvidence(entry: AgentRuntimeToolResultEntry | null) {
  if (!entry || entry.result.ok === false) {
    return false;
  }

  const evidence = getStructuredEvidence(entry);
  const evidenceRecord = evidence as (Record<string, unknown> & AgentStructuredToolEvidence) | null;
  if (evidenceRecord?.finalWindow || evidenceRecord?.targetWindow || evidenceRecord?.windowMatched) {
    return true;
  }

  const toolName = entry.command.toolCall?.name ?? '';
  const action = getToolInputAction(entry);
  const text = [
    entry.result.responseText,
    entry.result.verification,
    entry.result.assessment?.summary,
    entry.result.receipt?.verification,
    entry.result.receipt?.evidenceLines?.join('\n'),
    entry.result.receipt?.summaryLines?.join('\n'),
    entry.result.stateSummary?.observedState?.join('\n'),
    entry.result.stateSummary?.verificationEvidence?.join('\n'),
    entry.result.observations?.join('\n'),
  ].filter(Boolean).join('\n');

  if (toolName === 'locate_screen_elements') {
    const sourceQuery = typeof entry.command.toolCall?.input.sourceQuery === 'string'
      ? entry.command.toolCall.input.sourceQuery.trim()
      : '';
    return !isTargetResolutionCommand(entry)
      && entry.command.toolCall?.input.sourceType === 'window'
      && Boolean(sourceQuery)
      && entry.command.toolCall.input.allowScreenFallback !== true
      && evidence?.captureTrusted !== false
      && evidence?.captureSourceType !== 'screen'
      && !/(?:capture[_ -]untrusted|capture[_ -]black[_ -]frame|screen[_ -]fallback)/iu.test(text);
  }

  if (toolName === 'execute_desktop_observation') {
    const sourceHint = resolveWindowSourceHint(entry);
    const normalizedSourceHint = normalizeSearchText(sourceHint);
    const normalizedEvidenceText = normalizeSearchText(text);
    return Boolean(
      normalizedSourceHint
      && normalizedEvidenceText.includes(normalizedSourceHint)
      && /(?:visual\s+(?:app\/window|target matched|post-action state)|running sample|title=|active\s+(?:process|title)\s*:|窗口|客户端已启动|主界面)/iu.test(text)
      && !/(?:running\s*=\s*0|no-window-match|no\s+(?:running|focusable|matching)\s+window|not\s+(?:running|open|launched|verified)|未检测到.*窗口)/iu.test(text)
    );
  }

  if (toolName === 'execute_desktop_action' && action === 'focus_window') {
    return /(?:focused\s+process|focused\s+window|window\s+focused|focus(?:ed)?|窗口已切到前台|已唤出匹配窗口)/iu.test(text)
      && !/(?:no-window-match|no\s+(?:focusable|matching)\s+window|not\s+(?:focused|found)|未找到|未检测到.*窗口)/iu.test(text);
  }

  if (
    toolName !== 'execute_desktop_action'
    || ![
      'launch_local_app',
      'open_resource',
      'open_or_focus_then_control_window',
      'open_or_focus_then_move_window_to_display',
    ].includes(action)
  ) {
    return false;
  }

  return /(?:window|窗口|hwnd|focused|focus|launched-new-process|focused-existing-window|检测到.*窗口|已检测到应用窗口)/iu.test(text)
    && !/(?:launched-unverified|window-not-detected-after-action|no-window-match|no\s+(?:focusable|matching)\s+window|未检测到.*窗口)/iu.test(text);
}

function findLatestOuterAppWindowEvidenceEntry(
  toolResults: AgentRuntimeToolResultEntry[],
) {
  return [...toolResults].reverse().find(hasOuterAppWindowEvidence) ?? null;
}

function resolveOuterAppWindowHwnd(evidence: AgentStructuredToolEvidence | null) {
  const record = evidence as (Record<string, unknown> & AgentStructuredToolEvidence) | null;
  const targetWindow = record?.targetWindow && typeof record.targetWindow === 'object'
    ? record.targetWindow as Record<string, unknown>
    : null;
  const hwnd = Number(record?.finalWindow?.hwnd ?? targetWindow?.hwnd ?? record?.hwnd);
  return Number.isFinite(hwnd) && hwnd > 0 ? Math.round(hwnd) : null;
}

export function createAgentTargetResolutionContext(options: {
  actionCoverageDependencies: AgentActionCoverageDependencies;
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentTargetResolutionContext {
  const outerAppEntry = hasOuterAppWindowEvidence(options.latestEntry)
    ? options.latestEntry
    : findLatestOuterAppWindowEvidenceEntry(options.toolResults);
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
