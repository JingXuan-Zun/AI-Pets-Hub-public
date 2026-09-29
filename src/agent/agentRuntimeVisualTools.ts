import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolPointEvidence,
  type AgentStructuredToolRectEvidence,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from './agentChatCommand';
import {
  analyzeAgentCaptureDataUrl,
  formatAgentCaptureQualityLine,
  type AgentCaptureQualityAnalysis,
} from './agentCaptureQuality';
import {
  createAgentCoordinateAuditEvidence,
  formatAgentCoordinateAuditLine,
} from './agentCoordinateAudit';
import {
  analyzeAgentGameSnapshot,
  summarizeAgentVisualSnapshot,
} from '../services/agentVisualSnapshotService';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

const AGENT_RUNTIME_CANCELLED_TEXT = '已终止当前 Agent 执行。';

function isAgentRuntimeCancellationRequested(runtime: AgentRuntimeExecutorContext) {
  return Boolean(runtime.signal?.aborted);
}

function createAgentRuntimeCancelledResult(target: AgentToolCallCommand | string): AgentChatCommandResult {
  const toolName = typeof target === 'string' ? target : target.name;
  return {
    errorText: AGENT_RUNTIME_CANCELLED_TEXT,
    ok: false,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${toolName}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName,
      verification: AGENT_RUNTIME_CANCELLED_TEXT,
    },
    responseText: AGENT_RUNTIME_CANCELLED_TEXT,
    verification: AGENT_RUNTIME_CANCELLED_TEXT,
  };
}

async function runCancellableAgentRuntimeTask<T>(
  runtime: AgentRuntimeExecutorContext,
  target: AgentToolCallCommand | string,
  task: Promise<T> | (() => Promise<T>),
): Promise<{ cancelled: true; result: AgentChatCommandResult } | { cancelled: false; value: T }> {
  if (isAgentRuntimeCancellationRequested(runtime)) {
    return {
      cancelled: true,
      result: createAgentRuntimeCancelledResult(target),
    };
  }

  let removeAbortListener: (() => void) | null = null;
  try {
    const taskPromise = typeof task === 'function' ? task() : task;
    const racedValue = await new Promise<T | symbol>((resolve, reject) => {
      const cancelledMarker = Symbol('agent-runtime-cancelled');
      const signal = runtime.signal;
      const handleAbort = () => resolve(cancelledMarker);

      if (signal) {
        if (signal.aborted) {
          resolve(cancelledMarker);
          return;
        }

        signal.addEventListener('abort', handleAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', handleAbort);
      }

      taskPromise.then(resolve, reject);
    });

    removeAbortListener?.();
    removeAbortListener = null;

    if (typeof racedValue === 'symbol' || isAgentRuntimeCancellationRequested(runtime)) {
      return {
        cancelled: true,
        result: createAgentRuntimeCancelledResult(target),
      };
    }

    return {
      cancelled: false,
      value: racedValue,
    };
  } finally {
    removeAbortListener?.();
  }
}

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getToolRawInputValue(toolCall: AgentToolCallCommand, key: string) {
  const input = toolCall.input ?? {};
  return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined;
}

function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getToolBooleanInputAny(toolCall: AgentToolCallCommand, keys: string[]) {
  for (const key of keys) {
    const value = getToolBooleanInput(toolCall, key);
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

function getToolNumberInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getToolNumberInputAny(toolCall: AgentToolCallCommand, keys: string[]) {
  for (const key of keys) {
    const value = getToolNumberInput(toolCall, key);
    if (typeof value === 'number') {
      return value;
    }
  }

  return undefined;
}

function normalizeAgentRuntimeVisualLookupText(value: string) {
  return value.replace(/\s+/gu, '').trim().toLowerCase();
}

function formatCaptureSourceLine(source: DesktopPetCaptureSourceLike, index: number) {
  const idText = source.id ? ` id="${source.id}"` : '';
  const displayText = source.displayId ? ` display=${source.displayId}` : '';
  const sizeText = source.width && source.height ? ` ${source.width}x${source.height}` : '';
  const thumbnailText = source.thumbnail ? ' thumbnail=yes' : ' thumbnail=no';
  const appIconText = source.appIcon ? ' appIcon=yes' : '';

  return `${index + 1}. [${source.type}] ${source.name}${idText}${sizeText}${displayText}${thumbnailText}${appIconText}`;
}

function formatCaptureSourceCandidateLines(sources: DesktopPetCaptureSourceLike[], limit = 12) {
  if (!sources.length) {
    return ['Available capture source candidates: none'];
  }

  const candidateLines = sources.slice(0, limit).map((source, index) => (
    `Available capture source candidate ${formatCaptureSourceLine(source, index)}`
  ));
  if (sources.length > limit) {
    candidateLines.push(`Available capture source candidates omitted: ${sources.length - limit}`);
  }

  return candidateLines;
}

function normalizeCaptureSourceTypesInput(value: string): Array<'screen' | 'window'> {
  if (value === 'screen') {
    return ['screen'];
  }

  if (value === 'window') {
    return ['window'];
  }

  return ['screen', 'window'];
}

export async function executeListCaptureSources(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const captureSourceTypes = normalizeCaptureSourceTypesInput(
    getToolStringInput(toolCall, ['captureSourceTypes', 'sourceType', 'type']) || 'all',
  );
  const includeCaptureThumbnails = getToolBooleanInput(toolCall, 'includeCaptureThumbnails') === true;
  const captureResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes,
    forceRefresh: getToolBooleanInput(toolCall, 'forceRefresh') === true,
    includeCaptureThumbnails,
  }) as Promise<DesktopPetCaptureSourceLike[]>);
  if (captureResult.cancelled === true) {
    return captureResult.result;
  }

  const result = captureResult.value;
  const sources = Array.isArray(result) ? result : [];
  const visibleSources = sources.slice(0, 20);
  const sourceLines = visibleSources.map(formatCaptureSourceLine);
  const screenCount = sources.filter((source) => source.type === 'screen').length;
  const windowCount = sources.filter((source) => source.type === 'window').length;
  const observations = [
    `Capture source types: ${captureSourceTypes.join(', ')}`,
    `Capture source count: ${sources.length}`,
    `Screen sources: ${screenCount}`,
    `Window sources: ${windowCount}`,
    `Thumbnails requested: ${includeCaptureThumbnails}`,
    ...sourceLines,
  ];

  return {
    observations,
    ok: true,
    receipt: {
      evidenceLines: observations.slice(0, 30),
      status: 'success',
      summaryLines: [
        '调用：list_capture_sources',
        `捕获源：${sources.length} 个`,
        `屏幕：${screenCount}，窗口：${windowCount}`,
      ],
      title: '执行回执',
      toolName: 'list_capture_sources',
      verification: `已读取 ${sources.length} 个屏幕/窗口捕获源。`,
    },
    responseText: sourceLines.length
      ? [
          `当前可用捕获源 ${sources.length} 个（屏幕 ${screenCount}，窗口 ${windowCount}）：`,
          ...sourceLines,
        ].join('\n')
      : '当前没有读取到可用的屏幕/窗口捕获源。',
    verification: `捕获源来自 Electron desktopCapturer/Windows 窗口枚举。`,
  };
}

function normalizeVisualSnapshotSourceTypeInput(value: string) {
  return value === 'screen' || value === 'window' ? value : 'all';
}

function normalizeVisualSnapshotMatchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
}

function normalizeVisualSnapshotCompactMatchText(value: unknown) {
  return normalizeVisualSnapshotMatchText(value)
    .replace(/[\s"'`“”‘’_\-:：;；,，.。|/\\()[\]{}<>《》]+/gu, '');
}

function createVisualSnapshotQueryTokens(query: string) {
  const normalizedQuery = normalizeVisualSnapshotMatchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const compactQuery = normalizeVisualSnapshotCompactMatchText(query);
  const splitTokens = normalizedQuery
    .split(/[\s"'`“”‘’_\-:：;；,，.。|/\\()[\]{}<>《》]+/u)
    .filter(Boolean);
  const fragmentTokens = normalizedQuery.match(/[a-z0-9]+|[\u3400-\u9fff]+/giu) ?? [];
  const stopTokens = new Set([
    'a',
    'an',
    'at',
    'current',
    'currently',
    'image',
    'in',
    'look',
    'open',
    'opened',
    'picture',
    'screen',
    'see',
    'the',
    'window',
  ]);

  return [...new Set([
    compactQuery,
    ...splitTokens,
    ...fragmentTokens,
  ].map((token) => normalizeVisualSnapshotCompactMatchText(token))
    .filter((token) => token.length >= 2 && !stopTokens.has(token)))];
}

function scoreVisualSnapshotSourceMatch(source: DesktopPetCaptureSourceLike, query: string) {
  const normalizedQuery = normalizeVisualSnapshotMatchText(query);
  const compactQuery = normalizeVisualSnapshotCompactMatchText(query);
  const sourceTexts = [
    source.id,
    source.name,
    source.type,
    source.displayId,
  ];
  const normalizedSourceTexts = sourceTexts.map(normalizeVisualSnapshotMatchText).filter(Boolean);
  const compactSourceTexts = sourceTexts.map(normalizeVisualSnapshotCompactMatchText).filter(Boolean);

  if (!normalizedQuery && !compactQuery) {
    return 0;
  }

  if (
    normalizedSourceTexts.some((text) => text.includes(normalizedQuery))
    || compactSourceTexts.some((text) => text.includes(compactQuery))
  ) {
    return 100 + Math.min(compactQuery.length, 50);
  }

  const tokens = createVisualSnapshotQueryTokens(query);
  return tokens.reduce((score, token) => {
    const tokenMatched = compactSourceTexts.some((text) => text.includes(token));
    return tokenMatched ? score + Math.min(30, Math.max(8, token.length * 4)) : score;
  }, 0);
}

function findBestVisualSnapshotSourceMatch(
  sources: DesktopPetCaptureSourceLike[],
  query: string,
) {
  let bestSource: DesktopPetCaptureSourceLike | null = null;
  let bestScore = 0;

  for (const source of sources) {
    const score = scoreVisualSnapshotSourceMatch(source, query);
    if (score > bestScore) {
      bestScore = score;
      bestSource = source;
    }
  }

  return bestScore >= 8 ? bestSource : null;
}

function findVisualSnapshotScreenFallbackSource(sources: DesktopPetCaptureSourceLike[]) {
  return sources.find((source) => source.type === 'screen' && Boolean(source.thumbnail))
    ?? sources.find((source) => source.type === 'screen')
    ?? null;
}

function createVisualSnapshotSourceSelectionDiagnostics(
  sources: DesktopPetCaptureSourceLike[],
  options: {
    allowScreenFallback?: boolean;
    query: string;
    rawSourceId?: unknown;
    selectedSource?: DesktopPetCaptureSourceLike | null;
    sourceId: string;
    sourceType: 'all' | 'screen' | 'window';
  },
) {
  const windowIdPrefix = options.sourceId ? getVisualSnapshotWindowIdPrefix(options.sourceId) : '';
  const exactMatchedSource = options.sourceId
    ? sources.find((source) => source.id === options.sourceId) ?? null
    : null;
  const prefixMatchedSource = windowIdPrefix
    ? sources.find((source) => source.type === 'window' && source.id.startsWith(windowIdPrefix)) ?? null
    : null;
  const queryMatchedSource = options.query ? findBestVisualSnapshotSourceMatch(sources, options.query) : null;
  const rawSourceIdText = options.rawSourceId === undefined
    ? '<absent>'
    : typeof options.rawSourceId === 'string'
      ? options.rawSourceId.trim() || '<empty-string>'
      : `<${typeof options.rawSourceId}>`;

  return [
    `Visual source selection: requestedType=${options.sourceType}`,
    `Visual source selection: requestedSourceId=${options.sourceId || '<none>'}`,
    `Visual source selection: rawSourceId=${rawSourceIdText}`,
    options.sourceId ? `Visual source selection: sourceIdExactMatch=${exactMatchedSource ? exactMatchedSource.id : '<none>'}` : '',
    windowIdPrefix ? `Visual source selection: sourceIdPrefix=${windowIdPrefix}` : '',
    windowIdPrefix ? `Visual source selection: sourceIdPrefixMatch=${prefixMatchedSource ? prefixMatchedSource.id : '<none>'}` : '',
    options.query ? `Visual source selection: query=${options.query}` : '',
    options.query ? `Visual source selection: queryBestMatch=${queryMatchedSource ? `${queryMatchedSource.id} (${queryMatchedSource.name})` : '<none>'}` : '',
    `Visual source selection: allowScreenFallback=${options.allowScreenFallback === true}`,
    options.selectedSource ? `Visual source selection: selected=${options.selectedSource.id} (${options.selectedSource.type})` : '',
  ].filter(Boolean);
}

function getVisualSnapshotWindowIdPrefix(sourceId: string) {
  const match = sourceId.match(/^(window:\d+:)/iu);
  return match?.[1] ?? '';
}

function selectVisualSnapshotSource(
  sources: DesktopPetCaptureSourceLike[],
  options: {
    allowScreenFallback?: boolean;
    query: string;
    sourceId: string;
    sourceType: 'all' | 'screen' | 'window';
  },
) {
  if (options.sourceId) {
    const exactSource = sources.find((source) => source.id === options.sourceId);
    if (exactSource) {
      return exactSource;
    }

    const windowIdPrefix = getVisualSnapshotWindowIdPrefix(options.sourceId);
    const prefixMatchedSource = windowIdPrefix
      ? sources.find((source) => source.type === 'window' && source.id.startsWith(windowIdPrefix))
      : null;
    if (prefixMatchedSource) {
      return prefixMatchedSource;
    }

    if (options.query) {
      const matchedSource = findBestVisualSnapshotSourceMatch(sources, options.query);
      if (matchedSource) {
        return matchedSource;
      }
    }

    if (options.allowScreenFallback) {
      return findVisualSnapshotScreenFallbackSource(sources);
    }

    return null;
  }

  if (options.query) {
    const matchedSource = findBestVisualSnapshotSourceMatch(sources, options.query);
    if (matchedSource) {
      return matchedSource;
    }

    if (options.allowScreenFallback) {
      return findVisualSnapshotScreenFallbackSource(sources);
    }

    return null;
  }

  if (options.sourceType === 'window') {
    return sources.find((source) => source.type === 'window') ?? null;
  }

  if (options.sourceType === 'screen') {
    return sources.find((source) => source.type === 'screen') ?? null;
  }

  return sources.find((source) => source.type === 'screen')
    ?? sources.find((source) => source.type === 'window')
    ?? null;
}

function selectGameScreenSource(
  sources: DesktopPetCaptureSourceLike[],
  options: {
    query: string;
    sourceId: string;
    sourceType: 'all' | 'screen' | 'window';
  },
) {
  if (options.sourceId) {
    const exactSource = sources.find((source) => source.id === options.sourceId);
    if (exactSource) {
      return exactSource;
    }

    return null;
  }

  if (options.query) {
    const matchedSource = findBestVisualSnapshotSourceMatch(sources, options.query);
    if (matchedSource) {
      return matchedSource;
    }

    return null;
  }

  if (options.sourceType === 'window') {
    return sources.find((source) => source.type === 'window') ?? null;
  }

  if (options.sourceType === 'screen') {
    return sources.find((source) => source.type === 'screen') ?? null;
  }

  return sources.find((source) => source.type === 'window')
    ?? sources.find((source) => source.type === 'screen')
    ?? null;
}

function compactVisualSnapshotSummary(value: string, maxLength = 900) {
  const compactText = value.replace(/\s+/gu, ' ').trim();
  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function tryParseVisualSnapshotJson(value: string): Record<string, unknown> | null {
  const trimmedValue = value.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
  const parseCandidate = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  };
  const directParse = parseCandidate(trimmedValue);
  if (directParse) {
    return directParse;
  }

  const startIndex = trimmedValue.indexOf('{');
  const endIndex = trimmedValue.lastIndexOf('}');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  return parseCandidate(trimmedValue.slice(startIndex, endIndex + 1));
}

function getVisualSnapshotStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return compactVisualSnapshotSummary(value, 260);
    }
  }

  return '';
}

function getVisualSnapshotStringListField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map(normalizeVisualSnapshotStringListItem)
        .filter(Boolean)
        .slice(0, 6);
    }

    if (typeof value === 'string' && value.trim()) {
      return [compactVisualSnapshotSummary(value, 260)];
    }
  }

  return [];
}

function getVisualSnapshotRawListField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }

    if (value !== undefined && value !== null) {
      return [value];
    }
  }

  return [];
}

function normalizeVisualSnapshotStringListItem(item: unknown) {
  if (typeof item === 'string') {
    return compactVisualSnapshotSummary(item, 180);
  }

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return '';
  }

  const record = item as Record<string, unknown>;
  const text = getVisualSnapshotStringField(record, ['text', 'label', 'name', 'title', 'value', 'snippet', 'content']);
  if (!text) {
    return '';
  }

  const details = [
    typeof record.confidence === 'string' || typeof record.confidence === 'number'
      ? `confidence=${String(record.confidence).trim()}`
      : '',
    getVisualSnapshotStringField(record, ['region', 'location', 'position']),
  ].filter(Boolean);

  return compactVisualSnapshotSummary(details.length ? `${text} (${details.join(', ')})` : text, 180);
}

function normalizeVisualSnapshotOcrTextCandidate(value: unknown): AgentStructuredToolCandidateEvidence | null {
  if (typeof value === 'string' && value.trim()) {
    return {
      confidence: null,
      label: compactVisualSnapshotSummary(value, 140),
      source: 'visual-ocr',
    } satisfies AgentStructuredToolCandidateEvidence;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const label = getVisualSnapshotStringField(record, ['text', 'label', 'name', 'title', 'value', 'snippet', 'content']);
  if (!label) {
    return null;
  }

  return {
    bounds: normalizeVisualSnapshotRectObject(
      getVisualSnapshotObjectField(record, ['bounds', 'elementBounds', 'rect', 'regionBox']),
    ),
    center: normalizeVisualSnapshotPointObject(
      getVisualSnapshotObjectField(record, ['center', 'elementCenter', 'point', 'coordinates']),
    ),
    centerRatio: normalizeVisualSnapshotRatioPointObject(
      getVisualSnapshotObjectField(record, ['centerRatio', 'elementCenterRatio', 'normalizedCenter', 'relativeCenter']),
    ),
    confidence: normalizeVisualSnapshotCandidateConfidence(record.confidence ?? record.score),
    description: getVisualSnapshotStringField(record, ['description', 'summary', 'details']),
    label,
    region: getVisualSnapshotStringField(record, ['region', 'location', 'position']),
    relation: getVisualSnapshotStringField(record, ['relation', 'targetRelation', 'association']),
    selected: normalizeVisualSnapshotBooleanField(record, ['selected', 'isSelected', 'current', 'active', 'highlighted', 'focused']),
    selectionItem: normalizeVisualSnapshotBooleanField(record, ['selectionItem', 'selectable', 'isSelectable']),
    source: 'visual-ocr',
  } satisfies AgentStructuredToolCandidateEvidence;
}

function getVisualSnapshotOcrTextCandidates(record: Record<string, unknown>) {
  return getVisualSnapshotRawListField(record, [
    'visibleTextCandidates',
    'textCandidates',
    'readableTextCandidates',
    'ocrTextCandidates',
    'ocrCandidates',
    'visibleTexts',
  ])
    .map(normalizeVisualSnapshotOcrTextCandidate)
    .filter((candidate): candidate is AgentStructuredToolCandidateEvidence => Boolean(candidate))
    .slice(0, 8);
}

function mergeVisualSnapshotCandidates(
  primary: AgentStructuredToolCandidateEvidence[],
  derived: AgentStructuredToolCandidateEvidence[],
) {
  const keys = new Set<string>();
  const makeKey = (candidate: AgentStructuredToolCandidateEvidence) => [
    candidate.label?.normalize('NFKC').trim().toLowerCase() ?? '',
    candidate.region?.normalize('NFKC').trim().toLowerCase() ?? '',
    Number.isFinite(Number(candidate.centerRatio?.x)) ? Number(candidate.centerRatio?.x).toFixed(3) : '',
    Number.isFinite(Number(candidate.centerRatio?.y)) ? Number(candidate.centerRatio?.y).toFixed(3) : '',
    Number.isFinite(Number(candidate.bounds?.x)) ? Number(candidate.bounds?.x).toFixed(3) : '',
    Number.isFinite(Number(candidate.bounds?.y)) ? Number(candidate.bounds?.y).toFixed(3) : '',
  ].join('|');

  return [...primary, ...derived].filter((candidate) => {
    const key = makeKey(candidate);
    if (keys.has(key)) {
      return false;
    }

    keys.add(key);
    return true;
  }).slice(0, 8);
}

function deriveVisualSnapshotCandidatesFromOcr(options: {
  explicitPrimaryAction: string;
  explicitTargetMatched: string;
  ocrCandidates: AgentStructuredToolCandidateEvidence[];
  summaryText: string;
}) {
  const targetHint = options.explicitTargetMatched || options.summaryText;
  const actionHint = [
    options.explicitTargetMatched,
    options.explicitPrimaryAction,
    options.summaryText,
  ].filter(Boolean).join(' ');
  const targetCandidates = options.ocrCandidates
    .filter((candidate) => !isVisualSnapshotActionCandidateText(getVisualSnapshotCandidateSearchText(candidate)))
    .sort((first, second) => (
      scoreVisualSnapshotCandidateChoice({
        candidate: second,
        index: 0,
        kind: 'target',
        targetHint,
      }).score
      - scoreVisualSnapshotCandidateChoice({
        candidate: first,
        index: 0,
        kind: 'target',
        targetHint,
      }).score
    ))
    .slice(0, 4);
  const actionCandidates = options.ocrCandidates
    .filter((candidate) => isVisualSnapshotActionCandidateText(getVisualSnapshotCandidateSearchText(candidate)))
    .sort((first, second) => (
      scoreVisualSnapshotCandidateChoice({
        candidate: second,
        index: 0,
        kind: 'action',
        targetHint: actionHint,
      }).score
      - scoreVisualSnapshotCandidateChoice({
        candidate: first,
        index: 0,
        kind: 'action',
        targetHint: actionHint,
      }).score
    ))
    .slice(0, 4);

  return {
    actionCandidates,
    targetCandidates,
  };
}

function createVisualSnapshotOcrDerivedRelation(options: {
  actionCandidate: AgentStructuredToolCandidateEvidence | null;
  actionCandidates: AgentStructuredToolCandidateEvidence[];
  targetCandidate: AgentStructuredToolCandidateEvidence | null;
  targetCandidates: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}) {
  if (!options.targetMatched || !options.targetCandidate || !options.actionCandidate) {
    return '';
  }

  const targetFromOcr = options.targetCandidate.source === 'visual-ocr'
    || options.targetCandidates.some((candidate) => candidate.source === 'visual-ocr');
  const actionFromOcr = options.actionCandidate.source === 'visual-ocr'
    || options.actionCandidates.some((candidate) => candidate.source === 'visual-ocr');
  if (!targetFromOcr || !actionFromOcr) {
    return '';
  }

  const actionLabel = getVisualSnapshotCandidateLabel(options.actionCandidate);
  return actionLabel
    ? `OCR matched "${actionLabel}" as the primary action near/with "${options.targetMatched}".`
    : `OCR matched a primary action candidate near/with "${options.targetMatched}".`;
}

function normalizeVisualSnapshotCoordinateValue(value: unknown) {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getVisualSnapshotObjectField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function normalizeVisualSnapshotRatioValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  if (value > 1 && value <= 100) {
    return Math.max(0, Math.min(1, value / 100));
  }

  if (value >= 0 && value <= 1) {
    return value;
  }

  return null;
}

function roundVisualSnapshotRatioValue(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function normalizeVisualSnapshotPointObject(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  const x = normalizeVisualSnapshotCoordinateValue(value.x ?? value.left ?? value.centerX ?? value.cx);
  const y = normalizeVisualSnapshotCoordinateValue(value.y ?? value.top ?? value.centerY ?? value.cy);
  if (x === null || y === null) {
    return null;
  }

  return {
    coordinateSpace: typeof value.coordinateSpace === 'string' ? value.coordinateSpace : undefined,
    source: typeof value.source === 'string' ? value.source : undefined,
    x,
    y,
  } satisfies AgentStructuredToolPointEvidence;
}

function normalizeVisualSnapshotRatioPointObject(value: Record<string, unknown> | null) {
  const point = normalizeVisualSnapshotPointObject(value);
  if (!point) {
    return null;
  }

  const x = normalizeVisualSnapshotRatioValue(point.x ?? null);
  const y = normalizeVisualSnapshotRatioValue(point.y ?? null);
  if (x === null || y === null) {
    return null;
  }

  return {
    ...point,
    coordinateSpace: point.coordinateSpace ?? 'source-ratio',
    x,
    y,
  } satisfies AgentStructuredToolPointEvidence;
}

function normalizeVisualSnapshotRectObject(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  const x = normalizeVisualSnapshotCoordinateValue(value.x ?? value.left);
  const y = normalizeVisualSnapshotCoordinateValue(value.y ?? value.top);
  const width = normalizeVisualSnapshotCoordinateValue(value.width ?? value.w);
  const height = normalizeVisualSnapshotCoordinateValue(value.height ?? value.h);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  const coordinateSpace = typeof value.coordinateSpace === 'string' ? value.coordinateSpace : undefined;
  const inferredCoordinateSpace = coordinateSpace
    ?? ([x, y, width, height].every((item) => item >= 0 && item <= 1) ? 'source-ratio' : undefined);

  return {
    coordinateSpace: inferredCoordinateSpace,
    height,
    source: typeof value.source === 'string' ? value.source : undefined,
    width,
    x,
    y,
  } satisfies AgentStructuredToolRectEvidence;
}

function normalizeVisualSnapshotCandidateConfidence(value: unknown) {
  const numericValue = getVisualSnapshotConfidenceValue(value);
  if (numericValue !== null) {
    return numericValue >= 0.8 ? 'high' : numericValue >= 0.6 ? 'medium' : 'low';
  }

  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return null;
  }

  if (/^(?:high|sure|clear|confident|高|明确|清楚)$/iu.test(text)) {
    return 'high';
  }

  if (/^(?:medium|moderate|possible|maybe|中|可能)$/iu.test(text)) {
    return 'medium';
  }

  if (/^(?:low|unclear|weak|uncertain|低|不确定|不清楚)$/iu.test(text)) {
    return 'low';
  }

  return null;
}

function normalizeVisualSnapshotCandidate(value: unknown): AgentStructuredToolCandidateEvidence | null {
  if (typeof value === 'string' && value.trim()) {
    return {
      label: compactVisualSnapshotSummary(value, 140),
    } satisfies AgentStructuredToolCandidateEvidence;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const label = getVisualSnapshotStringField(record, ['label', 'name', 'text', 'title', 'target', 'action']);
  const description = getVisualSnapshotStringField(record, ['description', 'summary', 'details']);
  const region = getVisualSnapshotStringField(record, ['region', 'elementRegion', 'location', 'position']);
  const relation = getVisualSnapshotStringField(record, ['relation', 'targetRelation', 'association']);
  const selected = normalizeVisualSnapshotBooleanField(record, ['selected', 'isSelected', 'current', 'active', 'highlighted', 'focused']);
  const selectionItem = normalizeVisualSnapshotBooleanField(record, ['selectionItem', 'selectable', 'isSelectable']);
  const center = normalizeVisualSnapshotPointObject(
    getVisualSnapshotObjectField(record, ['center', 'elementCenter', 'point', 'coordinates']),
  );
  const centerRatio = normalizeVisualSnapshotRatioPointObject(
    getVisualSnapshotObjectField(record, ['centerRatio', 'elementCenterRatio', 'normalizedCenter', 'relativeCenter']),
  );
  const bounds = normalizeVisualSnapshotRectObject(
    getVisualSnapshotObjectField(record, ['bounds', 'elementBounds', 'rect', 'regionBox']),
  );
  const confidence = normalizeVisualSnapshotCandidateConfidence(record.confidence ?? record.score);

  if (!label && !description && !region && !center && !centerRatio && !bounds && !relation) {
    return null;
  }

  return {
    bounds,
    center,
    centerRatio,
    confidence,
    description,
    label,
    region,
    relation,
    selected,
    selectionItem,
  } satisfies AgentStructuredToolCandidateEvidence;
}

function normalizeVisualSnapshotBooleanField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const text = value.normalize('NFKC').trim().toLowerCase();
      if (/^(?:true|yes|selected|active|current|highlighted|focused|是|已选中|选中|当前|高亮)$/iu.test(text)) {
        return true;
      }
      if (/^(?:false|no|not selected|inactive|unselected|不是|未选中|没有选中|非当前)$/iu.test(text)) {
        return false;
      }
    }
  }

  return null;
}

function getVisualSnapshotCandidateListField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map(normalizeVisualSnapshotCandidate)
        .filter((candidate): candidate is AgentStructuredToolCandidateEvidence => Boolean(candidate))
        .slice(0, 6);
    }

    const candidate = normalizeVisualSnapshotCandidate(value);
    if (candidate) {
      return [candidate];
    }
  }

  return [];
}

function getSingleHighConfidenceVisualSnapshotCandidate(
  candidates: AgentStructuredToolCandidateEvidence[],
) {
  const highConfidenceCandidates = candidates.filter((candidate) => candidate.confidence === 'high');
  return highConfidenceCandidates.length === 1 ? highConfidenceCandidates[0] ?? null : null;
}

function hasVisualSnapshotCandidateLocationEvidence(candidate: AgentStructuredToolCandidateEvidence) {
  return Boolean(
    candidate.center
      || candidate.centerRatio
      || candidate.bounds
      || candidate.region?.trim()
  );
}

function getVisualSnapshotCandidateSearchText(candidate: AgentStructuredToolCandidateEvidence) {
  return [
    candidate.label,
    candidate.name,
    candidate.description,
    candidate.region,
    candidate.relation,
    candidate.controlType,
    candidate.automationId,
    ...(candidate.actions ?? []),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join(' ')
    .normalize('NFKC')
    .toLowerCase();
}

function isVisualSnapshotActionCandidateText(text: string) {
  return /(?:\b(?:start|open|launch|play|run|resume|continue|retry|enter|install|update|repair|button|primary)\b|\u5f00\u59cb|\u542f\u52a8|\u6253\u5f00|\u8fd0\u884c|\u7ee7\u7eed|\u91cd\u8bd5|\u8fdb\u5165|\u64ad\u653e|\u5b89\u88c5|\u66f4\u65b0|\u4fee\u590d|\u6309\u94ae|\u4e3b\u64cd\u4f5c)/iu.test(text);
}

function isVisualSnapshotNegativeRelationText(text: string) {
  return /(?:\b(?:unrelated|not\s+(?:related|associated|connected|belongs?)|does\s+not\s+belong|wrong\s+target|separate)\b|\u65e0\u5173|\u4e0d\u76f8\u5173|\u4e0d\u5c5e\u4e8e|\u4e0d\u5bf9\u5e94|\u9519\u8bef\u76ee\u6807)/iu.test(text);
}

function getVisualSnapshotCandidateConfidenceScore(candidate: AgentStructuredToolCandidateEvidence) {
  switch (candidate.confidence) {
    case 'high':
      return 36;
    case 'medium':
      return 18;
    case 'low':
      return -18;
    default:
      return 0;
  }
}

function getVisualSnapshotActionShapeScore(candidate: AgentStructuredToolCandidateEvidence) {
  const bounds = candidate.bounds;
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(bounds?.coordinateSpace);
  const ratioLikeBounds = coordinateSpace.includes('ratio') || (width <= 1 && height <= 1);
  const area = width * height;
  const aspectRatio = width / height;

  if (ratioLikeBounds) {
    if (area >= 0.09 || width >= 0.42 || height >= 0.24) {
      return -28;
    }
    if (area <= 0.04 && width >= 0.06 && height >= 0.025 && aspectRatio >= 1.4 && aspectRatio <= 8) {
      return 18;
    }
    if (area <= 0.025) {
      return 10;
    }
    return 0;
  }

  if (area >= 150_000 || width >= 620 || height >= 260) {
    return -28;
  }
  if (area <= 55_000 && width >= 70 && height >= 24 && aspectRatio >= 1.4 && aspectRatio <= 8) {
    return 18;
  }
  if (area <= 32_000) {
    return 10;
  }

  return 0;
}

function getVisualSnapshotCandidateTargetHintScore(
  candidate: AgentStructuredToolCandidateEvidence,
  targetHint: string,
) {
  const hint = normalizeVisualSnapshotCompactMatchText(targetHint);
  if (!hint) {
    return 0;
  }

  const candidateLabel = normalizeVisualSnapshotCompactMatchText(getVisualSnapshotCandidateLabel(candidate));
  if (candidateLabel && (hint.includes(candidateLabel) || candidateLabel.includes(hint))) {
    return 48;
  }

  const candidateText = normalizeVisualSnapshotCompactMatchText(
    getVisualSnapshotCandidateSearchText(candidate),
  );
  if (!candidateText) {
    return 0;
  }

  if (candidateText.includes(hint) || hint.includes(candidateText)) {
    return 28;
  }

  const tokens = createVisualSnapshotQueryTokens(targetHint);
  return Math.min(20, tokens.filter((token) => candidateText.includes(token)).length * 6);
}

function getVisualSnapshotCandidateApproxPoint(
  candidate: AgentStructuredToolCandidateEvidence,
) {
  return normalizeVisualSnapshotRatioPointEvidence(candidate.centerRatio)
    ?? normalizeVisualSnapshotRatioPointEvidence(candidate.center)
    ?? createVisualSnapshotRatioPointFromBounds(candidate.bounds)
    ?? normalizeVisualSnapshotScreenPointEvidence(candidate.center)
    ?? createVisualSnapshotCandidatePointFromBounds(normalizeVisualSnapshotScreenRectEvidence(candidate.bounds));
}

function getVisualSnapshotCandidateActionAssociationScore(options: {
  actionCandidate: AgentStructuredToolCandidateEvidence;
  targetCandidate?: AgentStructuredToolCandidateEvidence | null;
  targetCandidates?: AgentStructuredToolCandidateEvidence[] | null;
}) {
  const targetCandidate = options.targetCandidate;
  if (!targetCandidate) {
    return 0;
  }

  let score = 0;
  const targetLabel = getVisualSnapshotCandidateLabel(targetCandidate);
  const targetLabelCompact = normalizeVisualSnapshotCompactMatchText(targetLabel);
  const actionRelationCompact = normalizeVisualSnapshotCompactMatchText(options.actionCandidate.relation);
  const actionSearchCompact = normalizeVisualSnapshotCompactMatchText(
    getVisualSnapshotCandidateSearchText(options.actionCandidate),
  );

  if (targetLabelCompact) {
    if (actionRelationCompact.includes(targetLabelCompact)) {
      score += 58;
    } else if (actionSearchCompact.includes(targetLabelCompact)) {
      score += 34;
    }
  }

  for (const otherTarget of options.targetCandidates ?? []) {
    if (otherTarget === targetCandidate) {
      continue;
    }

    const otherLabelCompact = normalizeVisualSnapshotCompactMatchText(getVisualSnapshotCandidateLabel(otherTarget));
    if (
      otherLabelCompact
      && otherLabelCompact !== targetLabelCompact
      && actionRelationCompact.includes(otherLabelCompact)
      && (!targetLabelCompact || !actionRelationCompact.includes(targetLabelCompact))
    ) {
      score -= 46;
    }
  }

  const targetPoint = getVisualSnapshotCandidateApproxPoint(targetCandidate);
  const actionPoint = getVisualSnapshotCandidateApproxPoint(options.actionCandidate);
  if (!targetPoint || !actionPoint || targetPoint.coordinateSpace !== actionPoint.coordinateSpace) {
    return score;
  }

  const dx = Number(actionPoint.x) - Number(targetPoint.x);
  const dy = Math.abs(Number(actionPoint.y) - Number(targetPoint.y));
  const distance = Math.hypot(dx, dy);
  const coordinateSpace = getVisualSnapshotCoordinateSpace(actionPoint.coordinateSpace);
  if (coordinateSpace.includes('ratio')) {
    if (dy <= 0.04) {
      score += 44;
    } else if (dy <= 0.08) {
      score += 30;
    } else if (dy <= 0.14) {
      score += 12;
    } else if (dy >= 0.28) {
      score -= 18;
    }

    if (dx >= -0.04 && dx <= 0.8) {
      score += 12;
    }
    if (distance <= 0.18) {
      score += 18;
    } else if (distance <= 0.42) {
      score += 8;
    } else if (distance >= 0.75) {
      score -= 10;
    }
  } else {
    if (dy <= 48) {
      score += 44;
    } else if (dy <= 96) {
      score += 30;
    } else if (dy <= 170) {
      score += 12;
    } else if (dy >= 320) {
      score -= 18;
    }

    if (dx >= -48 && dx <= 900) {
      score += 12;
    }
    if (distance <= 180) {
      score += 18;
    } else if (distance <= 420) {
      score += 8;
    } else if (distance >= 900) {
      score -= 10;
    }
  }

  return score;
}

function scoreVisualSnapshotCandidateChoice(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  index: number;
  kind: 'action' | 'target';
  targetCandidate?: AgentStructuredToolCandidateEvidence | null;
  targetCandidates?: AgentStructuredToolCandidateEvidence[] | null;
  targetHint?: string;
}) {
  const candidateText = getVisualSnapshotCandidateSearchText(options.candidate);
  let score = getVisualSnapshotCandidateConfidenceScore(options.candidate) - options.index;
  if (getVisualSnapshotCandidateLabel(options.candidate)) {
    score += 8;
  }
  if (hasVisualSnapshotCandidateLocationEvidence(options.candidate)) {
    score += 14;
  }
  if (options.candidate.center || options.candidate.centerRatio || options.candidate.bounds) {
    score += 16;
  }
  if (options.candidate.relation?.trim()) {
    score += 10;
  }
  if (isVisualSnapshotNegativeRelationText(candidateText)) {
    score -= 42;
  }
  if (options.kind === 'action' && isVisualSnapshotActionCandidateText(candidateText)) {
    score += 26;
  }
  if (options.kind === 'action') {
    score += getVisualSnapshotActionShapeScore(options.candidate);
  }
  if (options.kind === 'target') {
    score += getVisualSnapshotCandidateTargetHintScore(options.candidate, options.targetHint ?? '');
  } else {
    score += getVisualSnapshotCandidateTargetHintScore(options.candidate, options.targetHint ?? '');
  }
  if (options.kind === 'action') {
    score += getVisualSnapshotCandidateActionAssociationScore({
      actionCandidate: options.candidate,
      targetCandidate: options.targetCandidate,
      targetCandidates: options.targetCandidates,
    });
  }

  return {
    candidate: options.candidate,
    score,
  };
}

function resolveBestVisualSnapshotCandidate(options: {
  candidates: AgentStructuredToolCandidateEvidence[];
  kind: 'action' | 'target';
  targetCandidate?: AgentStructuredToolCandidateEvidence | null;
  targetCandidates?: AgentStructuredToolCandidateEvidence[] | null;
  targetHint?: string;
}) {
  if (!options.candidates.length) {
    return null;
  }

  const singleHighConfidenceCandidate = getSingleHighConfidenceVisualSnapshotCandidate(options.candidates);
  const hasSelectionContext = Boolean(
    options.targetCandidate
      || normalizeVisualSnapshotCompactMatchText(options.targetHint),
  );
  if (
    singleHighConfidenceCandidate
    && (
      options.candidates.length === 1
      || (
        !hasSelectionContext
        && (
          options.kind === 'target'
          || isVisualSnapshotActionCandidateText(getVisualSnapshotCandidateSearchText(singleHighConfidenceCandidate))
        )
      )
    )
  ) {
    return singleHighConfidenceCandidate;
  }

  const rankedCandidates = options.candidates
    .map((candidate, index) => scoreVisualSnapshotCandidateChoice({
      candidate,
      index,
      kind: options.kind,
      targetCandidate: options.targetCandidate,
      targetCandidates: options.targetCandidates,
      targetHint: options.targetHint,
    }))
    .sort((first, second) => second.score - first.score);
  const bestCandidate = rankedCandidates[0] ?? null;
  const secondCandidate = rankedCandidates[1] ?? null;
  if (!bestCandidate) {
    return null;
  }

  const decisiveMargin = options.kind === 'action' ? 14 : 10;
  if (!secondCandidate || bestCandidate.score - secondCandidate.score >= decisiveMargin) {
    return bestCandidate.candidate;
  }

  return null;
}

function getVisualSnapshotCandidateLabel(candidate: AgentStructuredToolCandidateEvidence | null | undefined) {
  return candidate?.label?.trim() || candidate?.description?.trim() || '';
}

function createVisualSnapshotCandidatePointFromBounds(
  bounds: AgentStructuredToolRectEvidence | null | undefined,
) {
  const ratioPoint = createVisualSnapshotRatioPointFromBounds(bounds);
  if (ratioPoint) {
    return ratioPoint;
  }

  if (
    !bounds
    || !Number.isFinite(Number(bounds.x))
    || !Number.isFinite(Number(bounds.y))
    || !Number.isFinite(Number(bounds.width))
    || !Number.isFinite(Number(bounds.height))
  ) {
    return null;
  }

  return {
    coordinateSpace: bounds.coordinateSpace ?? 'native-screen',
    source: bounds.source ?? 'candidateBounds',
    x: Math.round(Number(bounds.x) + Number(bounds.width) / 2),
    y: Math.round(Number(bounds.y) + Number(bounds.height) / 2),
  } satisfies AgentStructuredToolPointEvidence;
}

function getVisualSnapshotCoordinateSpace(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function isVisualSnapshotRatioPointEvidence(point: AgentStructuredToolPointEvidence | null | undefined) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
    return false;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(point.coordinateSpace);
  return coordinateSpace.includes('ratio')
    || (
      !coordinateSpace
      && Number(point.x) >= 0
      && Number(point.x) <= 1
      && Number(point.y) >= 0
      && Number(point.y) <= 1
    );
}

function normalizeVisualSnapshotScreenPointEvidence(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  if (
    !point
    || !Number.isFinite(Number(point.x))
    || !Number.isFinite(Number(point.y))
    || isVisualSnapshotRatioPointEvidence(point)
  ) {
    return null;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(point.coordinateSpace);
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    ...point,
    coordinateSpace: 'native-screen',
    x: Math.round(Number(point.x)),
    y: Math.round(Number(point.y)),
  } satisfies AgentStructuredToolPointEvidence;
}

function normalizeVisualSnapshotRatioPointEvidence(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  if (!isVisualSnapshotRatioPointEvidence(point)) {
    return null;
  }

  const x = normalizeVisualSnapshotRatioValue(Number(point?.x));
  const y = normalizeVisualSnapshotRatioValue(Number(point?.y));
  if (x === null || y === null) {
    return null;
  }

  return {
    ...point,
    coordinateSpace: 'source-ratio',
    x: roundVisualSnapshotRatioValue(x),
    y: roundVisualSnapshotRatioValue(y),
  } satisfies AgentStructuredToolPointEvidence;
}

function isVisualSnapshotRatioRectEvidence(rect: AgentStructuredToolRectEvidence | null | undefined) {
  if (
    !rect
    || !Number.isFinite(Number(rect.x))
    || !Number.isFinite(Number(rect.y))
    || !Number.isFinite(Number(rect.width))
    || !Number.isFinite(Number(rect.height))
    || Number(rect.width) <= 0
    || Number(rect.height) <= 0
  ) {
    return false;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(rect.coordinateSpace);
  return coordinateSpace.includes('ratio')
    || (
      !coordinateSpace
      && Number(rect.x) >= 0
      && Number(rect.x) <= 1
      && Number(rect.y) >= 0
      && Number(rect.y) <= 1
      && Number(rect.width) > 0
      && Number(rect.width) <= 1
      && Number(rect.height) > 0
      && Number(rect.height) <= 1
    );
}

function normalizeVisualSnapshotScreenRectEvidence(
  rect: AgentStructuredToolRectEvidence | null | undefined,
) {
  if (
    !rect
    || !Number.isFinite(Number(rect.x))
    || !Number.isFinite(Number(rect.y))
    || !Number.isFinite(Number(rect.width))
    || !Number.isFinite(Number(rect.height))
    || Number(rect.width) <= 0
    || Number(rect.height) <= 0
    || isVisualSnapshotRatioRectEvidence(rect)
  ) {
    return null;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(rect.coordinateSpace);
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    ...rect,
    coordinateSpace: 'native-screen',
    height: Math.round(Number(rect.height)),
    width: Math.round(Number(rect.width)),
    x: Math.round(Number(rect.x)),
    y: Math.round(Number(rect.y)),
  } satisfies AgentStructuredToolRectEvidence;
}

function createVisualSnapshotRatioPointFromBounds(
  bounds: AgentStructuredToolRectEvidence | null | undefined,
) {
  if (!isVisualSnapshotRatioRectEvidence(bounds)) {
    return null;
  }

  const x = normalizeVisualSnapshotRatioValue(Number(bounds?.x) + Number(bounds?.width) / 2);
  const y = normalizeVisualSnapshotRatioValue(Number(bounds?.y) + Number(bounds?.height) / 2);
  if (x === null || y === null) {
    return null;
  }

  return {
    coordinateSpace: 'source-ratio',
    source: bounds?.source ?? 'ratioBounds',
    x: roundVisualSnapshotRatioValue(x),
    y: roundVisualSnapshotRatioValue(y),
  } satisfies AgentStructuredToolPointEvidence;
}

function resolveVisualSnapshotAbsoluteRectFromRatio(options: {
  ratioBounds?: AgentStructuredToolRectEvidence | null;
  source: DesktopPetCaptureSourceLike;
}) {
  const ratioBounds = options.ratioBounds;
  if (!isVisualSnapshotRatioRectEvidence(ratioBounds)) {
    return null;
  }

  const sourceBounds = resolveVisualSnapshotSourceBounds(options.source);
  if (!sourceBounds) {
    return null;
  }

  const xRatio = Math.max(0, Math.min(1, Number(ratioBounds?.x)));
  const yRatio = Math.max(0, Math.min(1, Number(ratioBounds?.y)));
  const widthRatio = Math.max(0, Math.min(1, Number(ratioBounds?.width)));
  const heightRatio = Math.max(0, Math.min(1, Number(ratioBounds?.height)));

  return {
    coordinateSpace: 'native-screen',
    height: Math.max(1, Math.round(sourceBounds.height * heightRatio)),
    source: ratioBounds?.source ?? 'ratioBounds',
    width: Math.max(1, Math.round(sourceBounds.width * widthRatio)),
    x: Math.round(sourceBounds.x + sourceBounds.width * xRatio),
    y: Math.round(sourceBounds.y + sourceBounds.height * yRatio),
  } satisfies AgentStructuredToolRectEvidence;
}

function formatVisualSnapshotCandidateLine(
  kind: 'target' | 'action',
  candidate: AgentStructuredToolCandidateEvidence,
  index: number,
) {
  const center = candidate.center
    && Number.isFinite(Number(candidate.center.x))
    && Number.isFinite(Number(candidate.center.y))
    ? ` center=${Math.round(Number(candidate.center.x))},${Math.round(Number(candidate.center.y))}`
    : '';
  const centerRatio = candidate.centerRatio
    && Number.isFinite(Number(candidate.centerRatio.x))
    && Number.isFinite(Number(candidate.centerRatio.y))
    ? ` centerRatio=${Number(candidate.centerRatio.x).toFixed(3)},${Number(candidate.centerRatio.y).toFixed(3)}`
    : '';
  const bounds = candidate.bounds
    && Number.isFinite(Number(candidate.bounds.x))
    && Number.isFinite(Number(candidate.bounds.y))
    && Number.isFinite(Number(candidate.bounds.width))
    && Number.isFinite(Number(candidate.bounds.height))
    ? ` bounds=${Math.round(Number(candidate.bounds.x))},${Math.round(Number(candidate.bounds.y))},${Math.round(Number(candidate.bounds.width))}x${Math.round(Number(candidate.bounds.height))}`
    : '';
  const label = getVisualSnapshotCandidateLabel(candidate) || '(unlabeled)';
  return [
    `Visual ${kind} candidate ${index + 1}: ${label}`,
    candidate.confidence ? `confidence=${candidate.confidence}` : '',
    candidate.region ? `region=${candidate.region}` : '',
    candidate.relation ? `relation=${candidate.relation}` : '',
    candidate.selected === true ? 'selected=true' : candidate.selected === false ? 'selected=false' : '',
    center.trim(),
    centerRatio.trim(),
    bounds.trim(),
  ].filter(Boolean).join(' | ');
}

function parseVisualSnapshotPointFromText(value: string) {
  const match = value.match(/\b(?:x|cx|centerX|center x)\s*[=:：]\s*(-?\d+(?:\.\d+)?).{0,24}\b(?:y|cy|centerY|center y)\s*[=:：]\s*(-?\d+(?:\.\d+)?)/iu)
    ?? value.match(/\((\s*-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)\s*\)/u);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    coordinateSpace: 'native-screen',
    source: 'elementRegion-text',
    x: Math.round(x),
    y: Math.round(y),
  } satisfies AgentStructuredToolPointEvidence;
}

function resolveVisualSnapshotPointEvidence(parsed: Record<string, unknown>, elementRegion: string) {
  const explicitCenter = normalizeVisualSnapshotPointObject(
    getVisualSnapshotObjectField(parsed, ['elementCenter', 'center', 'point', 'coordinates']),
  );
  const ratioCenter = normalizeVisualSnapshotRatioPointObject(
    getVisualSnapshotObjectField(parsed, ['elementCenterRatio', 'centerRatio', 'normalizedCenter', 'relativeCenter']),
  );
  const bounds = normalizeVisualSnapshotRectObject(
    getVisualSnapshotObjectField(parsed, ['elementBounds', 'bounds', 'rect', 'regionBox']),
  );
  const regionTextPoint = parseVisualSnapshotPointFromText(elementRegion);
  const elementCenter = explicitCenter
    ?? regionTextPoint
    ?? createVisualSnapshotCandidatePointFromBounds(bounds);

  return {
    bounds,
    center: elementCenter,
    ratioCenter,
  };
}

function formatVisualSnapshotConfidence(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.max(0, Math.min(1, value)));
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return '';
}

function getVisualSnapshotConfidenceValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) ? Math.max(0, Math.min(1, parsedValue)) : null;
  }

  return null;
}

function isVisualSnapshotPrimaryActionMissingText(value: string) {
  return /(?:未找到|没有|未识别|看不到|不明确|无法确认).{0,24}(?:启动|打开|开始|运行|进入|播放|按钮|主操作|primary|launch|start|play|open)|(?:did not find|not found|no clear|no visible|cannot identify).{0,32}(?:button|primary action|launch|start|play|open)/iu
    .test(value);
}

function isVisualSnapshotPrimaryActionUseful(value: string | null | undefined) {
  return Boolean(value?.trim()) && !isVisualSnapshotPrimaryActionMissingText(value ?? '');
}

function normalizeVisualSnapshotRelationText(value: string | null | undefined) {
  return (value ?? '').normalize('NFKC').replace(/\s+/gu, '').trim().toLowerCase();
}

function isVisualSnapshotTextUseful(value: string | null | undefined) {
  const text = (value ?? '').normalize('NFKC').trim().toLowerCase();
  return Boolean(text)
    && !/(?:unknown|unclear|not\s+(?:found|visible|clear)|none|null|n\/a|不确定|不清楚|未知|未找到|没有|无)/iu.test(text);
}

function isVisualSnapshotTargetActionRelationNeeded(
  targetMatched: string,
  primaryAction: string,
) {
  const targetText = normalizeVisualSnapshotRelationText(targetMatched);
  const actionText = normalizeVisualSnapshotRelationText(primaryAction);
  if (!targetText || !actionText) {
    return false;
  }

  return targetText !== actionText
    && !targetText.includes(actionText)
    && !actionText.includes(targetText);
}

export function isVisualSnapshotAuthenticatedState(value: unknown) {
  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return false;
  }

  const authenticatedCue = /(?:logged\s+in|already\s+(?:logged|signed)\s+in|sign[-\s]?in\s+(?:successful|succeeded|complete)|login\s+(?:successful|succeeded|complete)|main\s+(?:interface|window|page)|home\s+page|friends?\s+list|已登录|已经登录|登录成功|登陆成功|登录完成|主界面|主页|好友列表|无需登录|非登录界面|logged[-\s]?in\s+state)/iu.test(text);
  const negatedLoginGateCue = /(?:does\s+not\s+show|not\s+(?:shown|visible|present)|no\s+(?:login|sign[-\s]?in)\s+(?:page|button)|无需|不需要|无须|未(?:显示|出现)|没有|无|不再|不是|非).{0,24}(?:login\s+page|sign[-\s]?in\s+page|login\s+button|sign[-\s]?in\s+button|登录界面|登录按钮|账号密码|验证码|二维码|captcha|two[-\s]?factor|2fa)|(?:login\s+page|sign[-\s]?in\s+page|login\s+button|sign[-\s]?in\s+button|登录界面|登录按钮|账号密码|验证码|二维码|captcha|two[-\s]?factor|2fa).{0,24}(?:does\s+not\s+show|not\s+(?:shown|visible|present)|not\s+needed|无需|不需要|无须|未(?:显示|出现)|没有|无|不再|不是|非)/iu.test(text);
  const loginGateCue = /(?:login\s+page|sign[-\s]?in\s+page|login\s+button|sign[-\s]?in\s+button|please\s+(?:log|sign)\s+in|needs?\s+login|登录界面|登录按钮|需要登录|未登录|账号密码|验证码|二维码|two[-\s]?factor|2fa|captcha)/iu.test(text)
    && !negatedLoginGateCue;
  return authenticatedCue && !loginGateCue;
}

function normalizeVisualSnapshotPostActionState(value: unknown) {
  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return '';
  }

  if (/(?:selection_mismatch|selected\s+(?:item|target)\s+(?:is|remains|still)\s+(?:not|different|wrong)|current\s+(?:selection|detail|page|title)\s+(?:is|remains|still)\s+(?:not|different|wrong)|target\s+(?:is\s+)?(?:visible|shown)\s+but\s+not\s+(?:selected|current)|not\s+selected|visible_only|visible\s+only|选中不匹配|当前选中不是|详情页不是|只是可见|仅可见|未选中)/iu.test(text)) {
    return /(?:selection_mismatch|mismatch|different|wrong|不匹配|不是)/iu.test(text)
      ? 'selection_mismatch'
      : 'visible_only';
  }

  if (/^(?:open|opened|launched|running|started|complete|completed)$/iu.test(text)) {
    return 'launched';
  }

  const hasNegatedError = /(?:no|without|not\s+(?:visible|shown|present)|absent|missing|cannot\s+see|can't\s+see|没有|无|未见|看不到)[^\n.]{0,36}(?:error|error_dialog|failed|failure|crash|exception|报错|错误|失败|异常|崩溃|无法)/iu.test(text);
  if (
    !hasNegatedError
    && /(?:error|error_dialog|failed|failure|crash|exception|报错|错误|失败|异常|崩溃|无法)/iu.test(text)
  ) {
    return 'error';
  }

  if (/(?:login_required|login|sign\s*in|password|account|qr\s*code|登录|登陆|账号|账户|密码|扫码|验证码|验证)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:updating|update|download|install|patch|verifying|extracting|preparing|queued|queue|waiting\s+in\s+queue|更新|下载|安装|修补|补丁|校验|验证中|解压|准备|排队)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|opening|initializing|connecting|please\s*wait|progress|spinner|waiting\s+for\s+(?:the\s+)?(?:game|app|application|window|client|server|target)|加载|启动中|正在启动|正在打开|初始化|连接中|正在连接|等待|进度)/iu.test(text)) {
    return 'loading';
  }

  if (/(?:unchanged|no\s+visible\s+change|same\s+screen|未变化|没有变化|仍然|还是原来|原页面)/iu.test(text)) {
    return 'unchanged';
  }

  if (/(?:blocked|permission|denied|blocked_by|被阻止|被拦截|权限|拒绝)/iu.test(text)) {
    return 'blocked';
  }

  if (/(?:launched|opened|running|started|已打开|已启动|进入|主界面|主页|运行中|完成)/iu.test(text)) {
    return 'launched';
  }

  if (/(?:unknown|unclear|不确定|不清楚|未知)/iu.test(text)) {
    return 'unknown';
  }

  return '';
}

function normalizeVisualSnapshotSelectionVerificationStatus(value: unknown): AgentStructuredToolEvidence['selectionVerificationStatus'] {
  if (typeof value === 'boolean') {
    return value ? 'selected' : 'visible-only';
  }

  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return null;
  }

  if (/^(?:selected|current|active|verified|confirmed|yes|true|已选中|选中|当前|已确认)$/iu.test(text)) {
    return 'selected';
  }
  if (/(?:mismatch|wrong|different|not\s+(?:target|selected|current)|selection_mismatch|不匹配|错误|不是目标|当前不是)/iu.test(text)) {
    return 'mismatch';
  }
  if (/(?:visible[_ -]?only|visible|shown|found|not\s+confirmed|unconfirmed|未确认|只是可见|仅可见|可见但未选中)/iu.test(text)) {
    return 'visible-only';
  }
  if (/(?:unknown|unclear|unsure|不确定|不清楚|未知)/iu.test(text)) {
    return 'unknown';
  }

  return null;
}

function deriveVisualSnapshotSelectionVerificationStatus(options: {
  currentSelection: string;
  parsed: Record<string, unknown>;
  summaryText: string;
  targetMatched: string;
}): AgentStructuredToolEvidence['selectionVerificationStatus'] {
  const text = [
    options.summaryText,
    getVisualSnapshotStringField(options.parsed, ['selectionEvidence', 'selectionReason', 'currentPage', 'detailPage', 'mainContent']),
  ].filter(Boolean).join('\n').normalize('NFKC').toLowerCase();
  const current = normalizeVisualSnapshotCompactMatchText(options.currentSelection);
  const target = normalizeVisualSnapshotCompactMatchText(options.targetMatched);

  if (current && target) {
    return current.includes(target) || target.includes(current) ? 'selected' : 'mismatch';
  }

  if (/(?:current\s+(?:selection|detail|page|title).{0,32}(?:not|different|wrong)|selected\s+(?:item|target).{0,32}(?:not|different|wrong)|当前选中不是|详情页不是|选中不匹配)/iu.test(text)) {
    return 'mismatch';
  }
  if (/(?:visible\s+but\s+not\s+(?:selected|current)|visible[_ -]?only|only\s+visible|只是可见|仅可见|可见但未选中|未确认选中)/iu.test(text)) {
    return 'visible-only';
  }
  if (/(?:currently\s+selected|current\s+(?:selection|detail|page|title).{0,32}(?:is|matches)|已选中|当前选中|详情页显示)/iu.test(text)) {
    return 'selected';
  }

  return null;
}

function createVisualSnapshotActionEvidenceAssessment(options: {
  actionCandidates?: AgentStructuredToolCandidateEvidence[];
  confidenceValue: number | null;
  coordinateAudit?: ReturnType<typeof createAgentCoordinateAuditEvidence> | null;
  elementBounds: AgentStructuredToolRectEvidence | null;
  elementCenter: AgentStructuredToolPointEvidence | null;
  elementCenterRatio: AgentStructuredToolPointEvidence | null;
  elementRegion: string;
  mode: 'desktop' | 'game';
  primaryAction: string;
  relation: string;
  selectionVerificationStatus?: AgentStructuredToolEvidence['selectionVerificationStatus'];
  targetCandidates?: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}) {
  if (options.mode === 'game') {
    return {
      missingEvidence: [] as string[],
      readiness: null as AgentStructuredToolEvidence['visualActionReadiness'],
      recommendedRecovery: [] as string[],
      relationRequired: false,
      verificationEvidence: [] as string[],
    };
  }

  const targetUseful = isVisualSnapshotTextUseful(options.targetMatched);
  const primaryActionUseful = isVisualSnapshotPrimaryActionUseful(options.primaryAction);
  const hasScreenCoordinate = Boolean(
    normalizeVisualSnapshotScreenPointEvidence(options.elementCenter)
      || normalizeVisualSnapshotScreenRectEvidence(options.elementBounds),
  );
  const coordinateAuditFailed = Boolean(
    hasScreenCoordinate
      && options.coordinateAudit
      && options.coordinateAudit.status !== 'coordinate_ok',
  );
  const hasLocationHint = Boolean(
    options.elementRegion
      || options.elementCenterRatio
      || options.elementCenter
      || options.elementBounds,
  );
  const relationRequired = isVisualSnapshotTargetActionRelationNeeded(
    options.targetMatched,
    options.primaryAction,
  );
  const relationUseful = isVisualSnapshotTextUseful(options.relation);
  const hasActionSignal = Boolean(
    targetUseful
      || primaryActionUseful
      || hasLocationHint
      || relationUseful,
  );

  if (!hasActionSignal) {
    return {
      missingEvidence: [] as string[],
      readiness: null as AgentStructuredToolEvidence['visualActionReadiness'],
      recommendedRecovery: [] as string[],
      relationRequired,
      verificationEvidence: [] as string[],
    };
  }

  const missingEvidence: string[] = [];
  const recommendedRecovery: string[] = [];
  let readiness: AgentStructuredToolEvidence['visualActionReadiness'] = 'ready';

  if (options.selectionVerificationStatus === 'mismatch' || options.selectionVerificationStatus === 'visible-only') {
    readiness = 'needs-target-selection';
    missingEvidence.push(options.selectionVerificationStatus === 'mismatch'
      ? 'Visual selection verification says the current selected/detail item does not match the requested target.'
      : 'Visual target appears visible, but the current selected/detail item is not confirmed.');
    recommendedRecovery.push('Select the target item first, then rerun locate_screen_elements or post-action visual verification before looking for the primary action.');
  } else if (options.confidenceValue !== null && options.confidenceValue < 0.6) {
    readiness = 'low-confidence';
    missingEvidence.push('Visual confidence is below the action threshold, so the UI action is not safe to execute yet.');
    recommendedRecovery.push('Refresh visual evidence or ask one short confirmation question before taking desktop input.');
  } else if (!targetUseful) {
    readiness = 'needs-target-selection';
    missingEvidence.push(options.targetCandidates?.length
      ? 'Visual returned target candidates, but no single target item was matched clearly for the requested action.'
      : 'Visual target item was not matched clearly for the requested action.');
    recommendedRecovery.push(options.targetCandidates?.length
      ? 'Use the targetCandidates centerRatio/bounds/region evidence to rerun locate_screen_elements with focus crop params around the most relevant candidate, or ask one short selection question if candidates remain equally plausible.'
      : 'Retry locate_screen_elements with a narrower sourceQuery/sourceId and a concrete targetText or targetDescription.');
  } else if (!primaryActionUseful) {
    readiness = 'needs-primary-action';
    missingEvidence.push(options.actionCandidates?.length
      ? 'Visual returned action candidates, but no single primary open/start/play/launch action was identified.'
      : 'Visual target was matched, but no clear primary open/start/play/launch action was identified.');
    recommendedRecovery.push(options.actionCandidates?.length
      ? 'Use the actionCandidates centerRatio/bounds/region evidence to rerun locate_screen_elements with focus crop params around the likely primary action, rerun for the target detail area, or ask one short confirmation question.'
      : 'If the target item has an approximate region, select that item first, then rerun locate_screen_elements with forceRefresh: true.');
    recommendedRecovery.push('If the visible page is a list/store/recommendation page, navigate to the target detail/library page before looking for the primary action.');
  } else if (!hasScreenCoordinate || coordinateAuditFailed) {
    readiness = 'needs-coordinate';
    missingEvidence.push(coordinateAuditFailed && options.coordinateAudit
      ? `Visual coordinate audit failed: ${options.coordinateAudit.status} (${options.coordinateAudit.reason})`
      : hasLocationHint
        ? 'Visual primary action was identified, but only relative/approximate location evidence was available; no safe native-screen coordinate was resolved for desktop input.'
        : 'Visual primary action was identified, but no native-screen coordinate or elementBounds could be resolved for safe desktop input.');
    recommendedRecovery.push('Rerun locate_screen_elements with forceRefresh: true and request elementCenterRatio or elementCenter for the primary action.');
    recommendedRecovery.push('If the capture source has no bounds, call list_capture_sources or inspect the active window before converting visual location to input coordinates.');
  } else if (relationRequired && !relationUseful) {
    readiness = 'needs-relation';
    missingEvidence.push('Visual target/action relation was not stated clearly, so the primary action may not belong to the matched target.');
    recommendedRecovery.push('Rerun locate_screen_elements and ask it to state whether the primary action is visually associated with the matched target.');
  }

  return {
    missingEvidence,
    readiness,
    recommendedRecovery,
    relationRequired,
    verificationEvidence: readiness === 'ready'
      ? [
          relationRequired
            ? 'Visual action readiness is ready: target, primary action, relation, and native-screen coordinate evidence are present.'
            : 'Visual action readiness is ready: target, primary action, and native-screen coordinate evidence are present.',
        ]
      : [],
  };
}

function isVisualSnapshotLauncherTextMatch(first: string | null | undefined, second: string | null | undefined) {
  const firstCompact = normalizeVisualSnapshotCompactMatchText(first);
  const secondCompact = normalizeVisualSnapshotCompactMatchText(second);
  if (!firstCompact || !secondCompact) {
    return false;
  }

  if (firstCompact === secondCompact) {
    return true;
  }

  const shorterLength = Math.min(firstCompact.length, secondCompact.length);
  if (
    shorterLength >= 5
    && (firstCompact.includes(secondCompact) || secondCompact.includes(firstCompact))
  ) {
    return true;
  }

  const genericTokens = new Set([
    'app',
    'button',
    'client',
    'current',
    'detail',
    'game',
    'launch',
    'launcher',
    'open',
    'page',
    'panel',
    'play',
    'selected',
    'start',
    'target',
    'the',
    '启动',
    '开始',
    '打开',
    '游戏',
    '按钮',
    '详情',
    '当前',
  ]);
  const firstTokens = new Set(createVisualSnapshotQueryTokens(first ?? '').filter((token) => !genericTokens.has(token)));
  const secondTokens = createVisualSnapshotQueryTokens(second ?? '').filter((token) => !genericTokens.has(token));
  if (!firstTokens.size || !secondTokens.length) {
    return false;
  }

  const overlapCount = secondTokens.filter((token) => firstTokens.has(token)).length;
  return overlapCount > 0 && overlapCount === Math.min(firstTokens.size, secondTokens.length);
}

function createVisualSnapshotLauncherVerificationLine(
  verification: AgentStructuredToolEvidence['launcherVerification'],
) {
  if (!verification?.status) {
    return '';
  }

  const formatBoolean = (value: boolean | null | undefined) => (
    typeof value === 'boolean' ? String(value) : 'unknown'
  );
  return [
    `Launcher verification: status=${verification.status}`,
    `targetVisible=${formatBoolean(verification.targetVisible)}`,
    `selected=${formatBoolean(verification.targetSelected)}`,
    `detailMatches=${formatBoolean(verification.detailMatchesTarget)}`,
    `actionMatches=${formatBoolean(verification.primaryActionMatchesTarget)}`,
  ].join(' ');
}

function relationMentionsAnotherKnownLauncherTarget(options: {
  relation: string;
  targetCandidates?: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}) {
  const targetCandidates = options.targetCandidates ?? [];
  return targetCandidates.some((candidate) => {
    const label = getVisualSnapshotCandidateLabel(candidate);
    return label
      && !isVisualSnapshotLauncherTextMatch(label, options.targetMatched)
      && isVisualSnapshotLauncherTextMatch(options.relation, label)
      && !isVisualSnapshotLauncherTextMatch(options.relation, options.targetMatched);
  });
}

type VisualSnapshotLauncherVerification = NonNullable<AgentStructuredToolEvidence['launcherVerification']>;
type VisualSnapshotLauncherVerificationStatus = NonNullable<VisualSnapshotLauncherVerification['status']>;

function createVisualSnapshotLauncherVerification(options: {
  actionCandidates?: AgentStructuredToolCandidateEvidence[];
  currentSelection: string;
  primaryAction: string;
  readiness: VisualSnapshotLauncherVerificationStatus;
  relation: string;
  relationRequired: boolean;
  selectionVerificationStatus?: AgentStructuredToolEvidence['selectionVerificationStatus'];
  targetCandidates?: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}): VisualSnapshotLauncherVerification | null {
  const targetUseful = isVisualSnapshotTextUseful(options.targetMatched);
  const primaryActionUseful = isVisualSnapshotPrimaryActionUseful(options.primaryAction);
  const hasLauncherSignal = Boolean(
    targetUseful
      || primaryActionUseful
      || options.currentSelection
      || options.relation
      || options.selectionVerificationStatus
      || options.targetCandidates?.length
      || options.actionCandidates?.length,
  );
  if (!hasLauncherSignal) {
    return null;
  }

  const currentSelectionMatchesTarget = isVisualSnapshotLauncherTextMatch(
    options.currentSelection,
    options.targetMatched,
  );
  const currentSelectionMismatchesTarget = Boolean(
    options.currentSelection
      && options.targetMatched
      && !currentSelectionMatchesTarget,
  );
  const targetVisible = targetUseful || Boolean(options.targetCandidates?.length);
  let targetSelected = options.selectionVerificationStatus === 'selected'
    ? true
    : options.selectionVerificationStatus === 'mismatch' || options.selectionVerificationStatus === 'visible-only'
      ? false
      : currentSelectionMatchesTarget
        ? true
        : currentSelectionMismatchesTarget
          ? false
          : targetVisible
            ? null
            : false;
  let detailMatchesTarget = currentSelectionMatchesTarget || options.selectionVerificationStatus === 'selected'
    ? true
    : options.selectionVerificationStatus === 'mismatch' || currentSelectionMismatchesTarget
      ? false
      : null;

  const relationText = options.relation.normalize('NFKC').trim().toLowerCase();
  const relationUseful = isVisualSnapshotTextUseful(options.relation);
  const relationNegative = /(?:does\s+not\s+belong|not\s+(?:associated|related|for|target|current)|unrelated|wrong|different|mismatch|another\s+game|other\s+game|\u4e0d\u5c5e\u4e8e|\u65e0\u5173|\u4e0d\u662f|\u4e0d\u5339\u914d|\u5176\u4ed6\u6e38\u620f|\u53e6\u4e00\u4e2a\u6e38\u620f)/iu
    .test(relationText);
  const relationMentionsCurrentMismatch = Boolean(
    options.currentSelection
      && currentSelectionMismatchesTarget
      && isVisualSnapshotLauncherTextMatch(options.relation, options.currentSelection)
      && !isVisualSnapshotLauncherTextMatch(options.relation, options.targetMatched),
  );
  const relationMentionsOtherTarget = relationMentionsAnotherKnownLauncherTarget({
    relation: options.relation,
    targetCandidates: options.targetCandidates,
    targetMatched: options.targetMatched,
  });
  const relationConflict = Boolean(
    primaryActionUseful
      && (
        detailMatchesTarget === false
        || relationMentionsCurrentMismatch
        || relationMentionsOtherTarget
        || relationNegative
      ),
  );
  const relationPositive = Boolean(
    relationUseful
      && !relationConflict
      && (
        isVisualSnapshotLauncherTextMatch(options.relation, options.targetMatched)
        || (
          currentSelectionMatchesTarget
          && /(?:belongs\s+to|associated\s+with|for\s+(?:the\s+)?(?:selected|current)|current\s+detail|detail\s+panel|detail\s+page|owned\s+by|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94|\u5f53\u524d\u8be6\u60c5|\u8be6\u60c5\u9875|\u5df2\u9009\u4e2d)/iu.test(relationText)
        )
      ),
  );
  const relationConfirmsTargetDetail = Boolean(
    relationPositive
      && /(?:selected|current|detail\s+(?:panel|page|title)|current\s+detail|belongs\s+to|associated\s+with|\u5df2\u9009\u4e2d|\u5f53\u524d|\u8be6\u60c5|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94)/iu.test(relationText),
  );
  if (detailMatchesTarget === null && relationConfirmsTargetDetail) {
    detailMatchesTarget = true;
  }
  if (targetSelected === null && relationConfirmsTargetDetail) {
    targetSelected = true;
  }

  const primaryActionMatchesTarget = !primaryActionUseful
    ? null
    : relationConflict
      ? false
      : !options.relationRequired
        ? targetVisible
        : relationPositive
          ? true
          : options.readiness === 'ready' && (targetSelected === true || detailMatchesTarget === true)
            ? true
            : null;

  let status: VisualSnapshotLauncherVerificationStatus = options.readiness;
  if (!targetVisible) {
    status = 'needs-target-selection';
  } else if (targetSelected === false || detailMatchesTarget === false) {
    status = 'needs-target-selection';
  } else if (primaryActionUseful && primaryActionMatchesTarget === false) {
    status = 'needs-relation';
  } else if (primaryActionUseful && options.relationRequired && primaryActionMatchesTarget !== true && status === 'ready') {
    status = 'needs-relation';
  }

  const reason = status === 'ready'
    ? 'Launcher verification has target, selected/detail ownership, primary action ownership, and coordinate readiness.'
    : status === 'needs-target-selection'
      ? targetVisible
        ? 'Launcher target is visible, but selected/detail ownership is not confirmed for the requested target.'
        : 'Launcher target is not clearly visible or matched yet.'
      : status === 'needs-primary-action'
        ? 'Launcher target evidence exists, but no single primary open/start/play action is confirmed.'
        : status === 'needs-relation'
          ? 'Launcher primary action ownership is not confirmed for the requested target.'
          : status === 'needs-coordinate'
            ? 'Launcher primary action is identified, but no safe native-screen coordinate is resolved.'
            : status === 'low-confidence'
              ? 'Launcher visual evidence confidence is too low for input.'
              : status === 'not-actionable'
                ? 'Launcher visual evidence is not actionable.'
                : 'Launcher target/action state is still unknown.';

  return {
    currentSelection: options.currentSelection || null,
    detailMatchesTarget,
    evidence: [
      options.targetMatched ? `targetMatched=${options.targetMatched}` : '',
      options.currentSelection ? `currentSelection=${options.currentSelection}` : '',
      options.selectionVerificationStatus ? `selectionVerificationStatus=${options.selectionVerificationStatus}` : '',
      options.primaryAction ? `primaryAction=${options.primaryAction}` : '',
      options.relation ? `relation=${options.relation}` : '',
    ].filter(Boolean),
    primaryAction: options.primaryAction || null,
    primaryActionMatchesTarget,
    reason,
    status,
    targetMatched: options.targetMatched || null,
    targetSelected,
    targetVisible,
  } satisfies NonNullable<AgentStructuredToolEvidence['launcherVerification']>;
}

function createVisualSnapshotStructuredEvidence(
  rawSummary: string,
  mode: 'desktop' | 'game',
  source?: DesktopPetCaptureSourceLike | null,
  availableSources: DesktopPetCaptureSourceLike[] = [],
  targetHint = '',
  captureContext?: {
    fallbackLine?: string | null;
    quality?: AgentCaptureQualityAnalysis | null;
    selectedSource?: DesktopPetCaptureSourceLike | null;
  },
) {
  const parsed = tryParseVisualSnapshotJson(rawSummary);
  const fallbackSummary = compactVisualSnapshotSummary(rawSummary, mode === 'game' ? 1200 : 900);
  if (!parsed) {
    const summaryLine = mode === 'game'
      ? `Game content analysis: ${fallbackSummary}`
      : `Visual summary: ${fallbackSummary}`;
    return {
      companionCue: '',
      confidenceLine: '',
      evidenceLines: [summaryLine],
      missingEvidence: [],
      observedState: [summaryLine],
      recommendedRecovery: [],
      responseText: fallbackSummary,
      structuredEvidence: null,
      summaryText: fallbackSummary,
      verificationEvidence: [],
    };
  }

  const summaryText = getVisualSnapshotStringField(parsed, ['summary', 'description', 'mainContent'])
    || fallbackSummary;
  const confidenceText = formatVisualSnapshotConfidence(parsed.confidence);
  const confidenceValue = getVisualSnapshotConfidenceValue(parsed.confidence);
  const companionCue = getVisualSnapshotStringField(parsed, ['companionCue', 'companionObservation']);
  const uncertainty = getVisualSnapshotStringListField(parsed, ['uncertainty', 'uncertainties', 'unknowns']);
  const readableText = getVisualSnapshotStringListField(parsed, ['readableText', 'visibleText', 'text', 'ocrText', 'ocr']);
  const visibleTextCandidates = getVisualSnapshotStringListField(parsed, [
    'visibleTextCandidates',
    'textCandidates',
    'readableTextCandidates',
    'ocrTextCandidates',
    'ocrCandidates',
    'visibleTexts',
  ]);
  const ocrCandidates = getVisualSnapshotOcrTextCandidates(parsed);
  const explicitTargetMatched = getVisualSnapshotStringField(parsed, ['targetMatched', 'matchedTarget', 'targetItem', 'target']);
  const explicitPrimaryAction = getVisualSnapshotStringField(parsed, ['primaryAction', 'actionButton', 'primaryButton', 'button']);
  const currentSelection = getVisualSnapshotStringField(parsed, [
    'currentSelection',
    'selectedTarget',
    'selectedItem',
    'currentTarget',
    'currentDetailTitle',
    'detailTitle',
    'activeTarget',
  ]);
  const ocrDerivedCandidates = deriveVisualSnapshotCandidatesFromOcr({
    explicitPrimaryAction,
    explicitTargetMatched,
    ocrCandidates,
    summaryText,
  });
  const targetCandidates = mergeVisualSnapshotCandidates(
    getVisualSnapshotCandidateListField(parsed, ['targetCandidates', 'matchedTargetCandidates', 'targetOptions', 'candidateTargets']),
    ocrDerivedCandidates.targetCandidates,
  );
  const actionCandidates = mergeVisualSnapshotCandidates(
    getVisualSnapshotCandidateListField(parsed, ['actionCandidates', 'primaryActionCandidates', 'buttonCandidates', 'candidateActions']),
    ocrDerivedCandidates.actionCandidates,
  );
  const selectedTargetCandidate = resolveBestVisualSnapshotCandidate({
    candidates: targetCandidates,
    kind: 'target',
    targetHint: explicitTargetMatched || targetHint || summaryText,
  });
  const targetMatched = explicitTargetMatched
    || getVisualSnapshotCandidateLabel(selectedTargetCandidate);
  const candidateSelectionStatus: AgentStructuredToolEvidence['selectionVerificationStatus'] = selectedTargetCandidate?.selected === true
    ? 'selected'
    : selectedTargetCandidate?.selected === false
      ? 'visible-only'
      : null;
  const explicitSelectionStatus = normalizeVisualSnapshotSelectionVerificationStatus(
    parsed.selectionVerificationStatus
      ?? parsed.selectionStatus
      ?? parsed.selectedState
      ?? parsed.currentSelectionStatus
      ?? parsed.targetSelectionStatus
      ?? parsed.selection,
  );
  const derivedSelectionStatus = deriveVisualSnapshotSelectionVerificationStatus({
    currentSelection,
    parsed,
    summaryText,
    targetMatched,
  });
  const selectionVerificationStatus = explicitSelectionStatus
    ?? candidateSelectionStatus
    ?? derivedSelectionStatus;
  const selectedActionCandidate = resolveBestVisualSnapshotCandidate({
    candidates: actionCandidates,
    kind: 'action',
    targetCandidate: selectedTargetCandidate,
    targetCandidates,
    targetHint: [
      targetMatched,
      explicitPrimaryAction,
      targetHint,
      summaryText,
    ].filter(Boolean).join(' '),
  });
  const primaryAction = explicitPrimaryAction
    || getVisualSnapshotCandidateLabel(selectedActionCandidate);
  const elementRegion = getVisualSnapshotStringField(parsed, ['elementRegion', 'location', 'coordinates', 'region'])
    || selectedActionCandidate?.region
    || selectedTargetCandidate?.region
    || '';
  const relation = getVisualSnapshotStringField(parsed, ['relation', 'targetRelation', 'association'])
    || selectedActionCandidate?.relation
    || selectedTargetCandidate?.relation
    || createVisualSnapshotOcrDerivedRelation({
      actionCandidate: selectedActionCandidate,
      actionCandidates,
      targetCandidate: selectedTargetCandidate,
      targetCandidates,
      targetMatched,
    })
    || '';
  const explicitPostActionState = normalizeVisualSnapshotPostActionState(
    parsed.postActionState
      ?? parsed.uiState
      ?? parsed.actionState
      ?? parsed.resultState
      ?? parsed.state
      ?? parsed.status,
  );
  const authenticatedState = isVisualSnapshotAuthenticatedState([
    summaryText,
    getVisualSnapshotStringField(parsed, ['mainContent', 'content']),
    getVisualSnapshotStringListField(parsed, ['readableText', 'visibleText', 'visibleTextCandidates']).join(' | '),
    getVisualSnapshotStringListField(parsed, ['visibleObjects', 'objects']).join(' | '),
  ].filter(Boolean).join('\n'));
  const postActionState = explicitPostActionState || normalizeVisualSnapshotPostActionState(summaryText);
  const resolvedPostActionState = authenticatedState ? 'launched' : postActionState;
  const coordinateEvidence = resolveVisualSnapshotPointEvidence(parsed, elementRegion);
  const selectedCandidateBounds = selectedActionCandidate?.bounds ?? selectedTargetCandidate?.bounds ?? null;
  const selectedCandidateCenter = selectedActionCandidate?.center
    ?? selectedTargetCandidate?.center
    ?? createVisualSnapshotCandidatePointFromBounds(selectedCandidateBounds);
  const selectedCandidateCenterRatio = selectedActionCandidate?.centerRatio ?? selectedTargetCandidate?.centerRatio ?? null;
  const rawElementBounds = selectedActionCandidate
    ? selectedCandidateBounds ?? coordinateEvidence.bounds
    : coordinateEvidence.bounds ?? selectedCandidateBounds;
  const rawElementCenter = selectedActionCandidate
    ? selectedCandidateCenter ?? coordinateEvidence.center
    : coordinateEvidence.center ?? selectedCandidateCenter;
  const resolvedElementCenterRatio = coordinateEvidence.ratioCenter
    ? selectedActionCandidate
      ? selectedCandidateCenterRatio ?? coordinateEvidence.ratioCenter
      : coordinateEvidence.ratioCenter
    : selectedCandidateCenterRatio
    ?? normalizeVisualSnapshotRatioPointEvidence(rawElementCenter)
    ?? createVisualSnapshotRatioPointFromBounds(rawElementBounds);
  const resolvedScreenBoundsFromRatio = source
    ? resolveVisualSnapshotAbsoluteRectFromRatio({
        ratioBounds: rawElementBounds,
        source,
      })
    : null;
  const resolvedElementBounds = normalizeVisualSnapshotScreenRectEvidence(rawElementBounds)
    ?? resolvedScreenBoundsFromRatio
    ?? rawElementBounds;
  const derivedAbsoluteCenter = source
    ? resolveVisualSnapshotAbsolutePointFromRatio({
        ratioCenter: resolvedElementCenterRatio,
        source,
      })
    : null;
  const resolvedElementCenter = resolveVisualSnapshotAuditedElementCenter({
    availableSources,
    derivedAbsoluteCenter,
    rawElementBounds,
    rawElementCenter,
    resolvedScreenBoundsFromRatio,
    source,
  });
  const sourceGeometry = source ? createVisualSnapshotSourceGeometryEvidence(source) : null;
  const coordinateAudit = source
    ? createAgentCoordinateAuditEvidence({
        displaySources: availableSources,
        point: resolvedElementCenter,
        source,
      })
    : null;
  const actionEvidence = createVisualSnapshotActionEvidenceAssessment({
    actionCandidates,
    confidenceValue,
    coordinateAudit,
    elementBounds: resolvedElementBounds,
    elementCenter: resolvedElementCenter,
    elementCenterRatio: resolvedElementCenterRatio,
    elementRegion,
    mode,
    primaryAction,
    relation,
    selectionVerificationStatus,
    targetCandidates,
    targetMatched,
  });
  const loginControlCue = /(?:login|log\s*in|sign\s*in|continue|confirm|登录|登陆|继续|确认)/iu;
  const loginGateRecoveryNeeded = resolvedPostActionState === 'login_required'
    && !loginControlCue.test([targetMatched, primaryAction, relation].filter(Boolean).join('\n'));
  const rawLauncherVerification = mode === 'desktop'
    ? createVisualSnapshotLauncherVerification({
        actionCandidates,
        currentSelection,
        primaryAction,
        readiness: actionEvidence.readiness ?? 'unknown',
        relation,
        relationRequired: actionEvidence.relationRequired,
        selectionVerificationStatus,
        targetCandidates,
        targetMatched,
      })
    : null;
  const launcherVerification = resolvedPostActionState === 'launched'
    ? null
    : rawLauncherVerification;
  const launcherVerificationLine = createVisualSnapshotLauncherVerificationLine(launcherVerification);
  const elementCenterLine = resolvedElementCenter
    && Number.isFinite(resolvedElementCenter.x)
    && Number.isFinite(resolvedElementCenter.y)
    ? `Visual element center: x=${Math.round(resolvedElementCenter.x ?? 0)} y=${Math.round(resolvedElementCenter.y ?? 0)}${resolvedElementCenter.source ? ` source=${resolvedElementCenter.source}` : ''}`
    : '';
  const derivedElementCenterLine = !resolvedElementCenter
    && derivedAbsoluteCenter
    && Number.isFinite(derivedAbsoluteCenter.x)
    && Number.isFinite(derivedAbsoluteCenter.y)
    ? `Visual element center: x=${Math.round(derivedAbsoluteCenter.x ?? 0)} y=${Math.round(derivedAbsoluteCenter.y ?? 0)} source=elementCenterRatio`
    : '';
  const elementRatioLine = resolvedElementCenterRatio
    && Number.isFinite(resolvedElementCenterRatio.x)
    && Number.isFinite(resolvedElementCenterRatio.y)
    ? `Visual element center ratio: x=${Number(resolvedElementCenterRatio.x).toFixed(3)} y=${Number(resolvedElementCenterRatio.y).toFixed(3)}`
    : '';
  const coordinateAuditLine = formatAgentCoordinateAuditLine(coordinateAudit, 'Visual coordinate audit');
  const captureQuality = captureContext?.quality ?? null;
  const captureQualityLine = captureQuality
    ? formatAgentCaptureQualityLine(captureQuality, mode === 'game' ? 'Game capture quality' : 'Visual capture quality')
    : '';
  const captureFallbackLine = captureContext?.fallbackLine?.trim() ?? '';
  const targetCandidateLines = targetCandidates.map((candidate, index) => formatVisualSnapshotCandidateLine('target', candidate, index));
  const actionCandidateLines = actionCandidates.map((candidate, index) => formatVisualSnapshotCandidateLine('action', candidate, index));

  const detailLines = mode === 'game'
    ? [
        `Game content analysis: ${summaryText}`,
        getVisualSnapshotStringField(parsed, ['detectedGameOrGenre', 'game', 'genre'])
          ? `Game detected game/genre: ${getVisualSnapshotStringField(parsed, ['detectedGameOrGenre', 'game', 'genre'])}`
          : '',
        getVisualSnapshotStringField(parsed, ['sceneState', 'scene'])
          ? `Game scene state: ${getVisualSnapshotStringField(parsed, ['sceneState', 'scene'])}`
          : '',
        getVisualSnapshotStringField(parsed, ['playerState', 'player'])
          ? `Game player state: ${getVisualSnapshotStringField(parsed, ['playerState', 'player'])}`
          : '',
        getVisualSnapshotStringField(parsed, ['hud', 'hudState'])
          ? `Game HUD: ${getVisualSnapshotStringField(parsed, ['hud', 'hudState'])}`
          : '',
        readableText.length ? `Game visible text: ${readableText.join(' | ')}` : '',
        uncertainty.length ? `Game uncertainty: ${uncertainty.join(' | ')}` : '',
        confidenceText ? `Game confidence: ${confidenceText}` : '',
        companionCue ? `Game companion cue: ${companionCue}` : '',
        captureQualityLine,
        captureFallbackLine,
      ]
    : [
        `Visual summary: ${summaryText}`,
        getVisualSnapshotStringField(parsed, ['visibleAppOrWindow', 'app', 'window'])
          ? `Visual app/window: ${getVisualSnapshotStringField(parsed, ['visibleAppOrWindow', 'app', 'window'])}`
          : '',
        getVisualSnapshotStringField(parsed, ['mainContent', 'content'])
          ? `Visual main content: ${getVisualSnapshotStringField(parsed, ['mainContent', 'content'])}`
          : '',
        getVisualSnapshotStringListField(parsed, ['visibleObjects', 'objects']).length
          ? `Visual visible objects: ${getVisualSnapshotStringListField(parsed, ['visibleObjects', 'objects']).join(' | ')}`
          : '',
        readableText.length ? `Visual readable text: ${readableText.join(' | ')}` : '',
        visibleTextCandidates.length ? `Visual text candidates: ${visibleTextCandidates.join(' | ')}` : '',
        currentSelection ? `Visual current selection: ${currentSelection}` : '',
        selectionVerificationStatus ? `Visual selection verification: ${selectionVerificationStatus}` : '',
        targetMatched ? `Visual target matched: ${targetMatched}` : '',
        ...targetCandidateLines,
        primaryAction ? `Visual primary action: ${primaryAction}` : '',
        ...actionCandidateLines,
        elementRegion ? `Visual element region: ${elementRegion}` : '',
        elementCenterLine,
        derivedElementCenterLine,
        elementRatioLine,
        sourceGeometry?.line ?? '',
        coordinateAuditLine,
        relation ? `Visual target/action relation: ${relation}` : '',
        launcherVerificationLine,
        resolvedPostActionState ? `Visual post-action state: ${resolvedPostActionState}` : '',
        resolvedPostActionState !== 'launched' && actionEvidence.readiness
          ? `Visual action readiness: ${actionEvidence.readiness}`
          : '',
        resolvedPostActionState !== 'launched' && actionEvidence.missingEvidence.length
          ? `Visual missing evidence: ${actionEvidence.missingEvidence.join(' | ')}`
          : '',
        uncertainty.length ? `Visual uncertainty: ${uncertainty.join(' | ')}` : '',
        confidenceText ? `Visual confidence: ${confidenceText}` : '',
        companionCue ? `Visual companion cue: ${companionCue}` : '',
        captureQualityLine,
        captureFallbackLine,
      ];
  const evidenceLines = detailLines.filter(Boolean);
  const recommendedRecovery = [
    confidenceValue !== null && confidenceValue < 0.6
      ? mode === 'game'
        ? `Low game visual confidence (${confidenceValue}); ask the user to confirm the game/window or visible state before acting on it.`
        : `Low visual confidence (${confidenceValue}); ask the user to confirm the target/window/content before acting on it.`
      : '',
    uncertainty.length
      ? mode === 'game'
        ? 'Use the game uncertainty fields in the answer; ask a short clarification before taking action that depends on unclear HUD/text/state.'
        : 'Use the visual uncertainty fields in the answer; ask a short clarification before taking action that depends on unclear text/target/content.'
      : '',
    ...(resolvedPostActionState === 'launched' ? [] : actionEvidence.recommendedRecovery),
    loginGateRecoveryNeeded
      ? 'The current app is on a login/account gate. Locate and resolve the login control before searching for the requested in-app target.'
      : '',
    launcherVerification
      && launcherVerification.status
      && launcherVerification.status !== 'ready'
      && launcherVerification.reason
      ? `Recover launcher state: ${launcherVerification.reason}`
      : '',
    coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
      ? 'Refresh capture sources and re-locate the target before clicking; the current coordinate does not geometrically match the selected capture source.'
      : '',
    captureQuality && !captureQuality.trusted
      ? 'Do not act on this visual result until a trusted capture is available; retry with a screen source, a different sourceId, or ask the user to reveal the target window.'
      : '',
  ].filter(Boolean);
  const missingEvidence = [
    ...uncertainty.map((item) => (
      mode === 'game' ? `Game uncertainty: ${item}` : `Visual uncertainty: ${item}`
    )),
    ...(resolvedPostActionState === 'launched' ? [] : actionEvidence.missingEvidence),
    loginGateRecoveryNeeded
      ? 'The requested in-app target is not actionable until the current login/account gate is resolved.'
      : '',
    launcherVerification
      && launcherVerification.status
      && launcherVerification.status !== 'ready'
      && launcherVerification.reason
      ? `Launcher verification failed: ${launcherVerification.reason}`
      : '',
    coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
      ? `Coordinate audit failed: ${coordinateAudit.status} (${coordinateAudit.reason})`
      : '',
    captureQuality && !captureQuality.trusted
      ? `Capture is untrusted: ${captureQuality.status} (${captureQuality.reason})`
      : '',
  ];
  const selectionRecoveryReason = selectionVerificationStatus === 'mismatch'
    ? 'The requested target is visible, but visual evidence says a different item/detail page is currently selected.'
    : selectionVerificationStatus === 'visible-only'
      ? 'The requested target is visible, but visual evidence does not confirm it is the current selected/detail item.'
      : '';
  const primaryActionRecoveryReason = actionEvidence.readiness === 'needs-primary-action'
    && targetMatched
    && selectionVerificationStatus === 'selected'
    ? 'The requested target is confirmed selected/current, but no associated primary open/start/play action has been identified yet.'
    : '';
  const selectionRecovery = selectionRecoveryReason
    ? {
        nextArgs: {
          action: 'locate_element',
          forceRefresh: true,
          question: [
            'Re-check target selection state before any primary open/start/play action.',
            'Identify the current selected/detail item, the requested target item, whether the requested target is selected/current or only visible, and the best safe coordinate or UIA candidate for selecting the requested target item.',
            'Do not click or invoke anything during this read.',
          ].join(' '),
          targetDescription: targetMatched || targetHint || summaryText,
          targetText: targetMatched || targetHint || '',
        },
        nextTool: 'locate_screen_elements' as const,
        reason: selectionRecoveryReason,
        strategy: 're-locate-target' as const,
      }
    : null;
  const primaryActionRecovery = primaryActionRecoveryReason
    ? {
        nextArgs: {
          action: 'locate_element',
          forceRefresh: true,
          question: [
            'The requested target is already selected/current.',
            'Find the primary open/start/play/launch action that belongs to this selected target or its current detail page.',
            'Return primaryAction, relation, actionCandidates, elementCenter or elementCenterRatio, confidence, coordinateConfidence, and visualActionReadiness.',
            'Do not click or invoke anything during this read.',
          ].join(' '),
          targetDescription: `${targetMatched}; primary open/start/play action associated with the selected target`,
          targetText: targetMatched,
        },
        nextTool: 'locate_screen_elements' as const,
        reason: primaryActionRecoveryReason,
        strategy: 're-locate-target' as const,
      }
    : null;
  const loginStateRecovery = loginGateRecoveryNeeded
    ? {
        nextArgs: {
          action: 'locate_element',
          forceRefresh: true,
          ...(source?.name ? { sourceQuery: source.name } : {}),
          question: [
            'The current app/window is still on a login or account gate.',
            'Locate the visible login, continue, confirm, or one-click-login control before looking for the requested in-app target.',
            'Do not click or invoke anything during this read.',
          ].join(' '),
          targetDescription: `login or continue control in ${source?.name || 'the current app/window'}`,
          targetText: '登录',
        },
        nextTool: 'locate_screen_elements' as const,
        reason: 'The full visual state indicates login is required; defer the requested in-app target until login is resolved.',
        strategy: 're-locate-target' as const,
      }
    : null;
  const visualReadable = captureQuality?.trusted ?? true;
  const captureAvailable = Boolean(source);
  const windowPresent = source?.type === 'window';
  const interactionReady = actionEvidence.readiness === 'ready'
    && !loginGateRecoveryNeeded
    && resolvedPostActionState !== 'launched';
  const desktopTargetPresence: AgentStructuredToolEvidence['desktopTargetPresence'] = !windowPresent
    ? 'unknown'
    : !visualReadable
      ? 'present_unreadable'
      : interactionReady || resolvedPostActionState === 'launched'
        ? 'present_interactable'
        : 'present_unreadable';

  return {
    companionCue,
    confidenceLine: confidenceText
      ? mode === 'game'
        ? `Game confidence: ${confidenceText}`
        : `Visual confidence: ${confidenceText}`
      : '',
    evidenceLines,
    missingEvidence,
    observedState: evidenceLines.filter((line) => !/ uncertainty: | confidence: | companion cue: | missing evidence: /iu.test(line)),
    recommendedRecovery,
    responseText: evidenceLines.join('\n'),
    structuredEvidence: {
      confidence: confidenceValue !== null
        ? confidenceValue >= 0.8
          ? 'high'
          : confidenceValue >= 0.6
            ? 'medium'
            : 'low'
        : null,
      captureFallback: captureFallbackLine
        ? {
            fromSourceId: captureContext?.selectedSource?.id ?? null,
            fromSourceType: captureContext?.selectedSource?.type ?? null,
            reason: captureQuality?.reason ?? captureFallbackLine,
            toSourceId: source?.id ?? null,
            toSourceType: source?.type ?? null,
          }
        : null,
      captureQuality: captureQuality?.metrics ?? null,
      captureReason: captureQuality?.reason ?? null,
      captureSourceType: source?.type ?? null,
      captureStatus: captureQuality?.status ?? null,
      captureTrusted: captureQuality?.trusted ?? null,
      appExecutionProfile: 'unknown',
      captureAvailable,
      coordinateAudit,
      coordinateAuditStatus: coordinateAudit?.status ?? null,
      coordinateConfidence: resolvedElementCenter || resolvedElementCenterRatio
        ? coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
          ? 'low'
          : confidenceValue !== null && confidenceValue >= 0.8
            ? 'high'
            : 'medium'
        : elementRegion
          ? 'low'
          : null,
      actionCandidates: actionCandidates.length ? actionCandidates : null,
      elementBounds: resolvedElementBounds,
      elementCenter: resolvedElementCenter,
      elementCenterRatio: resolvedElementCenterRatio,
      elementDescription: getVisualSnapshotStringField(parsed, ['elementDescription', 'description']) || summaryText,
      elementRegion,
      desktopTargetPresence,
      foreground: null,
      launcherVerification,
      targetInteractionVerification: launcherVerification,
      currentSelection,
      primaryAction,
      interactionReady,
      postActionState: resolvedPostActionState || null,
      postActionRecovery: loginStateRecovery ?? selectionRecovery ?? primaryActionRecovery,
      processPresent: null,
      relation,
      selectionEvidence: [
        currentSelection ? `Visual current selection: ${currentSelection}` : '',
        selectionVerificationStatus ? `Visual selection verification: ${selectionVerificationStatus}` : '',
      ].filter(Boolean),
      selectionVerificationStatus,
      sourceBounds: sourceGeometry?.bounds ?? null,
      status: uncertainty.length
        || (captureQuality && !captureQuality.trusted)
        || (confidenceValue !== null && confidenceValue < 0.6)
        || loginGateRecoveryNeeded
        || (primaryAction ? !isVisualSnapshotPrimaryActionUseful(primaryAction) : false)
        || (
          resolvedPostActionState !== 'launched'
          && actionEvidence.readiness !== null
          && actionEvidence.readiness !== 'ready'
        )
        ? 'unverified'
        : 'success',
      targetCandidates: targetCandidates.length ? targetCandidates : null,
      targetMatched,
      visibleTextCandidates: visibleTextCandidates.length ? visibleTextCandidates : null,
      visualActionReadiness: resolvedPostActionState === 'launched'
        ? null
        : loginGateRecoveryNeeded ? 'needs-primary-action' : actionEvidence.readiness,
      visualReadable,
      windowPresent,
    } satisfies AgentStructuredToolEvidence,
    summaryText,
    verificationEvidence: [
      confidenceText
        ? mode === 'game'
          ? `Game confidence: ${confidenceText}`
          : `Visual confidence: ${confidenceText}`
        : '',
      companionCue
        ? mode === 'game'
          ? `Game companion cue: ${companionCue}`
          : `Visual companion cue: ${companionCue}`
        : '',
      resolvedPostActionState ? `Visual post-action state: ${resolvedPostActionState}` : '',
      selectionVerificationStatus ? `Visual selection verification: ${selectionVerificationStatus}` : '',
      launcherVerificationLine,
      ...(resolvedPostActionState === 'launched' ? [] : actionEvidence.verificationEvidence),
      captureQualityLine,
      captureFallbackLine,
    ].filter(Boolean),
  };
}

function createVisualSnapshotSourceLabel(source: DesktopPetCaptureSourceLike) {
  const sizeText = source.width && source.height ? `${source.width}x${source.height}` : 'unknown-size';
  const displayText = source.displayId ? ` display=${source.displayId}` : '';
  return `[${source.type}] ${source.name} ${sizeText}${displayText}`;
}

function resolveVisualSnapshotSourceBounds(source: DesktopPetCaptureSourceLike) {
  const rawBounds = source.bounds;
  if (
    rawBounds
    && Number.isFinite(Number(rawBounds.x))
    && Number.isFinite(Number(rawBounds.y))
    && Number.isFinite(Number(rawBounds.width))
    && Number.isFinite(Number(rawBounds.height))
    && Number(rawBounds.width) > 0
    && Number(rawBounds.height) > 0
  ) {
    return {
      height: Math.round(Number(rawBounds.height)),
      width: Math.round(Number(rawBounds.width)),
      x: Math.round(Number(rawBounds.x)),
      y: Math.round(Number(rawBounds.y)),
    };
  }

  if (
    source.type === 'screen'
    && Number.isFinite(Number(source.width))
    && Number.isFinite(Number(source.height))
    && Number(source.width) > 0
    && Number(source.height) > 0
  ) {
    return {
      height: Math.round(Number(source.height)),
      width: Math.round(Number(source.width)),
      x: 0,
      y: 0,
    };
  }

  return null;
}

function resolveVisualSnapshotAbsolutePointFromRatio(options: {
  ratioCenter?: AgentStructuredToolPointEvidence | null;
  source: DesktopPetCaptureSourceLike;
}) {
  const ratioCenter = options.ratioCenter;
  if (
    !ratioCenter
    || !Number.isFinite(Number(ratioCenter.x))
    || !Number.isFinite(Number(ratioCenter.y))
  ) {
    return null;
  }

  const sourceBounds = resolveVisualSnapshotSourceBounds(options.source);
  if (!sourceBounds) {
    return null;
  }

  const xRatio = Math.max(0, Math.min(1, Number(ratioCenter.x)));
  const yRatio = Math.max(0, Math.min(1, Number(ratioCenter.y)));

  return {
    coordinateSpace: 'native-screen',
    source: 'elementCenterRatio',
    x: Math.round(sourceBounds.x + sourceBounds.width * xRatio),
    y: Math.round(sourceBounds.y + sourceBounds.height * yRatio),
  } satisfies AgentStructuredToolPointEvidence;
}

function resolveVisualSnapshotAuditedElementCenter(options: {
  availableSources: DesktopPetCaptureSourceLike[];
  derivedAbsoluteCenter?: AgentStructuredToolPointEvidence | null;
  rawElementBounds?: AgentStructuredToolRectEvidence | null;
  rawElementCenter?: AgentStructuredToolPointEvidence | null;
  resolvedScreenBoundsFromRatio?: AgentStructuredToolRectEvidence | null;
  source?: DesktopPetCaptureSourceLike | null;
}) {
  const normalizedRawCenter = normalizeVisualSnapshotScreenPointEvidence(options.rawElementCenter);
  const boundsCenter = createVisualSnapshotCandidatePointFromBounds(
    normalizeVisualSnapshotScreenRectEvidence(options.rawElementBounds) ?? options.resolvedScreenBoundsFromRatio,
  );

  if (!options.source) {
    return normalizedRawCenter ?? boundsCenter ?? options.derivedAbsoluteCenter ?? null;
  }

  const rawAudit = normalizedRawCenter
    ? createAgentCoordinateAuditEvidence({
        displaySources: options.availableSources,
        point: normalizedRawCenter,
        source: options.source,
      })
    : null;
  if (rawAudit?.status === 'coordinate_ok') {
    return normalizedRawCenter;
  }

  const derivedAudit = options.derivedAbsoluteCenter
    ? createAgentCoordinateAuditEvidence({
        displaySources: options.availableSources,
        point: options.derivedAbsoluteCenter,
        source: options.source,
      })
    : null;
  if (derivedAudit?.status === 'coordinate_ok') {
    return options.derivedAbsoluteCenter ?? null;
  }

  const boundsAudit = boundsCenter
    ? createAgentCoordinateAuditEvidence({
        displaySources: options.availableSources,
        point: boundsCenter,
        source: options.source,
      })
    : null;
  if (boundsAudit?.status === 'coordinate_ok') {
    return boundsCenter;
  }

  return normalizedRawCenter ?? boundsCenter ?? options.derivedAbsoluteCenter ?? null;
}

function createVisualSnapshotSourceGeometryEvidence(source: DesktopPetCaptureSourceLike) {
  const bounds = resolveVisualSnapshotSourceBounds(source);
  return {
    bounds: bounds
      ? {
          coordinateSpace: 'native-screen',
          height: bounds.height,
          source: 'capture-source',
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        } satisfies AgentStructuredToolRectEvidence
      : null,
    line: bounds
      ? `Visual source bounds: x=${bounds.x} y=${bounds.y} width=${bounds.width} height=${bounds.height}`
      : '',
  };
}

type VisualSnapshotCropCoordinateSpace = 'native-screen' | 'source' | 'source-ratio';

interface VisualSnapshotFocusCropRequest {
  coordinateSpace: VisualSnapshotCropCoordinateSpace;
  height?: number;
  paddingRatio: number;
  scale?: number;
  width?: number;
  x?: number;
  y?: number;
}

interface VisualSnapshotResolvedCrop {
  imageRect: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  label: string;
  scale: number;
  sourceBounds: DesktopPetCaptureRectLike | null;
}

interface VisualSnapshotPreparedSource {
  captureFallbackLine: string;
  captureQuality: AgentCaptureQualityAnalysis;
  cropLine: string;
  imageDataUrl: string;
  source: DesktopPetCaptureSourceLike;
}

function normalizeVisualSnapshotCropCoordinateSpace(value: string) {
  if (value === 'native-screen' || value === 'source' || value === 'source-ratio') {
    return value;
  }

  return 'source-ratio';
}

function clampVisualSnapshotFocusScale(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(4, value));
}

function resolveAutoVisualSnapshotFocusScale(rect: { height: number; width: number }) {
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const longestSide = Math.max(width, height);
  const shortestSide = Math.min(width, height);
  const scale = Math.max(
    longestSide < 900 ? 900 / longestSide : 1,
    shortestSide < 360 ? 360 / shortestSide : 1,
  );
  const clampedScale = Math.min(3, clampVisualSnapshotFocusScale(scale));
  return clampedScale <= 1.15 ? 1 : Math.round(clampedScale * 100) / 100;
}

function getVisualSnapshotFocusCropRequest(toolCall: AgentToolCallCommand): VisualSnapshotFocusCropRequest | null {
  const centerRatioX = getToolNumberInputAny(toolCall, ['focusCenterRatioX', 'cropCenterRatioX', 'centerRatioX']);
  const centerRatioY = getToolNumberInputAny(toolCall, ['focusCenterRatioY', 'cropCenterRatioY', 'centerRatioY']);
  const widthRatio = getToolNumberInputAny(toolCall, ['focusWidthRatio', 'cropWidthRatio', 'widthRatio']);
  const heightRatio = getToolNumberInputAny(toolCall, ['focusHeightRatio', 'cropHeightRatio', 'heightRatio']);
  const explicitScale = getToolNumberInputAny(toolCall, ['focusScale', 'cropScale', 'magnification', 'zoomScale']);
  const paddingRatio = Math.max(0, Math.min(2, getToolNumberInputAny(
    toolCall,
    ['focusPaddingRatio', 'cropPaddingRatio', 'paddingRatio'],
  ) ?? 0.35));

  if (
    typeof centerRatioX === 'number'
    && typeof centerRatioY === 'number'
    && centerRatioX >= 0
    && centerRatioX <= 1
    && centerRatioY >= 0
    && centerRatioY <= 1
  ) {
    const resolvedWidthRatio = Math.max(0.05, Math.min(1, widthRatio ?? 0.34));
    const resolvedHeightRatio = Math.max(0.05, Math.min(1, heightRatio ?? 0.26));
    return {
      coordinateSpace: 'source-ratio',
      height: resolvedHeightRatio,
      paddingRatio: 0,
      scale: typeof explicitScale === 'number' ? clampVisualSnapshotFocusScale(explicitScale) : undefined,
      width: resolvedWidthRatio,
      x: centerRatioX - resolvedWidthRatio / 2,
      y: centerRatioY - resolvedHeightRatio / 2,
    };
  }

  const x = getToolNumberInputAny(toolCall, ['focusX', 'cropX', 'x']);
  const y = getToolNumberInputAny(toolCall, ['focusY', 'cropY', 'y']);
  const width = getToolNumberInputAny(toolCall, ['focusWidth', 'cropWidth', 'width']);
  const height = getToolNumberInputAny(toolCall, ['focusHeight', 'cropHeight', 'height']);
  if (
    typeof x !== 'number'
    || typeof y !== 'number'
    || typeof width !== 'number'
    || typeof height !== 'number'
    || width <= 0
    || height <= 0
  ) {
    return null;
  }

  return {
    coordinateSpace: normalizeVisualSnapshotCropCoordinateSpace(
      getToolStringInput(toolCall, ['focusCoordinateSpace', 'cropCoordinateSpace', 'coordinateSpace']) || 'source',
    ),
    height,
    paddingRatio,
    scale: typeof explicitScale === 'number' ? clampVisualSnapshotFocusScale(explicitScale) : undefined,
    width,
    x,
    y,
  };
}

function clampVisualSnapshotRectToImage(rect: {
  height: number;
  width: number;
  x: number;
  y: number;
}, imageWidth: number, imageHeight: number) {
  const x = Math.max(0, Math.min(imageWidth - 1, rect.x));
  const y = Math.max(0, Math.min(imageHeight - 1, rect.y));
  const right = Math.max(x + 1, Math.min(imageWidth, rect.x + rect.width));
  const bottom = Math.max(y + 1, Math.min(imageHeight, rect.y + rect.height));
  return {
    height: Math.max(1, Math.round(bottom - y)),
    width: Math.max(1, Math.round(right - x)),
    x: Math.round(x),
    y: Math.round(y),
  };
}

function expandVisualSnapshotRect(rect: {
  height: number;
  width: number;
  x: number;
  y: number;
}, paddingRatio: number) {
  const padX = rect.width * paddingRatio;
  const padY = rect.height * paddingRatio;
  return {
    height: rect.height + padY * 2,
    width: rect.width + padX * 2,
    x: rect.x - padX,
    y: rect.y - padY,
  };
}

function resolveVisualSnapshotCropRequest(options: {
  imageHeight: number;
  imageWidth: number;
  request: VisualSnapshotFocusCropRequest;
  source: DesktopPetCaptureSourceLike;
}): VisualSnapshotResolvedCrop | null {
  const { imageHeight, imageWidth, request, source } = options;
  const sourceBounds = resolveVisualSnapshotSourceBounds(source);
  const sourceWidth = sourceBounds?.width ?? source.width ?? imageWidth;
  const sourceHeight = sourceBounds?.height ?? source.height ?? imageHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  let sourceRect: { height: number; width: number; x: number; y: number };
  if (request.coordinateSpace === 'source-ratio') {
    sourceRect = {
      height: (request.height ?? 0) * sourceHeight,
      width: (request.width ?? 0) * sourceWidth,
      x: (request.x ?? 0) * sourceWidth,
      y: (request.y ?? 0) * sourceHeight,
    };
  } else if (request.coordinateSpace === 'native-screen' && sourceBounds) {
    sourceRect = {
      height: request.height ?? 0,
      width: request.width ?? 0,
      x: (request.x ?? 0) - sourceBounds.x,
      y: (request.y ?? 0) - sourceBounds.y,
    };
  } else {
    sourceRect = {
      height: request.height ?? 0,
      width: request.width ?? 0,
      x: request.x ?? 0,
      y: request.y ?? 0,
    };
  }

  if (sourceRect.width <= 0 || sourceRect.height <= 0) {
    return null;
  }

  const paddedSourceRect = expandVisualSnapshotRect(sourceRect, request.paddingRatio);
  const imageRect = clampVisualSnapshotRectToImage({
    height: paddedSourceRect.height * (imageHeight / sourceHeight),
    width: paddedSourceRect.width * (imageWidth / sourceWidth),
    x: paddedSourceRect.x * (imageWidth / sourceWidth),
    y: paddedSourceRect.y * (imageHeight / sourceHeight),
  }, imageWidth, imageHeight);
  const cropSourceRect = {
    height: imageRect.height * (sourceHeight / imageHeight),
    width: imageRect.width * (sourceWidth / imageWidth),
    x: imageRect.x * (sourceWidth / imageWidth),
    y: imageRect.y * (sourceHeight / imageHeight),
  };
  const cropScreenBounds = sourceBounds
    ? {
        height: Math.round(cropSourceRect.height),
        width: Math.round(cropSourceRect.width),
        x: Math.round(sourceBounds.x + cropSourceRect.x),
        y: Math.round(sourceBounds.y + cropSourceRect.y),
      }
    : null;

  return {
    imageRect,
    label: `focus crop ${imageRect.x},${imageRect.y},${imageRect.width}x${imageRect.height} from ${imageWidth}x${imageHeight}`,
    scale: request.scale ?? resolveAutoVisualSnapshotFocusScale(imageRect),
    sourceBounds: cropScreenBounds,
  };
}

function loadVisualSnapshotImage(imageDataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Current runtime cannot crop visual snapshots because Image is unavailable.'));
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load visual snapshot image for focus crop.'));
    image.src = imageDataUrl;
  });
}

async function createFocusedVisualSnapshotSource(options: {
  source: DesktopPetCaptureSourceLike;
  toolCall: AgentToolCallCommand;
}) {
  const request = getVisualSnapshotFocusCropRequest(options.toolCall);
  if (!request) {
    return {
      cropLine: '',
      imageDataUrl: options.source.thumbnail ?? '',
      source: options.source,
    };
  }

  const image = await loadVisualSnapshotImage(options.source.thumbnail ?? '');
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('视觉快照图片尺寸无效，无法裁剪局部区域。');
  }

  const crop = resolveVisualSnapshotCropRequest({
    imageHeight,
    imageWidth,
    request,
    source: options.source,
  });
  if (!crop) {
    throw new Error('局部视觉观察参数无效，无法解析裁剪区域。');
  }

  if (typeof document === 'undefined') {
    throw new Error('Current runtime cannot crop visual snapshots because document is unavailable.');
  }

  const outputWidth = Math.max(1, Math.round(crop.imageRect.width * crop.scale));
  const outputHeight = Math.max(1, Math.round(crop.imageRect.height * crop.scale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建视觉裁剪画布。');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    crop.imageRect.x,
    crop.imageRect.y,
    crop.imageRect.width,
    crop.imageRect.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  const croppedImageDataUrl = canvas.toDataURL('image/png');
  const scaleLine = crop.scale > 1 ? ` scale=${crop.scale} output=${outputWidth}x${outputHeight}` : '';

  return {
    cropLine: `Visual focus crop: ${crop.label}${scaleLine}${crop.sourceBounds ? ` screenBounds=${crop.sourceBounds.x},${crop.sourceBounds.y},${crop.sourceBounds.width}x${crop.sourceBounds.height}` : ''}`,
    imageDataUrl: croppedImageDataUrl,
    source: {
      ...options.source,
      bounds: crop.sourceBounds ?? options.source.bounds,
      height: crop.sourceBounds?.height ?? crop.imageRect.height,
      name: `${options.source.name} focus crop`,
      thumbnail: croppedImageDataUrl,
      width: crop.sourceBounds?.width ?? crop.imageRect.width,
    } satisfies DesktopPetCaptureSourceLike,
  };
}

function findVisualSnapshotScreenSourceForBounds(
  sources: DesktopPetCaptureSourceLike[],
  bounds: DesktopPetCaptureRectLike | null,
) {
  const screenSources = sources.filter((source) => source.type === 'screen' && Boolean(source.thumbnail));
  if (!screenSources.length) {
    return null;
  }

  if (!bounds) {
    return screenSources[0] ?? null;
  }

  const pointX = bounds.x + bounds.width / 2;
  const pointY = bounds.y + bounds.height / 2;
  return screenSources.find((source) => {
    const screenBounds = resolveVisualSnapshotSourceBounds(source);
    return Boolean(
      screenBounds
      && pointX >= screenBounds.x
      && pointX <= screenBounds.x + screenBounds.width
      && pointY >= screenBounds.y
      && pointY <= screenBounds.y + screenBounds.height,
    );
  }) ?? screenSources[0] ?? null;
}

function resolveVisualSnapshotFallbackCropRequest(options: {
  screenSource: DesktopPetCaptureSourceLike;
  windowSource: DesktopPetCaptureSourceLike;
}): VisualSnapshotFocusCropRequest | null {
  const windowBounds = resolveVisualSnapshotSourceBounds(options.windowSource);
  const screenBounds = resolveVisualSnapshotSourceBounds(options.screenSource);
  if (!windowBounds || !screenBounds) {
    return null;
  }

  const intersectionX = Math.max(windowBounds.x, screenBounds.x);
  const intersectionY = Math.max(windowBounds.y, screenBounds.y);
  const intersectionRight = Math.min(windowBounds.x + windowBounds.width, screenBounds.x + screenBounds.width);
  const intersectionBottom = Math.min(windowBounds.y + windowBounds.height, screenBounds.y + screenBounds.height);
  const width = Math.round(intersectionRight - intersectionX);
  const height = Math.round(intersectionBottom - intersectionY);
  if (width <= 8 || height <= 8) {
    return null;
  }

  return {
    coordinateSpace: 'native-screen',
    height,
    paddingRatio: 0,
    scale: 1,
    width,
    x: Math.round(intersectionX),
    y: Math.round(intersectionY),
  };
}

async function createFallbackScreenCropVisualSnapshotSource(options: {
  reason: string;
  screenSource: DesktopPetCaptureSourceLike;
  windowSource: DesktopPetCaptureSourceLike;
}) {
  const cropRequest = resolveVisualSnapshotFallbackCropRequest({
    screenSource: options.screenSource,
    windowSource: options.windowSource,
  });
  if (!cropRequest) {
    return null;
  }

  const fallbackToolCall: AgentToolCallCommand = {
    goal: 'fallback screen crop for window capture',
    input: {
      focusCoordinateSpace: 'native-screen',
      focusHeight: cropRequest.height,
      focusPaddingRatio: 0,
      focusScale: 1,
      focusWidth: cropRequest.width,
      focusX: cropRequest.x,
      focusY: cropRequest.y,
    },
    name: 'summarize_visual_snapshot',
  };
  const focusedSource = await createFocusedVisualSnapshotSource({
    source: options.screenSource,
    toolCall: fallbackToolCall,
  });
  const quality = await analyzeAgentCaptureDataUrl(focusedSource.imageDataUrl);

  return {
    captureFallbackLine: [
      'Capture fallback: capture_fallback_screen_crop',
      `from=${options.windowSource.id || options.windowSource.name}`,
      `to=${options.screenSource.id || options.screenSource.name}`,
      `reason=${options.reason}`,
    ].join(' | '),
    captureQuality: quality.trusted
      ? {
          ...quality,
          reason: `Fallback screen crop trusted after window capture issue: ${quality.reason}`,
          status: 'capture_fallback_screen_crop' as const,
          trusted: true,
        }
      : {
          ...quality,
          reason: `Fallback screen crop is still untrusted: ${quality.reason}`,
          status: 'capture_untrusted' as const,
          trusted: false,
        },
    cropLine: focusedSource.cropLine,
    imageDataUrl: focusedSource.imageDataUrl,
    source: {
      ...focusedSource.source,
      id: focusedSource.source.id || options.screenSource.id,
      name: `${options.windowSource.name} via screen crop`,
      type: 'window',
    } satisfies DesktopPetCaptureSourceLike,
  } satisfies VisualSnapshotPreparedSource;
}

async function createActiveWindowCaptureRecoverySource(options: {
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
}) {
  if (!options.query) {
    return null;
  }

  let activeWindow: {
    bounds?: DesktopPetCaptureRectLike | null;
    displayId?: string | null;
    displayLabel?: string | null;
    executablePath?: string | null;
    hwnd?: number | null;
    ok?: boolean;
    pid?: number | null;
    processName?: string | null;
    title?: string | null;
  };
  try {
    activeWindow = await desktopPetShellRuntime.getActiveWindowInfo();
  } catch {
    return null;
  }
  const bounds = activeWindow?.bounds;
  const hwnd = Number(activeWindow?.hwnd);
  if (
    activeWindow?.ok === false
    || !bounds
    || !Number.isFinite(hwnd)
    || hwnd <= 0
  ) {
    return null;
  }

  const windowSource: DesktopPetCaptureSourceLike = {
    bounds,
    boundsCoordinateSpace: 'native-screen',
    displayId: activeWindow.displayId ?? null,
    height: bounds.height,
    id: `window:active:${Math.round(hwnd)}`,
    name: activeWindow.title?.trim() || activeWindow.processName?.trim() || `active window ${Math.round(hwnd)}`,
    type: 'window',
    width: bounds.width,
  };
  if (scoreVisualSnapshotSourceMatch(windowSource, options.query) < 8) {
    return null;
  }

  const screenSource = findVisualSnapshotScreenSourceForBounds(options.availableSources, bounds);
  if (!screenSource?.thumbnail) {
    return null;
  }

  return createFallbackScreenCropVisualSnapshotSource({
    reason: 'active window HWND/bounds recovery',
    screenSource,
    windowSource,
  });
}

async function createTrustedVisualSnapshotSource(options: {
  allowScreenFallback: boolean;
  availableSources: DesktopPetCaptureSourceLike[];
  selectedSource: DesktopPetCaptureSourceLike;
  toolCall: AgentToolCallCommand;
}): Promise<VisualSnapshotPreparedSource> {
  const focusedSource = await createFocusedVisualSnapshotSource({
    source: options.selectedSource,
    toolCall: options.toolCall,
  });
  const quality = await analyzeAgentCaptureDataUrl(focusedSource.imageDataUrl);
  if (
    quality.trusted
    || options.selectedSource.type !== 'window'
    || !options.allowScreenFallback
  ) {
    return {
      captureFallbackLine: '',
      captureQuality: quality,
      cropLine: focusedSource.cropLine,
      imageDataUrl: focusedSource.imageDataUrl,
      source: focusedSource.source,
    };
  }

  const screenSource = findVisualSnapshotScreenSourceForBounds(
    options.availableSources,
    resolveVisualSnapshotSourceBounds(options.selectedSource),
  );
  if (!screenSource?.thumbnail) {
    return {
      captureFallbackLine: 'Capture fallback unavailable: no screen source with thumbnail for the selected window bounds.',
      captureQuality: {
        ...quality,
        reason: `Window capture is untrusted and no screen fallback was available: ${quality.reason}`,
        status: 'capture_untrusted',
        trusted: false,
      },
      cropLine: focusedSource.cropLine,
      imageDataUrl: focusedSource.imageDataUrl,
      source: focusedSource.source,
    };
  }

  const fallbackSource = await createFallbackScreenCropVisualSnapshotSource({
    reason: quality.status,
    screenSource,
    windowSource: options.selectedSource,
  });
  return fallbackSource ?? {
    captureFallbackLine: 'Capture fallback unavailable: selected window bounds could not be mapped into a screen crop.',
    captureQuality: {
      ...quality,
      reason: `Window capture is untrusted and screen crop mapping failed: ${quality.reason}`,
      status: 'capture_untrusted',
      trusted: false,
    },
    cropLine: focusedSource.cropLine,
    imageDataUrl: focusedSource.imageDataUrl,
    source: focusedSource.source,
  };
}

function createVisualSnapshotRecoveryStateSummary(options: {
  availableSourceCount?: number;
  candidateLines?: string[];
  errorText?: string | null;
  mode: 'desktop' | 'game';
  query?: string | null;
  sourceId?: string | null;
  sourceLabel?: string | null;
  sourceType?: string | null;
  thumbnailUnavailable?: boolean;
}) {
  const visualLabel = options.mode === 'game' ? 'Game' : 'Visual';
  const requestedTarget = [
    options.sourceType ? `type=${options.sourceType}` : '',
    options.sourceId ? `sourceId=${options.sourceId}` : '',
    options.query ? `query=${options.query}` : '',
  ].filter(Boolean).join(', ');
  const observedState = [
    requestedTarget ? `${visualLabel} requested source: ${requestedTarget}` : '',
    options.sourceLabel ? `${visualLabel} selected source: ${options.sourceLabel}` : '',
    typeof options.availableSourceCount === 'number'
      ? `${visualLabel} available capture sources: ${options.availableSourceCount}`
      : '',
    ...(options.candidateLines ?? []).slice(0, 8),
  ].filter(Boolean);
  const missingEvidence = [
    options.thumbnailUnavailable
      ? `${visualLabel} thumbnail unavailable for selected source.`
      : options.sourceLabel
        ? ''
        : `${visualLabel} capture source was not identified confidently.`,
    options.errorText ? `${visualLabel} analysis error: ${options.errorText}` : '',
  ].filter(Boolean);
  const recommendedRecovery = [
    options.errorText
      ? 'Do not repeat the same visual model call with identical args. Ask the user to check vision settings/model support, or try a different visible source if that fits the request.'
      : '',
    options.thumbnailUnavailable
      ? 'If the target window is minimized/hidden, ask the user to show it; otherwise retry with sourceType "screen" or another concrete sourceId.'
      : '',
    !options.sourceLabel
      ? 'Use list_capture_sources or get_active_window_info to identify the exact capture source before retrying visual analysis.'
      : '',
    !options.sourceLabel
      ? 'If candidate sources are ambiguous, ask one short question asking which screen/window to inspect.'
      : '',
  ].filter(Boolean);

  return {
    missingEvidence,
    observedState,
    recommendedRecovery,
    verificationEvidence: [
      options.errorText
        ? `${visualLabel} analysis did not produce a reliable visual summary.`
        : '',
    ].filter(Boolean),
  };
}

export async function executeSummarizeVisualSnapshot(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  sourceText: string,
): Promise<AgentChatCommandResult> {
  const sourceType = normalizeVisualSnapshotSourceTypeInput(
    getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'all',
  );
  const captureSourceTypes = normalizeCaptureSourceTypesInput(sourceType);
  const sourceId = getToolStringInput(toolCall, ['sourceId', 'id']);
  const rawSourceId = getToolRawInputValue(toolCall, 'sourceId') ?? getToolRawInputValue(toolCall, 'id');
  const query = getToolStringInput(toolCall, ['query', 'target', 'sourceName', 'name']);
  const explicitScreenFallback = getToolBooleanInputAny(toolCall, [
    'allowScreenFallback',
    'fallbackToScreen',
    'allowSourceFallback',
  ]);
  const allowScreenFallback = explicitScreenFallback === true;
  const allowWindowCaptureFallback = explicitScreenFallback !== false && sourceType !== 'screen';
  const captureRequestSourceTypes = (allowScreenFallback || allowWindowCaptureFallback) && !captureSourceTypes.includes('screen')
    ? Array.from(new Set([...captureSourceTypes, 'screen'])) as Array<'screen' | 'window'>
    : captureSourceTypes;
  const question = getToolStringInput(toolCall, ['question', 'goal', 'prompt'])
    || toolCall.goal
    || sourceText
    || 'Summarize the visible content in this desktop snapshot.';
  const captureResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes: captureRequestSourceTypes,
    forceRefresh: getToolBooleanInput(toolCall, 'forceRefresh') === true,
    includeCaptureThumbnails: true,
  }) as Promise<DesktopPetCaptureSourceLike[]>);
  if (captureResult.cancelled === true) {
    return captureResult.result;
  }

  const sources = captureResult.value;
  const availableSources = Array.isArray(sources) ? sources : [];
  let selectedSource = selectVisualSnapshotSource(availableSources, {
    allowScreenFallback,
    query,
    sourceId,
    sourceType,
  });
  const sourceSelectionDiagnostics = createVisualSnapshotSourceSelectionDiagnostics(availableSources, {
    allowScreenFallback,
    query,
    rawSourceId,
    selectedSource,
    sourceId,
    sourceType,
  });

  const activeWindowRecoverySource = sourceType !== 'screen'
    && Boolean(query || sourceId)
    && (!selectedSource || selectedSource.type !== 'window')
    ? await createActiveWindowCaptureRecoverySource({
        availableSources,
        query: query || sourceId,
      })
    : null;
  if (activeWindowRecoverySource) {
    selectedSource = activeWindowRecoverySource.source;
  }

  if (!selectedSource) {
    const candidateLines = formatCaptureSourceCandidateLines(availableSources);
    const stateSummary = createVisualSnapshotRecoveryStateSummary({
      availableSourceCount: availableSources.length,
      candidateLines,
      mode: 'desktop',
      query,
      sourceId,
      sourceType,
    });

    return {
      errorText: 'No matching screen/window capture source was found.',
      followUp: '没有找到匹配的屏幕或窗口来源。请确认目标窗口没有最小化，或先让我列出可捕获的屏幕/窗口来源再指定。',
      observations: [
        `Requested source type: ${sourceType}`,
        sourceId ? `Requested source id: ${sourceId}` : '',
        query ? `Requested source query: ${query}` : '',
        ...sourceSelectionDiagnostics,
        `Available capture sources: ${availableSources.length}`,
        ...candidateLines,
      ].filter(Boolean),
      ok: false,
      responseText: '没有找到匹配的屏幕或窗口快照来源。',
      stateSummary,
      verification: 'No capture source matched the requested visual snapshot target.',
    };
  }

  const sourceFallbackLine = allowScreenFallback
    && selectedSource.type === 'screen'
    && (sourceId || query)
    && !scoreVisualSnapshotSourceMatch(selectedSource, sourceId || query)
    ? 'Visual source query did not match a window; fell back to a screen source for recovery verification.'
    : '';

  if (!selectedSource.thumbnail) {
    const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
    const candidateLines = formatCaptureSourceCandidateLines(availableSources);
    const stateSummary = createVisualSnapshotRecoveryStateSummary({
      availableSourceCount: availableSources.length,
      candidateLines,
      mode: 'desktop',
      query,
      sourceId,
      sourceLabel,
      sourceType,
      thumbnailUnavailable: true,
    });

    return {
      errorText: 'The selected capture source did not return a thumbnail.',
      followUp: '目标来源存在，但没有返回缩略图。请确认窗口可见、没有被最小化，或改为观察整个屏幕。',
      observations: [
        `Selected visual source: ${sourceLabel}`,
        sourceFallbackLine,
        ...sourceSelectionDiagnostics,
        `Available capture sources: ${availableSources.length}`,
        ...candidateLines,
      ].filter(Boolean),
      ok: false,
      responseText: '找到了屏幕/窗口来源，但没有拿到可用于视觉摘要的缩略图。',
      stateSummary,
      verification: 'Capture source exists, but thumbnail data was unavailable.',
    };
  }

  try {
    const focusedSource = await createTrustedVisualSnapshotSource({
      allowScreenFallback: allowWindowCaptureFallback,
      availableSources,
      selectedSource,
      toolCall,
    });
    const analysisSource = focusedSource.source;
    const sourceLabel = createVisualSnapshotSourceLabel(analysisSource);
    const captureQualityLine = formatAgentCaptureQualityLine(focusedSource.captureQuality, 'Visual capture quality');
    if (!focusedSource.captureQuality.trusted) {
      const stateSummary = {
        missingEvidence: [
          `Visual capture is untrusted: ${focusedSource.captureQuality.status}`,
          focusedSource.captureQuality.reason,
        ],
        observedState: [
          `Visual source: ${sourceLabel}`,
          sourceFallbackLine,
          ...sourceSelectionDiagnostics,
          focusedSource.cropLine,
          focusedSource.captureFallbackLine,
          captureQualityLine,
        ].filter(Boolean),
        recommendedRecovery: [
          'Retry visual observation with a screen source, a different concrete sourceId, or ask the user to bring the target window fully visible.',
          'Do not click or claim the target is selected/current from this untrusted capture.',
        ],
        structuredEvidence: {
          captureFallback: focusedSource.captureFallbackLine
            ? {
                fromSourceId: selectedSource.id,
                fromSourceType: selectedSource.type,
                reason: focusedSource.captureQuality.reason,
                toSourceId: analysisSource.id,
                toSourceType: analysisSource.type,
              }
            : null,
          captureQuality: focusedSource.captureQuality.metrics,
          captureReason: focusedSource.captureQuality.reason,
          captureSourceType: analysisSource.type,
          captureStatus: focusedSource.captureQuality.status,
          captureTrusted: false,
          confidence: 'low',
          status: 'unverified',
          visualActionReadiness: 'not-actionable',
        } satisfies AgentStructuredToolEvidence,
        verificationEvidence: [
          captureQualityLine,
          focusedSource.captureFallbackLine,
        ].filter(Boolean),
      };

      return {
        errorText: `Visual capture is untrusted: ${focusedSource.captureQuality.status}.`,
        followUp: '这次截图证据不可信，我不会按它继续点击或判断。请让目标窗口保持可见，或改用屏幕来源再观察。',
        observations: [
          `Selected visual source: ${sourceLabel}`,
          sourceFallbackLine,
          focusedSource.cropLine,
          focusedSource.captureFallbackLine,
          captureQualityLine,
          `Visual question: ${question}`,
        ].filter(Boolean),
        ok: false,
        receipt: {
          evidenceLines: stateSummary.observedState,
          status: 'unverified',
          stateSummary,
          summaryLines: [
            '调用：summarize_visual_snapshot',
            `来源：${sourceLabel}`,
            `捕获状态：${focusedSource.captureQuality.status}`,
          ],
          title: '执行回执',
          toolName: 'summarize_visual_snapshot',
          verification: 'Visual capture was rejected before model analysis because the screenshot was black or low-information.',
        },
        responseText: [
          `视觉来源：${sourceLabel}`,
          captureQualityLine,
          focusedSource.captureFallbackLine,
          '这次截图不可信，已停止视觉判断。',
        ].filter(Boolean).join('\n'),
        stateSummary,
        verification: 'Visual capture was rejected before model analysis because the screenshot was black or low-information.',
      };
    }

    const summaryResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => summarizeAgentVisualSnapshot({
      imageDataUrl: focusedSource.imageDataUrl,
      question,
      settings: runtime.configRef.current.settings,
      sourceLabel,
    }));
    if (summaryResult.cancelled === true) {
      return summaryResult.result;
    }

    const summary = summaryResult.value;
    const structuredEvidence = createVisualSnapshotStructuredEvidence(
      summary,
      'desktop',
      analysisSource,
      availableSources,
      getToolStringInput(toolCall, ['targetText', 'targetLabel', 'targetDescription', 'target', 'targetElement', 'element', 'description'])
        || question,
      {
        fallbackLine: focusedSource.captureFallbackLine,
        quality: focusedSource.captureQuality,
        selectedSource,
      },
    );
    const observations = [
      `Selected visual source: ${sourceLabel}`,
      sourceFallbackLine,
      ...sourceSelectionDiagnostics,
      `Available capture sources: ${availableSources.length}`,
      focusedSource.cropLine,
      captureQualityLine,
      focusedSource.captureFallbackLine,
      `Visual question: ${question}`,
      ...structuredEvidence.evidenceLines,
    ].filter(Boolean);
    const stateSummary = {
      missingEvidence: structuredEvidence.missingEvidence,
      observedState: [
        `Visual source: ${sourceLabel}`,
        sourceFallbackLine,
        ...sourceSelectionDiagnostics,
        focusedSource.cropLine,
        captureQualityLine,
        focusedSource.captureFallbackLine,
        ...structuredEvidence.observedState,
      ].filter(Boolean),
      recommendedRecovery: structuredEvidence.recommendedRecovery,
      structuredEvidence: structuredEvidence.structuredEvidence,
      verificationEvidence: [
        ...structuredEvidence.verificationEvidence,
        focusedSource.cropLine
          ? 'Visual snapshot analyzed from one cropped focus region of a captured screen/window thumbnail.'
          : 'Visual snapshot analyzed from one captured screen/window thumbnail.',
      ],
    };
    const receiptStatus = structuredEvidence.structuredEvidence?.status === 'success'
      ? 'success'
      : 'unverified';

    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        status: receiptStatus,
        stateSummary,
        summaryLines: [
          '调用：summarize_visual_snapshot',
          `来源：${sourceLabel}`,
          focusedSource.cropLine,
          `摘要：${structuredEvidence.summaryText}`,
        ].filter(Boolean),
        title: '执行回执',
        toolName: 'summarize_visual_snapshot',
        verification: focusedSource.cropLine
          ? 'Captured one focused crop from a screen/window thumbnail and summarized it with the configured vision-capable model.'
          : 'Captured one screen/window thumbnail and summarized it with the configured vision-capable model.',
      },
      responseText: [
        `视觉来源：${sourceLabel}`,
        focusedSource.cropLine,
        structuredEvidence.responseText,
      ].filter(Boolean).join('\n'),
      stateSummary,
      verification: focusedSource.cropLine
        ? '视觉摘要来自一次屏幕/窗口缩略图的局部裁剪和模型摘要；原始图片没有写入 Agent 循环历史。'
        : '视觉摘要来自一次屏幕/窗口缩略图捕获和模型摘要；原始图片没有写入 Agent 循环历史。',
    };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
    const stateSummary = createVisualSnapshotRecoveryStateSummary({
      availableSourceCount: availableSources.length,
      errorText,
      mode: 'desktop',
      query,
      sourceId,
      sourceLabel,
      sourceType,
    });

    return {
      errorText,
      followUp: '视觉模型已经收到截图但摘要失败。请检查视觉模型是否支持图片输入、API 地址/Key/模型名是否正确，或稍后重试。',
      observations: [
        `Selected visual source: ${sourceLabel}`,
        sourceFallbackLine,
        `Visual question: ${question}`,
        `Vision summary error: ${errorText}`,
      ].filter(Boolean),
      ok: false,
      responseText: `视觉快照已经捕获，但模型摘要失败：${errorText}`,
      stateSummary,
      verification: errorText,
    };
  }
}

export async function executeAnalyzeGameScreen(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  sourceText: string,
): Promise<AgentChatCommandResult> {
  const sourceType = normalizeVisualSnapshotSourceTypeInput(
    getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'all',
  );
  const captureSourceTypes = normalizeCaptureSourceTypesInput(sourceType);
  const sourceId = getToolStringInput(toolCall, ['sourceId', 'id']);
  const query = getToolStringInput(toolCall, ['query', 'target', 'sourceName', 'name', 'windowTitle', 'title']);
  const allowScreenFallback = getToolBooleanInputAny(toolCall, [
    'allowScreenFallback',
    'fallbackToScreen',
    'allowSourceFallback',
  ]) !== false;
  const captureRequestSourceTypes = allowScreenFallback && !captureSourceTypes.includes('screen')
    ? Array.from(new Set([...captureSourceTypes, 'screen'])) as Array<'screen' | 'window'>
    : captureSourceTypes;
  const question = getToolStringInput(toolCall, ['question', 'goal', 'prompt'])
    || toolCall.goal
    || sourceText
    || 'Analyze the visible gameplay content in this snapshot.';
  const gameHint = getToolStringInput(toolCall, ['gameHint', 'gameName', 'game']);
  const focus = getToolStringInput(toolCall, ['focus', 'analysisFocus', 'topic']);
  const captureResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes: captureRequestSourceTypes,
    forceRefresh: getToolBooleanInput(toolCall, 'forceRefresh') === true,
    includeCaptureThumbnails: true,
  }) as Promise<DesktopPetCaptureSourceLike[]>);
  if (captureResult.cancelled === true) {
    return captureResult.result;
  }

  const sources = captureResult.value;
  const availableSources = Array.isArray(sources) ? sources : [];
  const selectedSource = selectGameScreenSource(availableSources, {
    query,
    sourceId,
    sourceType,
  });

  if (!selectedSource) {
    const candidateLines = formatCaptureSourceCandidateLines(availableSources);
    const stateSummary = createVisualSnapshotRecoveryStateSummary({
      availableSourceCount: availableSources.length,
      candidateLines,
      mode: 'game',
      query,
      sourceId,
      sourceType,
    });

    return {
      errorText: 'No matching game screen/window capture source was found.',
      followUp: '没有找到匹配的游戏屏幕或窗口来源。请确认游戏窗口没有最小化，或先让我列出可捕获来源再选择。',
      observations: [
        `Requested game source type: ${sourceType}`,
        sourceId ? `Requested source id: ${sourceId}` : '',
        query ? `Requested source query: ${query}` : '',
        `Available capture sources: ${availableSources.length}`,
        ...candidateLines,
      ].filter(Boolean),
      ok: false,
      responseText: 'No matching game screen/window capture source was found.',
      stateSummary,
      verification: 'No capture source matched the requested game screen target.',
    };
  }

  if (!selectedSource.thumbnail) {
    const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
    const candidateLines = formatCaptureSourceCandidateLines(availableSources);
    const stateSummary = createVisualSnapshotRecoveryStateSummary({
      availableSourceCount: availableSources.length,
      candidateLines,
      mode: 'game',
      query,
      sourceId,
      sourceLabel,
      sourceType,
      thumbnailUnavailable: true,
    });

    return {
      errorText: 'The selected game capture source did not return a thumbnail.',
      followUp: '游戏来源存在，但没有返回缩略图。请确认游戏窗口可见、没有被最小化，或改为观察整个屏幕。',
      observations: [
        `Selected game source: ${sourceLabel}`,
        `Available capture sources: ${availableSources.length}`,
        ...candidateLines,
      ],
      ok: false,
      responseText: 'The game source was found, but no thumbnail was available for visual analysis.',
      stateSummary,
      verification: 'Capture source exists, but thumbnail data was unavailable.',
    };
  }

  try {
    const preparedSource = await createTrustedVisualSnapshotSource({
      allowScreenFallback,
      availableSources,
      selectedSource,
      toolCall,
    });
    const analysisSource = preparedSource.source;
    const sourceLabel = createVisualSnapshotSourceLabel(analysisSource);
    const captureQualityLine = formatAgentCaptureQualityLine(preparedSource.captureQuality, 'Game capture quality');
    if (!preparedSource.captureQuality.trusted) {
      const stateSummary = {
        missingEvidence: [
          `Game capture is untrusted: ${preparedSource.captureQuality.status}`,
          preparedSource.captureQuality.reason,
        ],
        observedState: [
          `Game source: ${sourceLabel}`,
          preparedSource.cropLine,
          preparedSource.captureFallbackLine,
          captureQualityLine,
        ].filter(Boolean),
        recommendedRecovery: [
          'Retry game analysis with a visible screen source/window source before summarizing gameplay.',
          'Do not claim what is happening in the game from this untrusted capture.',
        ],
        structuredEvidence: {
          captureFallback: preparedSource.captureFallbackLine
            ? {
                fromSourceId: selectedSource.id,
                fromSourceType: selectedSource.type,
                reason: preparedSource.captureQuality.reason,
                toSourceId: analysisSource.id,
                toSourceType: analysisSource.type,
              }
            : null,
          captureQuality: preparedSource.captureQuality.metrics,
          captureReason: preparedSource.captureQuality.reason,
          captureSourceType: analysisSource.type,
          captureStatus: preparedSource.captureQuality.status,
          captureTrusted: false,
          confidence: 'low',
          status: 'unverified',
          visualActionReadiness: 'not-actionable',
        } satisfies AgentStructuredToolEvidence,
        verificationEvidence: [
          captureQualityLine,
          preparedSource.captureFallbackLine,
        ].filter(Boolean),
      };

      return {
        errorText: `Game capture is untrusted: ${preparedSource.captureQuality.status}.`,
        followUp: '这次游戏画面截图不可信，我不会硬总结。请保持游戏窗口可见，或改用屏幕来源再分析。',
        observations: [
          `Selected game source: ${sourceLabel}`,
          preparedSource.cropLine,
          preparedSource.captureFallbackLine,
          captureQualityLine,
          `Game analysis question: ${question}`,
        ].filter(Boolean),
        ok: false,
        receipt: {
          evidenceLines: stateSummary.observedState,
          status: 'unverified',
          stateSummary,
          summaryLines: [
            'Call: analyze_game_screen',
            `Source: ${sourceLabel}`,
            `Capture status: ${preparedSource.captureQuality.status}`,
          ],
          title: '执行回执',
          toolName: 'analyze_game_screen',
          verification: 'Game capture was rejected before model analysis because the screenshot was black or low-information.',
        },
        responseText: [
          `Game source: ${sourceLabel}`,
          captureQualityLine,
          preparedSource.captureFallbackLine,
          'This game capture is untrusted, so no gameplay summary was produced.',
        ].filter(Boolean).join('\n'),
        stateSummary,
        verification: 'Game capture was rejected before model analysis because the screenshot was black or low-information.',
      };
    }

    const analysisResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => analyzeAgentGameSnapshot({
      focus,
      gameHint,
      imageDataUrl: preparedSource.imageDataUrl,
      question,
      settings: runtime.configRef.current.settings,
      sourceLabel,
    }));
    if (analysisResult.cancelled === true) {
      return analysisResult.result;
    }

    const analysis = analysisResult.value;
    const structuredEvidence = createVisualSnapshotStructuredEvidence(analysis, 'game', analysisSource, availableSources, '', {
      fallbackLine: preparedSource.captureFallbackLine,
      quality: preparedSource.captureQuality,
      selectedSource,
    });
    const observations = [
      `Selected game source: ${sourceLabel}`,
      `Available capture sources: ${availableSources.length}`,
      preparedSource.cropLine,
      captureQualityLine,
      preparedSource.captureFallbackLine,
      gameHint ? `Game hint: ${gameHint}` : '',
      focus ? `Analysis focus: ${focus}` : '',
      `Game analysis question: ${question}`,
      ...structuredEvidence.evidenceLines,
    ].filter(Boolean);
    const stateSummary = {
      missingEvidence: structuredEvidence.missingEvidence,
      observedState: [
        `Game source: ${sourceLabel}`,
        preparedSource.cropLine,
        captureQualityLine,
        preparedSource.captureFallbackLine,
        ...structuredEvidence.observedState,
      ].filter(Boolean),
      recommendedRecovery: structuredEvidence.recommendedRecovery,
      verificationEvidence: [
        ...structuredEvidence.verificationEvidence,
        preparedSource.cropLine
          ? 'Game snapshot analyzed from one cropped focus/fallback region of a captured screen/window thumbnail.'
          : 'Game snapshot analyzed from one captured screen/window thumbnail.',
      ],
    };

    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        status: 'success',
        stateSummary,
        summaryLines: [
          'Call: analyze_game_screen',
          `Source: ${sourceLabel}`,
          `Analysis: ${structuredEvidence.summaryText}`,
        ],
        title: '执行回执',
        toolName: 'analyze_game_screen',
        verification: 'Captured one game screen/window thumbnail and analyzed it with the configured vision-capable model.',
      },
      responseText: [
        `Game source: ${sourceLabel}`,
        structuredEvidence.responseText,
      ].join('\n'),
      stateSummary,
      verification: 'Game analysis came from one captured screen/window thumbnail. Raw image data was not stored in AgentSessionV2 history.',
    };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
    const stateSummary = createVisualSnapshotRecoveryStateSummary({
      availableSourceCount: availableSources.length,
      errorText,
      mode: 'game',
      query,
      sourceId,
      sourceLabel,
      sourceType,
    });

    return {
      errorText,
      followUp: '游戏截图已经捕获，但视觉模型分析失败。请检查视觉模型是否支持图片输入、API 地址/Key/模型名是否正确，或稍后重试。',
      observations: [
        `Selected game source: ${sourceLabel}`,
        `Game analysis question: ${question}`,
        `Game analysis error: ${errorText}`,
      ],
      ok: false,
      responseText: `The game snapshot was captured, but model analysis failed: ${errorText}`,
      stateSummary,
      verification: errorText,
    };
  }
}

export async function executeManageGameCompanionLoop(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const controller = runtime.gameCompanionLoopControllerRef?.current ?? null;
  if (!controller) {
    return {
      errorText: '游戏陪伴循环控制器还没有准备好。',
      ok: false,
      responseText: '游戏陪伴循环还没有准备好，请稍后再试。',
      verification: 'Game companion loop controller is unavailable.',
    };
  }

  const action = getToolStringInput(toolCall, ['action', 'mode', 'operation']) || 'status';
  if (action === 'stop') {
    const stopResult = await runCancellableAgentRuntimeTask(runtime, toolCall, async () => controller.stop());
    return stopResult.cancelled === true ? stopResult.result : stopResult.value;
  }

  if (action === 'status') {
    const statusResult = await runCancellableAgentRuntimeTask(runtime, toolCall, async () => controller.status());
    return statusResult.cancelled === true ? statusResult.result : statusResult.value;
  }

  if (action !== 'start') {
    return {
      errorText: `Unsupported game companion loop action: ${action}`,
      ok: false,
      responseText: '游戏陪伴循环只支持 start、stop、status。',
    };
  }

  const stopCompanionLoopOnAbort = () => {
    void controller.stop();
  };
  let removeAbortListener: (() => void) | null = null;
  if (runtime.signal) {
    if (runtime.signal.aborted) {
      return createAgentRuntimeCancelledResult(toolCall);
    }

    runtime.signal.addEventListener('abort', stopCompanionLoopOnAbort, { once: true });
    removeAbortListener = () => runtime.signal?.removeEventListener('abort', stopCompanionLoopOnAbort);
  }

  try {
    const startResult = await runCancellableAgentRuntimeTask(runtime, toolCall, async () => controller.start({
      focus: getToolStringInput(toolCall, ['focus', 'analysisFocus', 'topic']),
      gameHint: getToolStringInput(toolCall, ['gameHint', 'gameName', 'game']),
      intervalMs: getToolNumberInput(toolCall, 'intervalMs') ?? getToolNumberInput(toolCall, 'sampleEveryMs'),
      maxSamples: getToolNumberInput(toolCall, 'maxSamples'),
      minCommentIntervalMs: getToolNumberInput(toolCall, 'minCommentIntervalMs') ?? getToolNumberInput(toolCall, 'commentCooldownMs'),
      query: getToolStringInput(toolCall, ['query', 'target', 'sourceName', 'name', 'windowTitle', 'title']),
      sourceId: getToolStringInput(toolCall, ['sourceId', 'id']),
      sourceType: normalizeVisualSnapshotSourceTypeInput(
        getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'window',
      ),
    }));
    return startResult.cancelled === true ? startResult.result : startResult.value;
  } finally {
    removeAbortListener?.();
  }
}

function isLocateScreenElementsActionTargetRequest(text: string) {
  return /启动|打开|开始|运行|进入|播放|主按钮|主操作|按钮|launch|start|open|play|primary action|button/iu.test(text);
}

function enrichLocateScreenElementsMissingPrimaryAction(options: {
  action: string;
  question: string;
  result: AgentChatCommandResult;
  sourceQuery: string;
  targetLabel: string;
}) {
  const { action, question, result, sourceQuery, targetLabel } = options;
  if (result.ok === false || !targetLabel) {
    return result;
  }

  const structuredEvidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const evidenceText = [
    action,
    question,
    sourceQuery,
    targetLabel,
    result.responseText,
    result.observations?.join('\n'),
    result.stateSummary?.observedState?.join('\n'),
    result.stateSummary?.missingEvidence?.join('\n'),
  ].filter(Boolean).join('\n');
  const targetAppearsMatched = Boolean(structuredEvidence?.targetMatched)
    || normalizeAgentRuntimeVisualLookupText(evidenceText).includes(normalizeAgentRuntimeVisualLookupText(targetLabel));
  const requestNeedsPrimaryAction = isLocateScreenElementsActionTargetRequest(evidenceText);
  const primaryActionUseful = isVisualSnapshotPrimaryActionUseful(structuredEvidence?.primaryAction);
  const primaryActionMissing = !primaryActionUseful
    || isVisualSnapshotPrimaryActionMissingText(evidenceText);
  const hasScreenCoordinate = Boolean(structuredEvidence?.elementCenter || structuredEvidence?.elementBounds);
  const coordinateMissing = primaryActionUseful && !hasScreenCoordinate;
  const relationRequired = isVisualSnapshotTargetActionRelationNeeded(
    structuredEvidence?.targetMatched || targetLabel,
    structuredEvidence?.primaryAction || '',
  );
  const relationMissing = primaryActionUseful
    && hasScreenCoordinate
    && relationRequired
    && !isVisualSnapshotTextUseful(structuredEvidence?.relation);

  if (
    !requestNeedsPrimaryAction
    || !targetAppearsMatched
    || (!primaryActionMissing && !coordinateMissing && !relationMissing)
  ) {
    return result;
  }

  const readiness: AgentStructuredToolEvidence['visualActionReadiness'] = primaryActionMissing
    ? 'needs-primary-action'
    : coordinateMissing
      ? 'needs-coordinate'
      : 'needs-relation';
  const missingEvidence = [
    ...(result.stateSummary?.missingEvidence ?? []),
    primaryActionMissing
      ? 'locate_screen_elements did not identify a clear primary action button for the requested in-app target.'
      : '',
    primaryActionMissing
      ? 'The target item may be visible in a sidebar/list, but the current page may not be the target detail/action page.'
      : '',
    coordinateMissing
      ? 'locate_screen_elements identified a primary action, but did not resolve a usable native-screen coordinate or elementBounds for safe input.'
      : '',
    relationMissing
      ? 'locate_screen_elements did not clearly verify that the primary action belongs to the matched target.'
      : '',
  ];
  const recommendedRecovery = [
    ...(result.stateSummary?.recommendedRecovery ?? []),
    primaryActionMissing
      ? 'If the target item/menu entry has an approximate region, select or click that target item first, then rerun locate_screen_elements with forceRefresh: true.'
      : '',
    primaryActionMissing
      ? 'If the visible page is a store/recommendation/list page, navigate to the target detail/library page before looking for the launch/open/start button.'
      : '',
    coordinateMissing
      ? 'Rerun locate_screen_elements with forceRefresh: true and request elementCenterRatio or elementCenter for the primary action.'
      : '',
    coordinateMissing
      ? 'If the capture source has no bounds, call list_capture_sources or inspect the active window before converting visual location to input coordinates.'
      : '',
    relationMissing
      ? 'Rerun locate_screen_elements and ask it to state whether the primary action is visually associated with the matched target.'
      : '',
    'tool:locate_screen_elements',
    'tool:execute_desktop_input',
    'tool:execute_desktop_observation',
  ].filter(Boolean);
  const nextStructuredEvidence: AgentStructuredToolEvidence = {
    ...(structuredEvidence ?? {}),
    confidence: structuredEvidence?.confidence === 'high' ? 'medium' : structuredEvidence?.confidence ?? 'low',
    primaryAction: structuredEvidence?.primaryAction || null,
    status: 'unverified',
    targetMatched: structuredEvidence?.targetMatched || targetLabel,
    visualActionReadiness: readiness,
  };
  const nextStateSummary = {
    ...(result.stateSummary ?? {}),
    missingEvidence: [...new Set(missingEvidence.filter(Boolean))],
    recommendedRecovery: [...new Set(recommendedRecovery)],
    structuredEvidence: nextStructuredEvidence,
  };

  return {
    ...result,
    followUp: result.followUp
      || (primaryActionMissing
        ? '已看到目标线索，但还没有确认到对应的启动/打开按钮。需要先选择目标项或刷新目标页后再定位按钮。'
        : coordinateMissing
          ? '已看到目标和操作按钮，但还没有能安全点击的屏幕坐标。需要重新定位按钮坐标。'
          : '已看到目标和操作按钮，但还没有确认按钮确实属于这个目标。需要重新观察目标和按钮关系。'),
    receipt: result.receipt
      ? {
          ...result.receipt,
          status: 'unverified' as const,
          stateSummary: nextStateSummary,
          verification: primaryActionMissing
            ? 'locate_screen_elements found target evidence but did not verify a clear primary action button.'
            : coordinateMissing
              ? 'locate_screen_elements found target/action evidence but did not verify a usable input coordinate.'
              : 'locate_screen_elements found target/action evidence but did not verify their visual relation.',
        }
      : result.receipt,
    stateSummary: nextStateSummary,
    verification: primaryActionMissing
      ? 'locate_screen_elements found target evidence but did not verify a clear primary action button.'
      : coordinateMissing
        ? 'locate_screen_elements found target/action evidence but did not verify a usable input coordinate.'
        : 'locate_screen_elements found target/action evidence but did not verify their visual relation.',
  };
}

export async function executeLocateScreenElements(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  sourceText: string,
): Promise<AgentChatCommandResult> {
  const action = getToolStringInput(toolCall, ['action', 'visionAction', 'operation']) || 'describe_elements';
  const sourceQuery = getToolStringInput(toolCall, ['sourceQuery', 'windowQuery', 'windowTitle', 'sourceName']);
  const targetText = getToolStringInput(toolCall, ['targetText', 'text', 'label']);
  const targetDescription = getToolStringInput(toolCall, ['targetDescription', 'target', 'targetElement', 'element', 'description']);
  const rawQuery = getToolStringInput(toolCall, ['query']);
  const sourceType = normalizeVisualSnapshotSourceTypeInput(
    getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'all',
  );
  const sourceId = getToolStringInput(toolCall, ['sourceId', 'id']);
  const recoveryReadPurpose = getToolStringInput(toolCall, ['recoveryReadPurpose', 'recoveryPurpose']);
  const explicitScreenFallback = getToolBooleanInputAny(toolCall, [
    'allowScreenFallback',
    'fallbackToScreen',
    'allowSourceFallback',
  ]);
  const targetLabel = targetText || targetDescription || (!sourceQuery ? rawQuery : '');
  const queryLooksLikeTarget = Boolean(
    rawQuery
    && targetLabel
    && normalizeAgentRuntimeVisualLookupText(rawQuery) === normalizeAgentRuntimeVisualLookupText(targetLabel),
  );
  const delegatedSourceQuery = sourceQuery || (!queryLooksLikeTarget ? rawQuery : '');
  const hasExplicitSource = Boolean(sourceId || delegatedSourceQuery);
  const allowScreenFallback = explicitScreenFallback === true
    || (
      !hasExplicitSource
      && Boolean(recoveryReadPurpose)
    )
    || (
      !hasExplicitSource
      && (sourceType === 'all' || sourceType === 'window')
      && explicitScreenFallback !== false
    );
  const question = getToolStringInput(toolCall, ['question', 'goal', 'prompt'])
    || [
      `Task: ${action}.`,
      delegatedSourceQuery ? `Outer app/window source to inspect: ${delegatedSourceQuery}.` : '',
      targetLabel ? `Target text or element inside the source: ${targetLabel}.` : '',
      'Read visible text with an OCR-style pass and describe approximate locations of relevant UI/screen elements.',
      'If this is an in-app or launcher task, identify the target item and the primary open/start/play/launch button associated with that target, then state the visual relation between them.',
      'Core action evidence fields: targetMatched, primaryAction, elementRegion, relation, confidence.',
      'Return concise evidence with readableText, visibleTextCandidates, targetMatched, targetCandidates, primaryAction, actionCandidates, elementRegion, elementCenterRatio, relation, confidence, and uncertainty when possible.',
      'For candidate objects, include label/text, confidence, region, centerRatio or bounds when visible. If coordinates are uncertain, say approximate instead of guessing precisely.',
    ].filter(Boolean).join(' ');
  const delegatedInput: Record<string, unknown> = {
    ...toolCall.input,
    question,
    query: delegatedSourceQuery,
    sourceType,
  };
  if (explicitScreenFallback !== undefined || recoveryReadPurpose || sourceType === 'all' || sourceType === 'window') {
    delegatedInput.allowScreenFallback = allowScreenFallback;
  }

  const delegatedToolCall: AgentToolCallCommand = {
    ...toolCall,
    input: delegatedInput,
    name: 'summarize_visual_snapshot',
  };
  const result = await executeSummarizeVisualSnapshot(runtime, delegatedToolCall, sourceText);
  const enrichedResult = enrichLocateScreenElementsMissingPrimaryAction({
    action,
    question,
    result,
    sourceQuery: delegatedSourceQuery,
    targetLabel,
  });
  const observations = [
    `Screen element locate action: ${action}`,
    delegatedSourceQuery ? `Source query: ${delegatedSourceQuery}` : '',
    targetLabel ? `Target element: ${targetLabel}` : '',
    ...(enrichedResult.observations ?? []),
  ].filter(Boolean);

  return {
    ...enrichedResult,
    observations,
    receipt: enrichedResult.receipt
      ? {
          ...enrichedResult.receipt,
          evidenceLines: observations,
          summaryLines: [
            'Call: locate_screen_elements',
            `Action: ${action}`,
            ...(enrichedResult.receipt.summaryLines ?? []).slice(1),
          ],
          toolName: 'locate_screen_elements',
        }
      : enrichedResult.receipt,
    responseText: enrichedResult.ok === false
      ? enrichedResult.responseText
      : [
          `Screen element observation (${action}):`,
          enrichedResult.responseText,
          'Note: v1 visual locations are approximate and should be confirmed before desktop input.',
        ].join('\n'),
    verification: enrichedResult.verification
      ? `${enrichedResult.verification} locate_screen_elements used the configured vision snapshot path.`
      : 'locate_screen_elements used the configured vision snapshot path.',
  };
}

