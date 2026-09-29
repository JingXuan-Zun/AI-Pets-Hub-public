import { type PetModelMotionBinding } from '../../types';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { extractCharacterToolInvocations } from './characterToolProtocol';

export interface CharacterAnimationToolOption {
  aliases: string[];
  binding: PetModelMotionBinding;
  id: string;
  label: string;
}

export interface CharacterAnimationDirectTriggerMatch {
  animationId: string;
  binding: PetModelMotionBinding;
  index: number;
  matchKind: 'direct' | 'path' | 'semantic';
  matchedAlias: string;
}

const MAX_ANIMATION_TOOL_OPTIONS = 48;
const KNOWN_MOTION_EXTENSION_REGEX = /(?:\.motion3|\.exp3)?\.json$|\.(?:fbx|glb|gltf|vrma)$/iu;
const TRAILING_LOOKUP_PUNCTUATION_REGEX = /[。！!？?，,、；;：:）)\]】]+$/gu;
const PLAYABLE_ANIMATION_MOTION_KEYS = new Set<PetModelMotionBinding['motionKey']>([
  'eating',
  'happy',
  'hover-body',
  'hover-hand-left',
  'hover-hand-right',
  'hover-head',
  'idle',
  'moving',
  'running',
  'sad',
  'sleeping',
  'swimming',
  'walking',
]);
const ANIMATION_COMMAND_INTENT_PATTERN = /(?:做|播放|触发|执行|表演|演示|表现|装作|假装|来个|来一个|切到|换成|摆|摆出|给我|试试|动作|动画|姿势|表情|看看|让我看|打(?:一?个|一下|一声|声)?招呼|问候|比耶|剪刀手|比心|爱心|挠|抓|后脑勺|叉腰|蹲|挥|招手|跳舞|跳|跑|走|散步|睡|吃|笑|哭|生气|害羞|尴尬|不好意思|拍手|鼓掌|点头|摇头|敬礼|转圈|旋转|眨眼|play|do|perform|trigger|show|use|switch\s+to|start|wave|peace|heart|clap|salute|spin|bow|nod|sit|dance|jump|hop|wink)/iu;
const COMMAND_OPTIONAL_SEMANTIC_ALIAS_GROUP_IDS = new Set([
  'akimbo',
  'blink',
  'bow',
  'clap',
  'dance',
  'heart',
  'jump',
  'nod',
  'peace',
  'salute',
  'scratch-head',
  'shake-head',
  'show-full-body',
  'sit',
  'spin',
  'squat',
  'wave',
]);
export const ANIMATION_SEMANTIC_ALIAS_GROUPS: Array<{ id: string; terms: string[] }> = [
  { id: 'scratch-head', terms: ['scratchhead', 'scratch_head', 'scratch-head', 'scratch head', 'head scratch', 'scratch', '挠头', '抓头', '摸头', '挠挠头', '抓抓头', '挠脑袋', '抓脑袋', '摸脑袋', '后脑勺', '挠后脑勺', '抓后脑勺'] },
  { id: 'akimbo', terms: ['akimbo', 'hands on hips', 'hands_on_hips', '叉腰', '双手叉腰', '掐腰', '手叉腰'] },
  { id: 'squat', terms: ['squat', 'squatting', 'crouch', 'crouching', '蹲', '蹲下', '下蹲', '蹲着', '半蹲'] },
  { id: 'show-full-body', terms: ['showfullbody', 'show_full_body', 'show-full-body', 'show full body', 'full body', '展示全身', '全身展示', '看全身', '看看全身'] },
  { id: 'wave', terms: ['wave', 'waving', 'greet', 'greeting', 'hello', 'hi', '挥手', '招手', '打招呼', '问候'] },
  { id: 'peace', terms: ['peace', 'victory', 'vsign', 'v_sign', 'v-sign', '比耶', '剪刀手', 'v字', '胜利手势'] },
  { id: 'shy', terms: ['shy', 'blush', 'bashful', '害羞', '脸红', '羞涩', '不好意思'] },
  { id: 'happy', terms: ['happy', 'smile', 'smiling', 'laugh', 'joy', 'cheer', '开心', '高兴', '微笑', '笑', '大笑', '兴奋'] },
  { id: 'sad', terms: ['sad', 'cry', 'crying', 'tear', 'upset', 'down', '难过', '伤心', '哭', '委屈', '沮丧', '失落'] },
  { id: 'angry', terms: ['angry', 'mad', 'rage', 'stomp', '生气', '愤怒', '跺脚', '气鼓鼓'] },
  { id: 'sleepy', terms: ['sleep', 'sleepy', 'sleeping', 'yawn', 'doze', 'nap', '睡觉', '困', '困倦', '打哈欠', '闭眼'] },
  { id: 'eat', terms: ['eat', 'eating', 'chew', 'bite', 'food', '吃', '吃东西', '进食', '咀嚼', '啃', '嚼'] },
  { id: 'dance', terms: ['dance', 'dancing', '跳舞', '舞蹈'] },
  { id: 'jump', terms: ['jump', 'hop', 'bounce', '跳', '跳跃', '蹦'] },
  { id: 'run', terms: ['run', 'running', 'dash', 'sprint', '跑', '奔跑', '冲刺'] },
  { id: 'walk', terms: ['walk', 'walking', 'stroll', '走', '走路', '散步'] },
  { id: 'sit', terms: ['sit', 'sitting', '坐', '坐下'] },
  { id: 'bow', terms: ['bow', 'bowing', '鞠躬', '弯腰'] },
  { id: 'nod', terms: ['nod', 'nodding', '点头'] },
  { id: 'shake-head', terms: ['shakehead', 'shake_head', 'shake-head', '摇头'] },
  { id: 'clap', terms: ['clap', 'clapping', '拍手', '鼓掌'] },
  { id: 'heart', terms: ['heart', 'love', 'fingerheart', 'finger_heart', 'finger-heart', '比心', '爱心'] },
  { id: 'salute', terms: ['salute', '敬礼'] },
  { id: 'spin', terms: ['spin', 'turn', 'twirl', '转圈', '转个圈', '旋转'] },
  { id: 'blink', terms: ['blink', 'wink', '眨眼', '眨眼睛'] },
];

type DirectTriggerAliasCandidate = {
  alias: string;
  allowCjkFuzzyMatch: boolean;
  matchKind: CharacterAnimationDirectTriggerMatch['matchKind'];
  requiresCommandIntent: boolean;
  score: number;
};

type SemanticAliasCandidate = {
  alias: string;
  requiresCommandIntent: boolean;
};

function stripKnownMotionExtension(value: string) {
  return value.replace(KNOWN_MOTION_EXTENSION_REGEX, '');
}

function stripUrlSuffix(value: string) {
  return value.split(/[?#]/u)[0] ?? value;
}

function resolvePathBasename(value: string) {
  const trimmedValue = stripUrlSuffix(value.trim());
  if (!trimmedValue || trimmedValue.startsWith('data:')) {
    return '';
  }

  const normalizedPath = trimmedValue.replace(/\\/gu, '/');
  return normalizedPath.split('/').filter(Boolean).pop() ?? '';
}

export function resolvePathNameSegments(value: string) {
  const trimmedValue = stripUrlSuffix(value.trim());
  if (!trimmedValue || trimmedValue.startsWith('data:')) {
    return [];
  }

  return trimmedValue
    .replace(/\\/gu, '/')
    .split('/')
    .map((segment) => stripKnownMotionExtension(segment).trim())
    .filter(Boolean);
}

export function normalizeAnimationSourceName(value: string) {
  const basename = resolvePathBasename(value);
  return stripKnownMotionExtension(basename || value).trim();
}

export function normalizeCharacterAnimationLookupKey(value: string) {
  const sourceName = normalizeAnimationSourceName(value);
  return sourceName
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(TRAILING_LOOKUP_PUNCTUATION_REGEX, '')
    .replace(/[\s_-]+/gu, '');
}

function sanitizeCharacterAnimationToolId(value: string, fallback: string) {
  const sourceName = normalizeAnimationSourceName(value);
  const sanitizedValue = sourceName
    .normalize('NFKC')
    .trim()
    .replace(TRAILING_LOOKUP_PUNCTUATION_REGEX, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();

  return sanitizedValue || fallback;
}

function dedupeValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalizedValue = value.trim();
    const lookupKey = normalizeCharacterAnimationLookupKey(normalizedValue);
    if (!normalizedValue || !lookupKey || seen.has(lookupKey)) {
      return false;
    }

    seen.add(lookupKey);
    return true;
  });
}

function createCharacterAnimationAliases(binding: PetModelMotionBinding, toolId: string) {
  return dedupeValues([
    toolId,
    binding.name,
    binding.id,
    binding.motionKey,
    normalizeAnimationSourceName(binding.sourceUrl),
    ...resolvePathNameSegments(binding.sourceUrl),
    ...(binding.clipNames ?? []),
    ...(binding.semanticAliases ?? []),
    ...(binding.semanticTags ?? []),
  ]);
}

function hasCjkText(value: string) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function createAsciiAliasPattern(alias: string) {
  const parts = stripKnownMotionExtension(alias)
    .normalize('NFKC')
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  return new RegExp(
    `(^|[^\\p{L}\\p{N}])(${parts.map(escapeRegExp).join('[\\s_-]+')})(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  );
}

function createCjkAliasPattern(alias: string) {
  const normalizedAlias = stripKnownMotionExtension(alias).normalize('NFKC').trim();
  const aliasCharacters = Array.from(normalizedAlias).filter((character) => (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(character)
  ));
  if (aliasCharacters.length < 2 || aliasCharacters.length > 8) {
    return null;
  }

  const lightWordGap = String.raw`(?:[\s，,。.!！?？、]*?(?:(?:一?下|一个|个|一|点点|点|了|的|地|得|着|给我|帮我)[\s，,。.!！?？、]*?)*)`;
  return new RegExp(
    aliasCharacters.map(escapeRegExp).join(lightWordGap),
    'iu',
  );
}

function findDirectTriggerAliasIndex(input: string, alias: string, allowCjkFuzzyMatch = false) {
  const normalizedInput = input.normalize('NFKC');
  const normalizedAlias = stripKnownMotionExtension(alias).normalize('NFKC').trim();
  if (!normalizedInput.trim() || !normalizedAlias) {
    return -1;
  }

  if (hasCjkText(normalizedAlias)) {
    const exactIndex = normalizedInput.toLowerCase().indexOf(normalizedAlias.toLowerCase());
    if (exactIndex >= 0) {
      return exactIndex;
    }

    if (!allowCjkFuzzyMatch) {
      return -1;
    }

    const aliasPattern = createCjkAliasPattern(normalizedAlias);
    const match = aliasPattern?.exec(normalizedInput);
    return match?.index ?? -1;
  }

  const aliasPattern = createAsciiAliasPattern(normalizedAlias);
  const match = aliasPattern?.exec(normalizedInput);
  if (!match || match.index < 0) {
    return -1;
  }

  return match.index + (match[1]?.length ?? 0);
}

function hasAnimationCommandIntent(input: string) {
  return ANIMATION_COMMAND_INTENT_PATTERN.test(input);
}

function createAnimationSearchableNames(option: CharacterAnimationToolOption) {
  return dedupeValues([
    option.id,
    option.label,
    option.binding.id,
    normalizeAnimationSourceName(option.binding.sourceUrl),
    ...resolvePathNameSegments(option.binding.sourceUrl),
    ...(option.binding.clipNames ?? []),
    ...(option.binding.semanticAliases ?? []),
    ...(option.binding.semanticTags ?? []),
    option.binding.semanticDescription ?? '',
  ]);
}

function createSemanticAliases(names: string[]) {
  return createSemanticAliasCandidates(names).map((candidate) => candidate.alias);
}

function createSemanticAliasCandidates(names: string[]): SemanticAliasCandidate[] {
  const searchableText = names
    .map((name) => normalizeCharacterAnimationLookupKey(name))
    .filter(Boolean)
    .join('|');
  if (!searchableText) {
    return [];
  }

  const candidates = ANIMATION_SEMANTIC_ALIAS_GROUPS.flatMap((group) => {
    const groupMatched = group.terms.some((term) => {
      const termLookupKey = normalizeCharacterAnimationLookupKey(term);
      return termLookupKey.length >= 2 && searchableText.includes(termLookupKey);
    });

    if (!groupMatched) {
      return [];
    }

    const requiresCommandIntent = !COMMAND_OPTIONAL_SEMANTIC_ALIAS_GROUP_IDS.has(group.id);
    return group.terms.map((alias) => ({
      alias,
      requiresCommandIntent,
    }));
  });
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const lookupKey = normalizeCharacterAnimationLookupKey(candidate.alias);
    const key = `${lookupKey}:${candidate.requiresCommandIntent ? 'intent' : 'direct'}`;
    if (!lookupKey || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createDirectTriggerAliasCandidates(option: CharacterAnimationToolOption): DirectTriggerAliasCandidate[] {
  const genericMotionKey = normalizeCharacterAnimationLookupKey(option.binding.motionKey);
  const searchableNames = createAnimationSearchableNames(option);
  const directAliases = dedupeValues([
    option.id,
    option.label,
    option.binding.id,
    normalizeAnimationSourceName(option.binding.sourceUrl),
    ...(option.binding.clipNames ?? []),
    ...(option.binding.semanticAliases ?? []),
    ...(option.binding.semanticTags ?? []),
  ]);
  const pathAliases = resolvePathNameSegments(option.binding.sourceUrl);
  const semanticAliases = createSemanticAliasCandidates(searchableNames);

  const candidates = [
    ...directAliases.map((alias) => ({
      alias,
      allowCjkFuzzyMatch: false,
      matchKind: 'direct' as const,
      requiresCommandIntent: false,
      score: 100,
    })),
    ...pathAliases.map((alias) => ({
      alias,
      allowCjkFuzzyMatch: false,
      matchKind: 'path' as const,
      requiresCommandIntent: false,
      score: 85,
    })),
    ...semanticAliases.map((candidate) => ({
      alias: candidate.alias,
      allowCjkFuzzyMatch: true,
      matchKind: 'semantic' as const,
      requiresCommandIntent: isPetModelExpressionBinding(option.binding)
        ? false
        : candidate.requiresCommandIntent,
      score: candidate.requiresCommandIntent ? 70 : 78,
    })),
  ] satisfies DirectTriggerAliasCandidate[];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const lookupKey = normalizeCharacterAnimationLookupKey(candidate.alias);
    const key = `${lookupKey}:${candidate.requiresCommandIntent ? 'semantic' : 'direct'}`;
    if (lookupKey.length < 2 || lookupKey === genericMotionKey || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function resolveAnimationPromptHints(option: CharacterAnimationToolOption) {
  return createSemanticAliases(createAnimationSearchableNames(option))
    .filter((alias) => normalizeCharacterAnimationLookupKey(alias) !== normalizeCharacterAnimationLookupKey(option.id))
    .slice(0, 4);
}

function resolveCharacterAnimationToolKindLabel(binding: PetModelMotionBinding) {
  return isPetModelExpressionBinding(binding) ? 'expression' : 'animation';
}

export function resolveCharacterAnimationToolOptions(
  bindings: PetModelMotionBinding[],
  maxOptions = MAX_ANIMATION_TOOL_OPTIONS,
): CharacterAnimationToolOption[] {
  const playableBindings = bindings.filter((binding) => PLAYABLE_ANIMATION_MOTION_KEYS.has(binding.motionKey));
  const usedToolIds = new Map<string, number>();

  return playableBindings.slice(0, maxOptions).map((binding, index) => {
    const baseToolId = sanitizeCharacterAnimationToolId(binding.name || binding.id, `motion_${index + 1}`);
    const duplicateCount = usedToolIds.get(baseToolId) ?? 0;
    usedToolIds.set(baseToolId, duplicateCount + 1);

    const toolId = duplicateCount === 0 ? baseToolId : `${baseToolId}_${duplicateCount + 1}`;
    const label = binding.name.trim() || toolId;

    return {
      aliases: createCharacterAnimationAliases(binding, toolId),
      binding,
      id: toolId,
      label,
    };
  });
}

export function resolveCharacterAnimationToolOptionId(
  rawAnimationId: string,
  bindings: PetModelMotionBinding[],
) {
  const lookupKey = normalizeCharacterAnimationLookupKey(rawAnimationId);
  if (!lookupKey) {
    return null;
  }

  const options = resolveCharacterAnimationToolOptions(bindings, bindings.length);
  const matchedOption = options.find((option) => (
    option.aliases.some((alias) => normalizeCharacterAnimationLookupKey(alias) === lookupKey)
  ));

  return matchedOption?.id ?? null;
}

export function resolveCharacterAnimationBinding(
  rawAnimationId: string,
  bindings: PetModelMotionBinding[],
) {
  const lookupKey = normalizeCharacterAnimationLookupKey(rawAnimationId);
  if (!lookupKey) {
    return null;
  }

  const options = resolveCharacterAnimationToolOptions(bindings, bindings.length);
  const matchedOption = options.find((option) => (
    option.aliases.some((alias) => normalizeCharacterAnimationLookupKey(alias) === lookupKey)
  ));

  return matchedOption?.binding ?? null;
}

export function extractCharacterAnimationToolIds(text: string) {
  return extractCharacterToolInvocations(text)
    .filter((invocation) => invocation.kind === 'animation')
    .map((invocation) => invocation.animationId);
}

export function dedupeSequentialAnimationBindings(bindings: PetModelMotionBinding[]) {
  return bindings.filter((binding, index) => index === 0 || bindings[index - 1]?.id !== binding.id);
}

export function resolveCharacterAnimationBindingQueue(
  latestMessage: string,
  bindings: PetModelMotionBinding[],
  queuedAnimationIds: string[] = [],
  maxQueueLength = 3,
) {
  const animationIds = queuedAnimationIds.length > 0
    ? queuedAnimationIds
    : extractCharacterAnimationToolIds(latestMessage);

  return dedupeSequentialAnimationBindings(
    animationIds
      .map((animationId) => resolveCharacterAnimationBinding(animationId, bindings))
      .filter((binding): binding is PetModelMotionBinding => Boolean(binding)),
  ).slice(0, maxQueueLength);
}

export function resolveDirectCharacterAnimationTriggerMatches(
  userInput: string,
  bindings: PetModelMotionBinding[],
  maxMatches = 3,
): CharacterAnimationDirectTriggerMatch[] {
  const hasCommandIntent = hasAnimationCommandIntent(userInput);
  const matches = resolveCharacterAnimationToolOptions(bindings, bindings.length)
    .flatMap((option) => (
      createDirectTriggerAliasCandidates(option)
        .filter((candidate) => hasCommandIntent || !candidate.requiresCommandIntent)
        .map((candidate) => ({
          alias: candidate.alias,
          index: findDirectTriggerAliasIndex(userInput, candidate.alias, candidate.allowCjkFuzzyMatch),
          matchKind: candidate.matchKind,
          option,
          score: candidate.score,
        }))
        .filter((match) => match.index >= 0)
        .sort((left, right) => {
          if (left.index !== right.index) {
            return left.index - right.index;
          }

          if (left.score !== right.score) {
            return right.score - left.score;
          }

          return normalizeCharacterAnimationLookupKey(right.alias).length
            - normalizeCharacterAnimationLookupKey(left.alias).length;
        })
        .slice(0, 1)
    ))
    .sort((left, right) => {
      if (left.index !== right.index) {
        return left.index - right.index;
      }

      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return normalizeCharacterAnimationLookupKey(right.alias).length
        - normalizeCharacterAnimationLookupKey(left.alias).length;
    });

  const seenBindingIds = new Set<string>();
  const seenInputOccurrences = new Set<string>();
  const uniqueMatches: CharacterAnimationDirectTriggerMatch[] = [];

  matches.forEach((match) => {
    const occurrenceKey = `${match.index}:${normalizeCharacterAnimationLookupKey(match.alias)}`;
    if (
      seenBindingIds.has(match.option.binding.id)
      || seenInputOccurrences.has(occurrenceKey)
      || uniqueMatches.length >= maxMatches
    ) {
      return;
    }

    seenBindingIds.add(match.option.binding.id);
    seenInputOccurrences.add(occurrenceKey);
    uniqueMatches.push({
      animationId: match.option.id,
      binding: match.option.binding,
      index: match.index,
      matchKind: match.matchKind,
      matchedAlias: match.alias,
    });
  });

  return uniqueMatches;
}

export function resolveDirectCharacterAnimationTriggerIds(
  userInput: string,
  bindings: PetModelMotionBinding[],
  maxMatches = 3,
) {
  return resolveDirectCharacterAnimationTriggerMatches(userInput, bindings, maxMatches)
    .map((match) => match.animationId);
}

export function buildCharacterAnimationToolInstruction(bindings: PetModelMotionBinding[]) {
  const options = resolveCharacterAnimationToolOptions(bindings);
  if (options.length === 0) {
    return '';
  }

  const optionLines = options.map((option) => {
    const labelSuffix = option.label && option.label !== option.id ? `（${option.label}）` : '';
    const promptHints = resolveAnimationPromptHints(option);
    const hintSuffix = promptHints.length > 0 ? `；可理解为：${promptHints.join('、')}` : '';
    return `- ${option.id} [${resolveCharacterAnimationToolKindLabel(option.binding)}]${labelSuffix}${hintSuffix}`;
  });

  return [
    '当前 3D 动画库（可选工具）：',
    '当角色表达需要具体 3D 动画时，只能从下列 ID 中选择，并用 `【动画:id】` 触发。不要编造不存在的 ID；不确定就不要写动画标记。',
    '如果一轮回复需要多个动画，最多写 3 个，按播放顺序排列，例如 `【动画:wave】【动画:smile】`。系统会排队完整播放。',
    'Current character asset library (optional tool):',
    'For an imported motion, output `[animation:id]` using one listed animation ID.',
    'For an imported Live2D expression, output `[expression:id]` using one listed expression ID.',
    'Use only listed IDs. Do not invent IDs. If unsure, do not output a tool marker. Max 3 markers per reply.',
    ...optionLines,
  ].join('\n');
}
