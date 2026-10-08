import { type AgentStructuredToolEvidence, type AgentStructuredToolWindowEvidence } from '../../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from '../agentRuntimeContract';

export const AGENT_RUNTIME_TARGET_RESOLUTION_MARKER = 'AgentRuntime target resolution';

export function getStructuredEvidence(
  entry: AgentRuntimeToolResultEntry | null,
): AgentStructuredToolEvidence | null {
  return entry?.result.stateSummary?.structuredEvidence
    ?? entry?.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

function getToolInputAction(entry: AgentRuntimeToolResultEntry) {
  const action = entry.command.toolCall?.input.action;
  return typeof action === 'string' ? action.trim() : '';
}

export function normalizeSearchText(value: unknown) {
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

export function isTargetResolutionCommand(entry: AgentRuntimeToolResultEntry) {
  if (entry.command.toolCall?.name !== 'locate_screen_elements') {
    return false;
  }

  const question = entry.command.toolCall.input.question;
  return typeof question === 'string'
    && question.includes(AGENT_RUNTIME_TARGET_RESOLUTION_MARKER);
}

export function resolveWindowSourceHint(entry: AgentRuntimeToolResultEntry | null) {
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

export function hasOuterAppWindowEvidence(entry: AgentRuntimeToolResultEntry | null) {
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

export function windowEvidenceNamesRequestedApp(entry: AgentRuntimeToolResultEntry, requestText: string) {
  const window = getStructuredEvidence(entry)?.finalWindow;
  const names = [window?.title, window?.processName, resolveWindowSourceHint(entry)]
    .map(normalizeSearchText)
    .filter((name) => name.length >= 2);
  return names.some((name) => requestText.includes(name));
}

/**
 * Latest entry with outer-app window evidence, preferring one whose window is the app the
 * user named. A focus attempt that leaves another app in front (e.g. the chat client) records
 * that app as finalWindow; resolving the in-app target there wastes vision calls on the wrong window.
 */
export function findLatestOuterAppWindowEvidenceEntry(
  toolResults: AgentRuntimeToolResultEntry[],
  requestText = '',
) {
  const withWindow = [...toolResults].reverse().filter(hasOuterAppWindowEvidence);
  return (requestText ? withWindow.find((entry) => windowEvidenceNamesRequestedApp(entry, requestText)) : null)
    ?? withWindow[0]
    ?? null;
}

export function resolveOuterAppWindowHwnd(evidence: AgentStructuredToolEvidence | null) {
  const record = evidence as (Record<string, unknown> & AgentStructuredToolEvidence) | null;
  const targetWindow = record?.targetWindow && typeof record.targetWindow === 'object'
    ? record.targetWindow as Record<string, unknown>
    : null;
  const hwnd = Number(record?.finalWindow?.hwnd ?? targetWindow?.hwnd ?? record?.hwnd);
  return Number.isFinite(hwnd) && hwnd > 0 ? Math.round(hwnd) : null;
}
