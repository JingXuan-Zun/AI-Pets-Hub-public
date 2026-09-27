import { type PetConfig, type PetModelMotionBinding } from '../../types';
import {
  resolveCharacterAnimationToolOptionId,
} from './characterAnimationToolProtocol';
import {
  createCharacterAnimationSemanticIndex,
  formatCharacterAnimationSemanticIndexEntry,
  rankCharacterAnimationSemanticIndexEntries,
  type CharacterAnimationSemanticSourceQuality,
} from './characterAnimationSemanticIndex';

export interface CharacterAnimationSemanticResolverModelRequest {
  settings: PetConfig['settings'];
  systemInstruction: string;
  userInput: string;
}

export type CharacterAnimationSemanticResolverModelCaller = (
  request: CharacterAnimationSemanticResolverModelRequest,
) => Promise<string>;

export interface CharacterAnimationSemanticDecision {
  animationIds: string[];
  confidence: number | null;
  diagnostics?: CharacterAnimationSemanticDiagnostics;
  reason: string;
}

export interface CharacterAnimationSemanticDiagnosticCandidate {
  concepts: string[];
  id: string;
  label: string;
  motionKey: PetModelMotionBinding['motionKey'];
  quality: CharacterAnimationSemanticSourceQuality;
  score: number;
}

export interface CharacterAnimationSemanticDiagnostics {
  candidateFocus: CharacterAnimationSemanticDiagnosticCandidate[];
  fullIndexCount: number;
  localIntentHint: 'likely' | 'uncertain';
}

export interface ResolveSemanticCharacterAnimationTriggerOptions {
  bindings: PetModelMotionBinding[];
  maxMatches?: number;
  minConfidence?: number;
  modelCaller?: CharacterAnimationSemanticResolverModelCaller;
  settings: PetConfig['settings'];
  userInput: string;
}

const SEMANTIC_ANIMATION_MIN_CONFIDENCE = 0.55;
const SEMANTIC_ANIMATION_INTENT_PATTERN = /(?:做|播放|触发|执行|表演|演示|表现|装作|假装|来个|来一个|切到|换成|摆|摆出|给我|试试|动作|动画|姿势|表情|看看|让我看|最后|再来|再做|打(?:一?个|一下|一声|声)?招呼|问候|比耶|剪刀手|比心|爱心|挠|抓|后脑勺|叉腰|蹲|挥|招手|跳舞|跳|跑|走|散步|睡|吃|笑|哭|生气|害羞|尴尬|不好意思|拍手|鼓掌|点头|摇头|敬礼|转圈|旋转|眨眼|play|do|perform|trigger|show|use|switch\s+to|start|wave|peace|heart|clap|salute|spin|bow|nod|sit|dance|jump|hop|wink)/iu;

const SEMANTIC_ANIMATION_RESOLVER_SYSTEM_INSTRUCTION = [
  'You are a character animation action agent and semantic animation selector inside a desktop pet chat app.',
  'Your job is to understand the user message, inspect the current action semantic index, and choose concrete animation IDs.',
  'Return exactly one JSON object. Do not return markdown or extra text.',
  'Think from the user message and the available animation library, not from a fixed keyword list.',
  '',
  'Allowed JSON shape:',
  '{ "animationIds": ["id"], "confidence": 0.0, "reason": "short reason" }',
  '',
  'Rules:',
  '- Use only IDs from the provided library. Never invent an ID.',
  '- If the user explicitly names an ID, file name, label, or clip name, choose that exact animation.',
  '- If the user describes the same meaning in Chinese or English, infer the closest matching ID from the semantic concepts, aliases, tags, labels, paths, clip names, and motion keys.',
  '- Prefer meaningful labels, IDs, and clip names over generic numbered names such as take001, mixamo, animation, or ArmatureAction.',
  '- Treat folder and path words as context. Prefer context/generic entries only when the user clearly names that folder/path or no better strong semantic entry exists.',
  '- Candidate focus is a local index ranking, not the final answer. You may choose from the full semantic index when focus is weak or missing.',
  '- Preserve the order if the user asks for multiple actions.',
  '- Select at most 3 animations.',
  '- Return an empty animationIds array when the message is not asking the pet to perform an animation, or when no listed animation is clearly related.',
  '- Use confidence >= 0.8 only for exact or very clear semantic matches. Use confidence < 0.55 for weak guesses.',
].join('\n');

function normalizeResolverText(value: string) {
  return value.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
}

function clampConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function getRawDecisionAnimationIds(parsed: Record<string, unknown>) {
  const rawValue = parsed.animationIds ?? parsed.animations ?? parsed.ids ?? parsed.animationId;
  if (typeof rawValue === 'string') {
    return [rawValue];
  }

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        return typeof record.id === 'string'
          ? record.id
          : typeof record.animationId === 'string'
            ? record.animationId
            : '';
      }

      return '';
    })
    .filter(Boolean);
}

function tryParseSemanticDecisionJson(text: string): CharacterAnimationSemanticDecision | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    return {
      animationIds: getRawDecisionAnimationIds(record),
      confidence: clampConfidence(record.confidence),
      reason: typeof record.reason === 'string' ? record.reason.trim() : '',
    };
  } catch {
    return null;
  }
}

export function parseCharacterAnimationSemanticDecision(text: string): CharacterAnimationSemanticDecision | null {
  const normalizedText = normalizeResolverText(text);
  const directParse = tryParseSemanticDecisionJson(normalizedText);
  if (directParse) {
    return directParse;
  }

  const startIndex = normalizedText.indexOf('{');
  const endIndex = normalizedText.lastIndexOf('}');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  return tryParseSemanticDecisionJson(normalizedText.slice(startIndex, endIndex + 1));
}

function createCharacterAnimationSemanticResolverContext(
  bindings: PetModelMotionBinding[],
  userInput: string,
  maxOptions = 80,
) {
  const semanticIndex = createCharacterAnimationSemanticIndex(
    bindings,
    maxOptions,
  );
  const rankedEntries = rankCharacterAnimationSemanticIndexEntries(
    semanticIndex.entries,
    userInput,
  ).filter((rankedEntry) => rankedEntry.score > 0);
  const focusedEntries = rankedEntries.slice(0, 12);
  const diagnostics: CharacterAnimationSemanticDiagnostics = {
    candidateFocus: focusedEntries.slice(0, 6).map(({ entry, score }) => ({
      concepts: entry.semanticConcepts.map((concept) => concept.id),
      id: entry.id,
      label: entry.label,
      motionKey: entry.motionKey,
      quality: entry.sourceQuality,
      score,
    })),
    fullIndexCount: semanticIndex.entries.length,
    localIntentHint: SEMANTIC_ANIMATION_INTENT_PATTERN.test(userInput) ? 'likely' : 'uncertain',
  };

  return {
    diagnostics,
    focusedEntries,
    semanticIndex,
  };
}

export function createCharacterAnimationSemanticResolverDiagnostics(options: {
  bindings: PetModelMotionBinding[];
  maxOptions?: number;
  userInput: string;
}) {
  return createCharacterAnimationSemanticResolverContext(
    options.bindings,
    options.userInput,
    options.maxOptions,
  ).diagnostics;
}

export function createCharacterAnimationSemanticResolverInput(options: {
  bindings: PetModelMotionBinding[];
  maxOptions?: number;
  userInput: string;
}) {
  const resolverContext = createCharacterAnimationSemanticResolverContext(
    options.bindings,
    options.userInput,
    options.maxOptions,
  );

  return [
    `User message: ${options.userInput.trim()}`,
    `Local animation intent hint: ${resolverContext.diagnostics.localIntentHint}`,
    '',
    'Action semantic index fields:',
    '- quality=strong means the action has a meaningful label, ID, clip name, or metadata.',
    '- quality=context means the strongest meaning comes from folder/path context.',
    '- quality=generic means names are mostly generic; use only with clear evidence.',
    '',
    'Candidate focus from local semantic index:',
    resolverContext.focusedEntries.length
      ? resolverContext.focusedEntries
          .map(({ entry, score }) => {
            const index = resolverContext.semanticIndex.entries.indexOf(entry);
            return `${formatCharacterAnimationSemanticIndexEntry(entry, index)} | localScore=${score}`;
          })
          .join('\n')
      : 'none',
    '',
    'Full action semantic index:',
    resolverContext.semanticIndex.entries.length
      ? resolverContext.semanticIndex.entries.map(formatCharacterAnimationSemanticIndexEntry).join('\n')
      : 'none',
    '',
    'Choose the animation IDs now.',
  ].join('\n');
}

export function shouldUseSemanticCharacterAnimationResolver(
  userInput: string,
  bindings: PetModelMotionBinding[],
) {
  return userInput.trim().length > 0
    && createCharacterAnimationSemanticIndex(bindings, bindings.length).entries.length > 0;
}

async function defaultCharacterAnimationSemanticResolverModelCaller(
  request: CharacterAnimationSemanticResolverModelRequest,
) {
  const { getAgentPlannerResponse } = await import('../../services/geminiService');

  return getAgentPlannerResponse(
    request.userInput,
    request.systemInstruction,
    request.settings,
  );
}

function normalizeResolvedAnimationIds(
  rawAnimationIds: string[],
  bindings: PetModelMotionBinding[],
  maxMatches: number,
) {
  const seen = new Set<string>();
  const resolvedIds: string[] = [];

  rawAnimationIds.forEach((rawAnimationId) => {
    if (resolvedIds.length >= maxMatches) {
      return;
    }

    const optionId = resolveCharacterAnimationToolOptionId(rawAnimationId, bindings);
    if (!optionId || seen.has(optionId)) {
      return;
    }

    seen.add(optionId);
    resolvedIds.push(optionId);
  });

  return resolvedIds;
}

export async function resolveSemanticCharacterAnimationTriggerDecision({
  bindings,
  maxMatches = 3,
  minConfidence = SEMANTIC_ANIMATION_MIN_CONFIDENCE,
  modelCaller = defaultCharacterAnimationSemanticResolverModelCaller,
  settings,
  userInput,
}: ResolveSemanticCharacterAnimationTriggerOptions): Promise<CharacterAnimationSemanticDecision> {
  const diagnostics = createCharacterAnimationSemanticResolverDiagnostics({
    bindings,
    userInput,
  });

  if (!shouldUseSemanticCharacterAnimationResolver(userInput, bindings)) {
    return {
      animationIds: [],
      confidence: 1,
      diagnostics,
      reason: 'No semantic animation intent was detected.',
    };
  }

  const modelResponse = await modelCaller({
    settings,
    systemInstruction: SEMANTIC_ANIMATION_RESOLVER_SYSTEM_INSTRUCTION,
    userInput: createCharacterAnimationSemanticResolverInput({
      bindings,
      userInput,
    }),
  });
  const decision = parseCharacterAnimationSemanticDecision(modelResponse);
  if (!decision) {
    return {
      animationIds: [],
      confidence: 0,
      diagnostics,
      reason: 'Semantic animation resolver did not return valid JSON.',
    };
  }

  const animationIds = normalizeResolvedAnimationIds(decision.animationIds, bindings, maxMatches);
  const confidence = decision.confidence ?? (animationIds.length > 0 ? 0.65 : 0);
  if (animationIds.length === 0 || confidence < minConfidence) {
    return {
      animationIds: [],
      confidence,
      diagnostics,
      reason: decision.reason || 'Semantic animation resolver was not confident enough.',
    };
  }

  return {
    animationIds,
    confidence,
    diagnostics,
    reason: decision.reason,
  };
}

export async function resolveSemanticCharacterAnimationTriggerIds(
  options: ResolveSemanticCharacterAnimationTriggerOptions,
) {
  const decision = await resolveSemanticCharacterAnimationTriggerDecision(options);
  return decision.animationIds;
}
