import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  type AgentChatCommandResult,
  type AgentRuntimeGameCompanionLoopController,
  type AgentRuntimeGameCompanionLoopStartOptions,
} from '../../agent';
import { DEFAULT_CHAT_ACTIVE_PET_ID } from '../../chatState';
import { desktopPetChatStore } from '../../chatStore';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { getDesktopPetSlot } from '../../multiPetRoster';
import { analyzeAgentGameSnapshot, getPetResponseStrict } from '../../services/geminiService';
import { type PetConfig } from '../../types';
import { createChatMessageId } from '../chat/multiPetChat';
import {
  DEFAULT_GAME_COMPANION_OBSERVATION_INTERVAL_MS,
  MAX_GAME_COMPANION_OBSERVATION_INTERVAL_MS,
  MIN_GAME_COMPANION_OBSERVATION_INTERVAL_MS,
} from '../../gameCompanionSettings';
import { getGameCompanionObservationTrustIssue } from './gameCompanionObservationTrust';

const DEFAULT_GAME_COMPANION_INTERVAL_MS = DEFAULT_GAME_COMPANION_OBSERVATION_INTERVAL_MS;
const DEFAULT_GAME_COMPANION_COMMENT_INTERVAL_MS = 18000;
const DEFAULT_GAME_COMPANION_MAX_SAMPLES = 30;
const FIRST_FRAME_AGENT_RESULT_TIMEOUT_MS = 12000;
const GAME_COMPANION_PENDING_REPLY_RECHECK_MS = 2500;
const GAME_COMPANION_UNCERTAIN_RETRY_INTERVAL_MS = 1200;
const MAX_CONSECUTIVE_GAME_COMPANION_CAPTURE_FAILURES = 4;
const MIN_GAME_COMPANION_INTERVAL_MS = MIN_GAME_COMPANION_OBSERVATION_INTERVAL_MS;
const MAX_GAME_COMPANION_INTERVAL_MS = MAX_GAME_COMPANION_OBSERVATION_INTERVAL_MS;
const MIN_GAME_COMPANION_COMMENT_INTERVAL_MS = 5000;
const MAX_GAME_COMPANION_COMMENT_INTERVAL_MS = 180000;
const MIN_GAME_COMPANION_MAX_SAMPLES = 1;
const MAX_GAME_COMPANION_MAX_SAMPLES = 240;

type GameCompanionSourceType = 'screen' | 'window' | 'all';

interface ParsedGameAnalysis {
  companionCue?: string | null;
  confidence?: number | null;
  detectedGameOrGenre?: string | null;
  gameIdentityEvidence?: string | null;
  hasStructuredOutput: boolean;
  hud?: string | null;
  playerState?: string | null;
  sceneState?: string | null;
  summary?: string | null;
  uncertainty?: string[] | null;
  visibleText?: string[] | null;
}

export type GameCompanionSourceCheckStatus = 'idle' | 'checking' | 'ready' | 'uncertain' | 'error';
type FirstFrameToolResultResolver = (result: AgentChatCommandResult) => void;

interface GameCompanionLoopRuntimeState {
  commentCount: number;
  consecutiveErrorCount: number;
  detectedGameOrGenre: string | null;
  firstFrameResultResolvers: FirstFrameToolResultResolver[];
  firstFrameResultSettled: boolean;
  focus: string | null;
  gameHint: string | null;
  gameIdentityEvidence: string | null;
  intervalMs: number;
  isTicking: boolean;
  lastCommentAt: number;
  lastObservationSummary: string | null;
  lastSignature: string;
  lockedSourceId: string | null;
  lockedSourceLabel: string | null;
  maxSamples: number;
  minCommentIntervalMs: number;
  observationRevision: number;
  pendingCompanionReplyRevision: number | null;
  query: string | null;
  running: boolean;
  sampleCount: number;
  sourceCheckMessage: string | null;
  sourceCheckStatus: GameCompanionSourceCheckStatus;
  sourceConfidence: number | null;
  sourceId: string | null;
  sourceType: GameCompanionSourceType;
  sourceUncertainty: string[];
  startedAt: number;
  timerId: number | null;
}

export interface GameCompanionLoopStatusSnapshot {
  commentCount: number;
  detectedGameOrGenre: string | null;
  gameIdentityEvidence: string | null;
  intervalMs: number;
  isTicking: boolean;
  lastObservationSummary: string | null;
  lastUpdatedAt: number;
  lockedSourceLabel: string | null;
  maxSamples: number;
  query: string | null;
  running: boolean;
  sampleCount: number;
  sourceCheckMessage: string | null;
  sourceCheckStatus: GameCompanionSourceCheckStatus;
  sourceConfidence: number | null;
  sourceType: GameCompanionSourceType;
  sourceUncertainty: string[];
  startedAt: number | null;
  stopReason: string | null;
}

export interface GameCompanionSourcePreference {
  sourceId: string;
  sourceLabel: string;
  sourceType: Exclude<GameCompanionSourceType, 'all'>;
}

interface UseGameCompanionLoopControllerOptions {
  addLog: (message: string) => void;
  configRef: MutableRefObject<PetConfig>;
  onStatusChange?: (status: GameCompanionLoopStatusSnapshot) => void;
  preferredSourceRef?: MutableRefObject<GameCompanionSourcePreference | null>;
}

export const STOPPED_GAME_COMPANION_LOOP_STATUS: GameCompanionLoopStatusSnapshot = {
  commentCount: 0,
  detectedGameOrGenre: null,
  gameIdentityEvidence: null,
  intervalMs: DEFAULT_GAME_COMPANION_INTERVAL_MS,
  isTicking: false,
  lastObservationSummary: null,
  lastUpdatedAt: 0,
  lockedSourceLabel: null,
  maxSamples: DEFAULT_GAME_COMPANION_MAX_SAMPLES,
  query: null,
  running: false,
  sampleCount: 0,
  sourceCheckMessage: null,
  sourceCheckStatus: 'idle',
  sourceConfidence: null,
  sourceType: 'window',
  sourceUncertainty: [],
  startedAt: null,
  stopReason: null,
};

function clampNumber(value: number | null | undefined, fallback: number, min: number, max: number) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(nextValue)));
}

function normalizeSourceType(value?: AgentRuntimeGameCompanionLoopStartOptions['sourceType']): GameCompanionSourceType {
  return value === 'screen' || value === 'window' || value === 'all' ? value : 'window';
}

function normalizeMatchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
}

function normalizeCompactMatchText(value: unknown) {
  return normalizeMatchText(value)
    .replace(/[\s"'`“”‘’_\-:：;；,，.。|/\\()[\]{}<>《》]+/gu, '');
}

function createSourceLabel(source: DesktopPetCaptureSourceLike) {
  const sizeText = source.width && source.height ? `${source.width}x${source.height}` : 'unknown-size';
  const displayText = source.displayId ? ` display=${source.displayId}` : '';
  return `[${source.type}] ${source.name} ${sizeText}${displayText}`;
}

function createQueryTokens(query: string) {
  return normalizeMatchText(query)
    .split(/[\s"'`“”‘’_\-:：;；,，.。|/\\()[\]{}<>《》]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function doesSourceMatchQuery(source: DesktopPetCaptureSourceLike, query: string) {
  const compactQuery = normalizeCompactMatchText(query);
  const compactSource = normalizeCompactMatchText(`${source.name} ${source.id ?? ''} ${source.displayId ?? ''}`);
  if (compactQuery && compactSource.includes(compactQuery)) {
    return true;
  }

  const tokens = createQueryTokens(query);
  return tokens.length > 0 && tokens.every((token) => compactSource.includes(normalizeCompactMatchText(token)));
}

function filterSourcesByType(sources: DesktopPetCaptureSourceLike[], sourceType: GameCompanionSourceType) {
  return sourceType === 'all'
    ? sources
    : sources.filter((source) => source.type === sourceType);
}

function selectGameCompanionSource(options: {
  query?: string | null;
  sourceId?: string | null;
  sources: DesktopPetCaptureSourceLike[];
  sourceType: GameCompanionSourceType;
}) {
  const typedSources = filterSourcesByType(options.sources, options.sourceType);
  const exactSourceId = options.sourceId?.trim();
  if (exactSourceId) {
    return typedSources.find((source) => source.id === exactSourceId) ?? null;
  }

  const query = options.query?.trim();
  if (query) {
    return typedSources.find((source) => source.thumbnail && doesSourceMatchQuery(source, query))
      ?? typedSources.find((source) => doesSourceMatchQuery(source, query))
      ?? null;
  }

  return typedSources.find((source) => source.thumbnail)
    ?? typedSources[0]
    ?? null;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function parseConfidence(value: unknown) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) {
    return null;
  }

  return Math.max(0, Math.min(1, confidence));
}

function tryParseGameAnalysis(rawText: string): ParsedGameAnalysis {
  const normalizedText = rawText.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
  const startIndex = normalizedText.indexOf('{');
  const endIndex = normalizedText.lastIndexOf('}');
  const jsonText = startIndex >= 0 && endIndex > startIndex
    ? normalizedText.slice(startIndex, endIndex + 1)
    : normalizedText;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      companionCue: typeof parsed.companionCue === 'string' ? parsed.companionCue : null,
      confidence: parseConfidence(parsed.confidence),
      hasStructuredOutput: true,
      detectedGameOrGenre: typeof parsed.detectedGameOrGenre === 'string' ? parsed.detectedGameOrGenre : null,
      gameIdentityEvidence: typeof parsed.gameIdentityEvidence === 'string' ? parsed.gameIdentityEvidence : null,
      hud: typeof parsed.hud === 'string' ? parsed.hud : null,
      playerState: typeof parsed.playerState === 'string' ? parsed.playerState : null,
      sceneState: typeof parsed.sceneState === 'string' ? parsed.sceneState : null,
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      uncertainty: parseStringArray(parsed.uncertainty),
      visibleText: parseStringArray(parsed.visibleText),
    };
  } catch {
    return {
      companionCue: null,
      confidence: null,
      detectedGameOrGenre: null,
      hasStructuredOutput: false,
      gameIdentityEvidence: null,
      summary: rawText,
      uncertainty: [],
      visibleText: [],
    };
  }
}

function compactCompanionText(text?: string | null, maxLength = 96) {
  const normalizedText = text?.replace(/\s+/gu, ' ').trim() ?? '';
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function createObservationSignature(analysis: ParsedGameAnalysis) {
  return [
    analysis.detectedGameOrGenre,
    analysis.summary,
    analysis.sceneState,
    analysis.playerState,
    analysis.hud,
    ...(analysis.visibleText ?? []),
  ]
    .filter(Boolean)
    .join('|')
    .replace(/\s+/gu, '')
    .toLowerCase();
}

function createCompanionComment(analysis: ParsedGameAnalysis) {
  return compactCompanionText(
    analysis.companionCue
      || analysis.summary
      || analysis.sceneState
      || analysis.playerState
      || '我看到了游戏画面，但这次细节不太清楚。',
  );
}

function createCompanionReplyPrompt(analysis: ParsedGameAnalysis, gameContext = '') {
  const evidence = [
    analysis.detectedGameOrGenre ? `游戏或类型：${analysis.detectedGameOrGenre}` : '',
    analysis.sceneState ? `场景：${analysis.sceneState}` : '',
    analysis.playerState ? `玩家状态：${analysis.playerState}` : '',
    analysis.hud ? `界面信息：${analysis.hud}` : '',
    analysis.visibleText?.length ? `可见文字：${analysis.visibleText.join('、')}` : '',
    analysis.uncertainty?.length ? `不确定处：${analysis.uncertainty.join('、')}` : '',
    gameContext ? `用户提供的游戏资料：${gameContext}` : '',
  ].filter(Boolean).join('\n');

  return [
    '刚刚完成了一次游戏画面观察。请根据下面的观察结果，结合当前角色人格和聊天历史，自然地对用户说一句陪玩回应。',
    '只输出角色要说的话，不要提到视觉模型、分析结果、JSON、提示词或触发机制。保持角色原本的语气，可以简短评论、鼓励或询问，但不要编造看不见的细节。',
    evidence || '这次画面细节不充分，请用角色口吻做一句克制的回应。',
  ].join('\n');
}

async function generateCompanionReply(
  analysis: ParsedGameAnalysis,
  configRef: MutableRefObject<PetConfig>,
) {
  const chatState = desktopPetChatStore.getState();
  const petId = chatState.activePetId || DEFAULT_CHAT_ACTIVE_PET_ID;
  const slot = getDesktopPetSlot(configRef.current, petId)
    ?? getDesktopPetSlot(configRef.current, DEFAULT_CHAT_ACTIVE_PET_ID);
  if (!slot) {
    return createCompanionComment(analysis);
  }

  try {
    const gameContext = [
      configRef.current.settings.gameCompanionGameName,
      configRef.current.settings.gameCompanionGameDescription,
    ].filter((value) => value?.trim()).join('；');
    const reply = await getPetResponseStrict(
      chatState.messages,
      createCompanionReplyPrompt(analysis, gameContext),
      slot.personality,
      configRef.current.settings,
      'allow',
    );
    return reply || createCompanionComment(analysis);
  } catch {
    return createCompanionComment(analysis);
  }
}

function createObservationStatusSummary(analysis: ParsedGameAnalysis) {
  return compactCompanionText([
    analysis.detectedGameOrGenre,
    analysis.sceneState || analysis.summary,
    analysis.playerState,
    analysis.hud,
  ].filter(Boolean).join(' · '), 120);
}

function isDesktopPetWindowInfo(windowInfo: { processName?: string; title?: string } | null) {
  const text = `${windowInfo?.title ?? ''} ${windowInfo?.processName ?? ''}`.toLowerCase();
  return text.includes('ai desktop pet') || text.includes('desktop pet') || text.includes('electron');
}

function createGameIdentityMetadata(options: {
  activeWindow: { executablePath?: string; processName?: string; title?: string } | null;
  source: DesktopPetCaptureSourceLike;
}) {
  const executableName = options.activeWindow?.executablePath?.split(/[\\/]/u).pop()?.trim() ?? '';
  return [
    options.source.name ? `捕获窗口标题：${options.source.name}` : '',
    !isDesktopPetWindowInfo(options.activeWindow) && options.activeWindow?.title
      ? `前台窗口标题：${options.activeWindow.title}` : '',
    !isDesktopPetWindowInfo(options.activeWindow) && options.activeWindow?.processName
      ? `前台进程：${options.activeWindow.processName}` : '',
    !isDesktopPetWindowInfo(options.activeWindow) && executableName
      ? `前台可执行文件：${executableName}` : '',
  ].filter(Boolean).join('；');
}

function getGameCompanionRuntimeSourceText(state: GameCompanionLoopRuntimeState) {
  return state.lockedSourceLabel ?? state.query ?? state.sourceId ?? state.sourceType;
}

function createFirstFrameCheckMessage(options: {
  analysis: ParsedGameAnalysis;
  observationSummary: string;
  sourceLabel: string;
  status: Exclude<GameCompanionSourceCheckStatus, 'idle' | 'checking' | 'error'>;
}) {
  if (options.status === 'ready') {
    return `第一帧已确认：${options.observationSummary || options.sourceLabel}`;
  }

  const uncertainty = options.analysis.uncertainty?.find((item) => item.trim()) ?? '';
  const confidenceText = typeof options.analysis.confidence === 'number'
    ? `置信度 ${Math.round(options.analysis.confidence * 100)}%`
    : '';
  return compactCompanionText(
    `第一帧不确定：${uncertainty || confidenceText || '画面判断不够稳定，请确认来源'}`,
    120,
  );
}

function updateSourceCheckFromAnalysis(
  state: GameCompanionLoopRuntimeState,
  analysis: ParsedGameAnalysis,
  observationSummary: string,
  firstFrame = false,
) {
  const trustIssue = getGameCompanionObservationTrustIssue(analysis);
  const status: Exclude<GameCompanionSourceCheckStatus, 'idle' | 'checking' | 'error'> = trustIssue
    ? 'uncertain'
    : 'ready';

  state.sourceCheckStatus = status;
  state.sourceConfidence = analysis.confidence ?? null;
  state.sourceUncertainty = trustIssue ? [trustIssue] : [];
  state.sourceCheckMessage = trustIssue
    ? `${firstFrame ? '第一帧' : '当前画面'}不确定：${trustIssue}`
    : firstFrame
      ? createFirstFrameCheckMessage({
        analysis,
        observationSummary,
        sourceLabel: state.lockedSourceLabel ?? state.query ?? state.sourceType,
        status,
      })
      : `当前画面已确认：${observationSummary || state.lockedSourceLabel || state.sourceType}`;
}

function createFirstFrameToolStateSummary(state: GameCompanionLoopRuntimeState) {
  const sourceText = getGameCompanionRuntimeSourceText(state);
  const uncertainOrFailed = state.sourceCheckStatus === 'uncertain' || state.sourceCheckStatus === 'error';
  const missingEvidence = uncertainOrFailed
    ? (
        state.sourceUncertainty.length
          ? state.sourceUncertainty.map((item) => `Game companion first-frame uncertainty: ${item}`)
          : [state.sourceCheckMessage ?? 'Game companion first frame was not confirmed.']
      )
    : [];

  return {
    changedState: ['Game companion loop started.'],
    missingEvidence,
    observedState: [
      `Game companion loop running: ${state.running}`,
      `First frame check: ${state.sourceCheckStatus}`,
      `Source: ${sourceText}`,
      state.sourceConfidence !== null ? `First frame confidence: ${Math.round(state.sourceConfidence * 100)}%` : '',
      state.lastObservationSummary ? `Latest observation: ${state.lastObservationSummary}` : '',
      state.sourceCheckMessage ? `First frame message: ${state.sourceCheckMessage}` : '',
    ].filter(Boolean),
    recommendedRecovery: uncertainOrFailed
      ? [
          'Ask the user whether to reselect the game capture source or switch the game companion loop to a screen source before making precise gameplay claims.',
          'If the user agrees to watch the whole screen, call manage_game_companion_loop with action=start and sourceType=screen.',
        ]
      : [],
    verificationEvidence: [
      `First frame status was produced by the game companion loop controller: ${state.sourceCheckStatus}`,
    ],
  } satisfies NonNullable<AgentChatCommandResult['stateSummary']>;
}

function createFirstFrameToolResult(
  state: GameCompanionLoopRuntimeState,
  options: { stopped?: boolean; timeout?: boolean } = {},
): AgentChatCommandResult {
  const sourceText = getGameCompanionRuntimeSourceText(state);
  const stateSummary = createFirstFrameToolStateSummary(state);
  const observations = [
    'Game companion loop started.',
    `Game companion loop running: ${state.running}`,
    `First frame check: ${state.sourceCheckStatus}`,
    state.sourceCheckMessage ? `First frame message: ${state.sourceCheckMessage}` : '',
    state.lastObservationSummary ? `Latest observation: ${state.lastObservationSummary}` : '',
    `Source: ${sourceText}`,
    `Samples: ${state.sampleCount}`,
    `Comments: ${state.commentCount}`,
  ].filter(Boolean);

  if (options.stopped) {
    return {
      observations,
      ok: true,
      responseText: '游戏陪伴循环已停止，第一帧确认没有继续等待。',
      stateSummary,
      verification: 'Game companion loop stopped before first-frame confirmation completed.',
    };
  }

  if (options.timeout) {
    return {
      followUp: '第一帧确认仍在进行中。可以稍后查看状态，或在悬浮条/Agent 面板里重选来源。',
      observations,
      ok: true,
      responseText: `游戏陪伴循环已开启，但第一帧还在确认中。当前来源：${sourceText}。`,
      stateSummary,
      verification: 'Game companion loop started; first-frame confirmation timed out before the Agent tool response.',
    };
  }

  if (state.sourceCheckStatus === 'error') {
    return {
      errorText: state.sourceCheckMessage ?? 'Game companion first frame failed.',
      followUp: '第一帧没有确认成功。请让用户重选来源，或改为观察整个屏幕。',
      observations,
      ok: false,
      responseText: `游戏陪伴循环已尝试开启，但第一帧确认失败：${state.sourceCheckMessage ?? '未知原因'}`,
      stateSummary,
      verification: 'Game companion first-frame confirmation failed.',
    };
  }

  if (state.sourceCheckStatus === 'uncertain') {
    return {
      followUp: '第一帧画面不够确定。请先向用户确认是否重选来源或改看整个屏幕。',
      observations,
      ok: true,
      responseText: `游戏陪伴循环已开启，但第一帧不确定：${state.sourceCheckMessage ?? '画面判断不够稳定'}。`,
      stateSummary,
      verification: 'Game companion first-frame confirmation completed with uncertainty.',
    };
  }

  if (state.sourceCheckStatus === 'ready') {
    return {
      observations,
      ok: true,
      responseText: `游戏陪伴循环已开启，第一帧已确认：${state.lastObservationSummary ?? sourceText}。`,
      stateSummary,
      verification: 'Game companion first-frame confirmation completed.',
    };
  }

  return {
    observations,
    ok: true,
    responseText: `游戏陪伴循环已开启，正在确认第一帧。当前来源：${sourceText}。`,
    stateSummary,
    verification: 'Game companion loop started and first-frame confirmation is pending.',
  };
}

function createStatusResult(state: GameCompanionLoopRuntimeState | null): AgentChatCommandResult {
  if (!state?.running) {
    return {
      observations: ['Game companion loop running: false'],
      ok: true,
      responseText: '游戏陪伴循环当前没有运行。',
      verification: 'Game companion loop is stopped.',
    };
  }

  const sourceText = getGameCompanionRuntimeSourceText(state);
  return {
      observations: [
        'Game companion loop running: true',
        `Samples: ${state.sampleCount}`,
        `Comments: ${state.commentCount}`,
        `Source: ${sourceText}`,
        `First frame check: ${state.sourceCheckStatus}`,
        state.sourceCheckMessage ? `First frame message: ${state.sourceCheckMessage}` : '',
        `Interval: ${state.intervalMs}ms`,
    ].filter(Boolean),
    ok: true,
    responseText: `游戏陪伴循环运行中：已观察 ${state.sampleCount} 次，已评论 ${state.commentCount} 次，来源 ${sourceText}。${state.sourceCheckMessage ? ` ${state.sourceCheckMessage}` : ''}`,
    stateSummary: createFirstFrameToolStateSummary(state),
    verification: 'Game companion loop runtime state was read.',
  };
}

function createStatusSnapshot(
  state: GameCompanionLoopRuntimeState | null,
  stopReason: string | null = null,
): GameCompanionLoopStatusSnapshot {
  if (!state) {
    return {
      ...STOPPED_GAME_COMPANION_LOOP_STATUS,
      lastUpdatedAt: Date.now(),
      stopReason,
    };
  }

  return {
    commentCount: state.commentCount,
    detectedGameOrGenre: state.detectedGameOrGenre,
    gameIdentityEvidence: state.gameIdentityEvidence,
    intervalMs: state.intervalMs,
    isTicking: state.isTicking,
    lastObservationSummary: state.lastObservationSummary,
    lastUpdatedAt: Date.now(),
    lockedSourceLabel: state.lockedSourceLabel,
    maxSamples: state.maxSamples,
    query: state.query,
    running: state.running,
    sampleCount: state.sampleCount,
    sourceCheckMessage: state.sourceCheckMessage,
    sourceCheckStatus: state.sourceCheckStatus,
    sourceConfidence: state.sourceConfidence,
    sourceType: state.sourceType,
    sourceUncertainty: state.sourceUncertainty,
    startedAt: state.startedAt,
    stopReason: state.running ? null : stopReason,
  };
}

export function useGameCompanionLoopController({
  addLog,
  configRef,
  onStatusChange,
  preferredSourceRef,
}: UseGameCompanionLoopControllerOptions): AgentRuntimeGameCompanionLoopController {
  const loopStateRef = useRef<GameCompanionLoopRuntimeState | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const isCurrentLoopState = (state: GameCompanionLoopRuntimeState) => loopStateRef.current === state && state.running;

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const publishStatus = (stopReason: string | null = null) => {
    onStatusChangeRef.current?.(createStatusSnapshot(loopStateRef.current, stopReason));
  };

  const clearLoopTimer = () => {
    const timerId = loopStateRef.current?.timerId ?? null;
    if (timerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(timerId);
    }

    if (loopStateRef.current) {
      loopStateRef.current.timerId = null;
    }
  };

  const resolveFirstFrameToolResult = (
    state: GameCompanionLoopRuntimeState,
    result = createFirstFrameToolResult(state),
  ) => {
    if (state.firstFrameResultSettled) {
      return;
    }

    state.firstFrameResultSettled = true;
    const resolvers = state.firstFrameResultResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve(result);
    }
  };

  const waitForFirstFrameToolResult = (
    state: GameCompanionLoopRuntimeState,
    fallbackResult: AgentChatCommandResult,
  ): Promise<AgentChatCommandResult> | AgentChatCommandResult => {
    if (typeof window === 'undefined') {
      return fallbackResult;
    }

    if (state.sourceCheckStatus !== 'checking' || state.firstFrameResultSettled) {
      return createFirstFrameToolResult(state);
    }

    return new Promise((resolve) => {
      let timeoutId: number | null = null;
      const resolver: FirstFrameToolResultResolver = (result) => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        resolve(result);
      };

      state.firstFrameResultResolvers.push(resolver);
      timeoutId = window.setTimeout(() => {
        const resolverIndex = state.firstFrameResultResolvers.indexOf(resolver);
        if (resolverIndex >= 0) {
          state.firstFrameResultResolvers.splice(resolverIndex, 1);
        }
        resolve(createFirstFrameToolResult(state, { timeout: true }));
      }, FIRST_FRAME_AGENT_RESULT_TIMEOUT_MS);
    });
  };

  const postCompanionMessage = (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }

    const chatState = desktopPetChatStore.getState();
    const petId = chatState.activePetId || DEFAULT_CHAT_ACTIVE_PET_ID;
    const slot = getDesktopPetSlot(configRef.current, petId)
      ?? getDesktopPetSlot(configRef.current, DEFAULT_CHAT_ACTIVE_PET_ID);

    desktopPetChatStore.addMessage({
      chatMode: chatState.chatMode,
      id: createChatMessageId(`game-companion-${slot?.id ?? 'pet'}`),
      petId: slot?.id ?? null,
      petName: slot?.personality.name ?? null,
      role: 'model',
      text: trimmedText,
    });
  };

  const stopInternal = (reason?: string | null) => {
    const state = loopStateRef.current;
    clearLoopTimer();
    if (state) {
      state.running = false;
      resolveFirstFrameToolResult(state, createFirstFrameToolResult(state, { stopped: true }));
    }

    if (reason) {
      addLog(reason);
    }
    publishStatus(reason ?? null);
  };

  const scheduleNextTick = () => {
    const state = loopStateRef.current;
    if (!state?.running || typeof window === 'undefined') {
      return;
    }

    clearLoopTimer();
    const delayMs = state.sourceCheckStatus === 'checking' || state.sourceCheckStatus === 'uncertain'
      ? Math.min(state.intervalMs, GAME_COMPANION_UNCERTAIN_RETRY_INTERVAL_MS)
      : state.pendingCompanionReplyRevision !== null
        ? Math.min(state.intervalMs, GAME_COMPANION_PENDING_REPLY_RECHECK_MS)
        : state.intervalMs;
    state.timerId = window.setTimeout(() => {
      void runOneTick();
    }, delayMs);
  };

  const runOneTick = async () => {
    const state = loopStateRef.current;
    if (!state?.running || state.isTicking) {
      return;
    }

    state.isTicking = true;
    try {
      if (state.sampleCount >= state.maxSamples) {
        stopInternal('游戏陪伴循环已达到本次最大观察次数，已自动停止。');
        return;
      }

      const activeWindow = !state.sourceId && !state.query
        ? await desktopPetShellRuntime.getActiveWindowInfo().catch(() => null) as {
            executablePath?: string;
            processName?: string;
            title?: string;
          } | null
        : null;
      if (!isCurrentLoopState(state)) {
        return;
      }

      // Clicking the pet menu usually brings the pet to the foreground. In that case,
      // choosing the first window can silently observe an unrelated application.
      const needsExplicitSourceSelection = !state.sourceId && !state.query && isDesktopPetWindowInfo(activeWindow);
      const effectiveQuery = state.query || (needsExplicitSourceSelection
        ? null
        : (activeWindow?.title || activeWindow?.processName || null));
      const sources = await desktopPetShellRuntime.listCaptureSources({
        captureSourceTypes: state.sourceType === 'all' ? ['screen', 'window'] : [state.sourceType],
        forceRefresh: true,
        includeCaptureThumbnails: true,
        sourceId: state.lockedSourceId ?? state.sourceId ?? undefined,
      }) as DesktopPetCaptureSourceLike[];
      if (!isCurrentLoopState(state)) {
        return;
      }

      let selectedSource = needsExplicitSourceSelection
        ? null
        : selectGameCompanionSource({
          query: state.lockedSourceId ? null : effectiveQuery,
          sourceId: state.lockedSourceId ?? state.sourceId,
          sources: Array.isArray(sources) ? sources : [],
          sourceType: state.sourceType,
        });

      if (selectedSource?.thumbnail && !state.lockedSourceId && selectedSource.id) {
        const focusedSources = await desktopPetShellRuntime.listCaptureSources({
          captureSourceTypes: state.sourceType === 'all' ? ['screen', 'window'] : [state.sourceType],
          forceRefresh: true,
          includeCaptureThumbnails: true,
          sourceId: selectedSource.id,
        }) as DesktopPetCaptureSourceLike[];
        if (!isCurrentLoopState(state)) {
          return;
        }
        const focusedSource = Array.isArray(focusedSources)
          ? focusedSources.find((source) => source.id === selectedSource?.id && Boolean(source.thumbnail))
          : null;
        if (focusedSource) {
          selectedSource = focusedSource;
        }
      }

      if (!selectedSource?.thumbnail) {
        if (state.sampleCount === 0) {
          state.sourceCheckStatus = 'error';
          state.sourceCheckMessage = needsExplicitSourceSelection
            ? '请先在游戏陪玩中选择一个游戏窗口或屏幕来源，再开始观察。'
            : '第一帧没有捕获到画面缩略图，请确认游戏窗口可见或重新选择来源。';
          state.sourceConfidence = null;
          state.sourceUncertainty = ['未捕获到第一帧缩略图'];
          publishStatus();
          resolveFirstFrameToolResult(state);
        }
        state.consecutiveErrorCount += 1;
        if (state.consecutiveErrorCount >= MAX_CONSECUTIVE_GAME_COMPANION_CAPTURE_FAILURES) {
          postCompanionMessage('我这边连续没捕获到游戏画面，先把陪伴观察停一下。你把游戏窗口露出来或重新选择来源后再叫我继续。');
          stopInternal('游戏陪伴循环因连续无法捕获缩略图而停止。');
        }
        return;
      }

      state.lockedSourceId = selectedSource.id ?? state.lockedSourceId;
      state.lockedSourceLabel = createSourceLabel(selectedSource);
      if (state.sampleCount === 0 && state.sourceCheckStatus === 'checking') {
        state.sourceCheckMessage = `正在确认第一帧：${state.lockedSourceLabel}`;
      }
      publishStatus();
      const rawAnalysis = await analyzeAgentGameSnapshot({
        focus: state.focus,
        gameHint: [
          state.gameHint,
          configRef.current.settings.gameCompanionGameName,
          configRef.current.settings.gameCompanionGameDescription,
        ].filter((value) => value?.trim()).join('；'),
        gameIdentityMetadata: createGameIdentityMetadata({ activeWindow, source: selectedSource }),
        imageDataUrl: selectedSource.thumbnail,
        question: '低频观察当前游戏画面，判断是否有明显变化，并生成一句适合桌宠陪聊的短观察。',
        settings: configRef.current.settings,
        sourceLabel: state.lockedSourceLabel,
      });
      if (!isCurrentLoopState(state)) {
        return;
      }

      const analysis = tryParseGameAnalysis(rawAnalysis);
      const trustIssue = getGameCompanionObservationTrustIssue(analysis);
      const observationSummary = createObservationStatusSummary(analysis);
      const signature = trustIssue ? '' : createObservationSignature(analysis);
      const hasMeaningfulChange = Boolean(signature && signature !== state.lastSignature);
      const now = Date.now();
      const canComment = now - state.lastCommentAt >= state.minCommentIntervalMs;

      state.sampleCount += 1;
      state.observationRevision += 1;
      const observationRevision = state.observationRevision;
      state.consecutiveErrorCount = 0;
      state.lastObservationSummary = observationSummary || state.lastObservationSummary;
      state.detectedGameOrGenre = analysis.detectedGameOrGenre?.trim() || state.detectedGameOrGenre;
      state.gameIdentityEvidence = analysis.gameIdentityEvidence?.trim() || state.gameIdentityEvidence;
      if (signature) {
        state.lastSignature = signature;
      }

      const firstFrame = state.sampleCount === 1;
      updateSourceCheckFromAnalysis(state, analysis, observationSummary, firstFrame);
      if (firstFrame) {
        resolveFirstFrameToolResult(state);
      }

      if (
        !trustIssue
        && (state.commentCount === 0 || hasMeaningfulChange)
        && canComment
        && state.pendingCompanionReplyRevision === null
      ) {
        state.pendingCompanionReplyRevision = observationRevision;
        void generateCompanionReply(analysis, configRef)
          .then((comment) => {
            if (
              isCurrentLoopState(state)
              && state.pendingCompanionReplyRevision === observationRevision
              && state.observationRevision === observationRevision
              && comment
            ) {
              postCompanionMessage(comment);
              state.commentCount += 1;
              state.lastCommentAt = Date.now();
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (loopStateRef.current === state && state.pendingCompanionReplyRevision === observationRevision) {
              state.pendingCompanionReplyRevision = null;
              publishStatus();
            }
          });
      }
      publishStatus();
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      state.consecutiveErrorCount += 1;
      if (state.sampleCount === 0) {
        state.sourceCheckStatus = 'error';
        state.sourceCheckMessage = `第一帧分析失败：${compactCompanionText(errorText, 88)}`;
        state.sourceConfidence = null;
        state.sourceUncertainty = [errorText];
        resolveFirstFrameToolResult(state);
      }
      addLog(`游戏陪伴观察失败：${errorText}`);
      if (state.consecutiveErrorCount >= 2) {
        postCompanionMessage('游戏画面分析连续失败，我先停一下，避免一直打扰你。');
        stopInternal('游戏陪伴循环因连续分析失败而停止。');
      }
    } finally {
      if (loopStateRef.current === state) {
        state.isTicking = false;
        publishStatus();
        scheduleNextTick();
      }
    }
  };

  useEffect(() => () => {
    stopInternal(null);
  }, []);

  return useMemo(() => ({
    start: (options = {}) => {
      stopInternal(null);
      const intervalMs = clampNumber(
        options.intervalMs,
        configRef.current.settings.gameCompanionObservationIntervalMs
          || DEFAULT_GAME_COMPANION_INTERVAL_MS,
        MIN_GAME_COMPANION_INTERVAL_MS,
        MAX_GAME_COMPANION_INTERVAL_MS,
      );
      const minCommentIntervalMs = clampNumber(
        options.minCommentIntervalMs,
        DEFAULT_GAME_COMPANION_COMMENT_INTERVAL_MS,
        MIN_GAME_COMPANION_COMMENT_INTERVAL_MS,
        MAX_GAME_COMPANION_COMMENT_INTERVAL_MS,
      );
      const maxSamples = clampNumber(
        options.maxSamples,
        DEFAULT_GAME_COMPANION_MAX_SAMPLES,
        MIN_GAME_COMPANION_MAX_SAMPLES,
        MAX_GAME_COMPANION_MAX_SAMPLES,
      );
      const preferredSource = preferredSourceRef?.current ?? null;
      const preferredSourceId = preferredSource?.sourceId.trim() || null;
      const preferredSourceLabel = preferredSource?.sourceLabel.trim() || null;
      const sourceType = normalizeSourceType(options.sourceType ?? preferredSource?.sourceType);
      const sourceId = options.sourceId?.trim() || preferredSourceId;
      const query = options.query?.trim() || preferredSourceLabel;

      loopStateRef.current = {
        commentCount: 0,
        consecutiveErrorCount: 0,
        detectedGameOrGenre: configRef.current.settings.gameCompanionGameName.trim() || null,
        firstFrameResultResolvers: [],
        firstFrameResultSettled: false,
        focus: options.focus?.trim() || null,
        gameHint: options.gameHint?.trim() || null,
        gameIdentityEvidence: null,
        intervalMs,
        isTicking: false,
        lastCommentAt: 0,
        lastObservationSummary: null,
        lastSignature: '',
        lockedSourceId: sourceId,
        lockedSourceLabel: preferredSourceLabel,
        maxSamples,
        minCommentIntervalMs,
        observationRevision: 0,
        pendingCompanionReplyRevision: null,
        query,
        running: true,
        sampleCount: 0,
        sourceCheckMessage: '正在确认第一帧画面...',
        sourceCheckStatus: 'checking',
        sourceConfidence: null,
        sourceId,
        sourceType,
        sourceUncertainty: [],
        startedAt: Date.now(),
        timerId: null,
      };

      addLog(`游戏陪伴循环已启动：间隔 ${intervalMs}ms，最多 ${maxSamples} 次。`);
      publishStatus();
      const startedState = loopStateRef.current;
      const startResult: AgentChatCommandResult = {
        observations: [
          'Game companion loop started.',
          `sourceType=${sourceType}`,
          sourceId ? `sourceId=${sourceId}` : '',
          query ? `query=${query}` : '',
          'firstFrameCheck=checking',
          `intervalMs=${intervalMs}`,
          `minCommentIntervalMs=${minCommentIntervalMs}`,
          `maxSamples=${maxSamples}`,
        ].filter(Boolean),
        ok: true,
        responseText: `游戏陪伴循环已开启。我会每 ${Number((intervalMs / 1000).toFixed(1))} 秒采样一次画面，有明显变化且满足 5 秒冷却才短句陪聊；你说停下我就停止。`,
        stateSummary: createFirstFrameToolStateSummary(startedState),
        verification: 'Game companion loop timer was started.',
      };
      if (typeof window !== 'undefined') {
        startedState.timerId = window.setTimeout(() => {
          void runOneTick();
        }, Math.min(intervalMs, 200));
      }

      return waitForFirstFrameToolResult(startedState, startResult);
    },
    status: () => createStatusResult(loopStateRef.current),
    stop: () => {
      const wasRunning = Boolean(loopStateRef.current?.running);
      const previousState = loopStateRef.current;
      stopInternal(wasRunning ? '游戏陪伴循环已停止。' : null);

      return {
        observations: [
          `Game companion loop was running: ${wasRunning}`,
          previousState ? `Samples: ${previousState.sampleCount}` : '',
          previousState ? `Comments: ${previousState.commentCount}` : '',
        ].filter(Boolean),
        ok: true,
        responseText: wasRunning
          ? '游戏陪伴循环已停止。'
          : '游戏陪伴循环本来就没有运行。',
        verification: 'Game companion loop stop command handled.',
      } satisfies AgentChatCommandResult;
    },
  }), [addLog, configRef, preferredSourceRef]);
}
