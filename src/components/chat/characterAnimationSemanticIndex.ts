import { type PetModelMotionBinding } from '../../types';
import {
  ANIMATION_SEMANTIC_ALIAS_GROUPS,
  normalizeAnimationSourceName,
  normalizeCharacterAnimationLookupKey,
  resolveCharacterAnimationToolOptions,
  resolvePathNameSegments,
  type CharacterAnimationToolOption,
} from './characterAnimationToolProtocol';

export type CharacterAnimationSemanticSourceQuality = 'strong' | 'context' | 'generic';

export interface CharacterAnimationSemanticIndexConcept {
  id: string;
  terms: string[];
}

export interface CharacterAnimationSemanticIndexEntry {
  binding: PetModelMotionBinding;
  clipTerms: string[];
  description: string | null;
  exactTerms: string[];
  genericTerms: string[];
  id: string;
  label: string;
  metadataTerms: string[];
  motionKey: PetModelMotionBinding['motionKey'];
  pathTerms: string[];
  semanticConcepts: CharacterAnimationSemanticIndexConcept[];
  sourceQuality: CharacterAnimationSemanticSourceQuality;
}

export interface CharacterAnimationSemanticIndex {
  entries: CharacterAnimationSemanticIndexEntry[];
}

const GENERIC_ANIMATION_NAME_PATTERNS = [
  /^take\d*$/iu,
  /^animation\d*$/iu,
  /^anim\d*$/iu,
  /^action\d*$/iu,
  /^clip\d*$/iu,
  /^motion\d*$/iu,
  /^mixamo(?:com)?$/iu,
  /^armature(?:action)?$/iu,
  /^scene$/iu,
  /^default$/iu,
];

const MOTION_KEY_HINTS: Partial<Record<PetModelMotionBinding['motionKey'], string[]>> = {
  eating: ['eat', 'eating', '吃东西', '进食'],
  happy: ['happy', 'smile', '开心', '高兴', '笑'],
  'hover-body': ['body hover', '身体互动', '触摸身体'],
  'hover-hand-left': ['left hand hover', '左手互动', '触摸左手'],
  'hover-hand-right': ['right hand hover', '右手互动', '触摸右手'],
  'hover-head': ['head hover', '摸头', '触摸头'],
  idle: ['idle', 'stand', '待机', '站立'],
  moving: ['move', 'moving', '移动'],
  running: ['run', 'running', '跑步', '奔跑'],
  sad: ['sad', 'cry', '难过', '伤心'],
  sleeping: ['sleep', 'sleeping', '睡觉', '困'],
  swimming: ['swim', 'swimming', '游泳', '游动'],
  walking: ['walk', 'walking', '走路', '散步'],
};

function compactPromptSnippet(value: string, maxLength = 96) {
  const normalizedValue = value.replace(/\s+/gu, ' ').trim();
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function dedupeTerms(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .filter((value) => {
      const lookupKey = normalizeCharacterAnimationLookupKey(value);
      if (!lookupKey || seen.has(lookupKey)) {
        return false;
      }

      seen.add(lookupKey);
      return true;
    });
}

function normalizeMetadataTerms(values: string[] | undefined) {
  return Array.isArray(values)
    ? dedupeTerms(values)
    : [];
}

export function isGenericCharacterAnimationTerm(value: string) {
  const lookupKey = normalizeCharacterAnimationLookupKey(value);
  return lookupKey.length > 0
    && GENERIC_ANIMATION_NAME_PATTERNS.some((pattern) => pattern.test(lookupKey));
}

function createReadableTermVariants(value: string) {
  const normalizedValue = value
    .normalize('NFKC')
    .replace(/[?#].*$/u, '')
     .replace(/\\/gu, '/')
     .split('/')
     .filter(Boolean)
     .pop()
    ?.replace(/(?:\.motion3|\.exp3)?\.json$|\.(?:fbx|glb|gltf|vrma)$/iu, '')
    ?? value;

  return dedupeTerms([
    normalizedValue,
    normalizedValue.replace(/[_-]+/gu, ' '),
    normalizeCharacterAnimationLookupKey(normalizedValue),
  ]);
}

function createSearchableText(terms: string[]) {
  return terms
    .map((term) => normalizeCharacterAnimationLookupKey(term))
    .filter(Boolean)
    .join('|');
}

function hasCjkText(value: string) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function createCjkTermPattern(term: string) {
  const normalizedTerm = term.normalize('NFKC').trim();
  const characters = Array.from(normalizedTerm).filter((character) => hasCjkText(character));
  if (characters.length < 2 || characters.length > 8) {
    return null;
  }

  const lightWordGap = String.raw`(?:[\s，,。.!！?？、]*?(?:(?:一?下|一个|个|一|点点|点|了|的|地|得|着|给我|帮我|跟我|回应我)[\s，,。.!！?？、]*?)*)`;
  return new RegExp(characters.map(escapeRegExp).join(lightWordGap), 'iu');
}

function resolveSemanticConcepts(terms: string[]) {
  const searchableText = createSearchableText(terms);
  if (!searchableText) {
    return [];
  }

  return ANIMATION_SEMANTIC_ALIAS_GROUPS.flatMap<CharacterAnimationSemanticIndexConcept>((group) => {
    const matched = group.terms.some((term) => {
      const termLookupKey = normalizeCharacterAnimationLookupKey(term);
      return termLookupKey.length >= 2 && searchableText.includes(termLookupKey);
    });

    return matched
      ? [{
          id: group.id,
          terms: dedupeTerms(group.terms).slice(0, 10),
        }]
      : [];
  });
}

function resolveSourceQuality(options: {
  clipTerms: string[];
  exactTerms: string[];
  metadataTerms: string[];
  pathTerms: string[];
}) {
  const meaningfulExactTerms = [
    ...options.exactTerms,
    ...options.clipTerms,
    ...options.metadataTerms,
  ].filter((term) => !isGenericCharacterAnimationTerm(term));

  if (meaningfulExactTerms.length > 0) {
    return 'strong' satisfies CharacterAnimationSemanticSourceQuality;
  }

  const meaningfulPathTerms = options.pathTerms.filter((term) => !isGenericCharacterAnimationTerm(term));
  return meaningfulPathTerms.length > 0
    ? 'context'
    : 'generic';
}

function createSemanticIndexEntry(option: CharacterAnimationToolOption): CharacterAnimationSemanticIndexEntry {
  const sourceName = normalizeAnimationSourceName(option.binding.sourceUrl);
  const pathTerms = dedupeTerms(resolvePathNameSegments(option.binding.sourceUrl));
  const clipTerms = dedupeTerms(option.binding.clipNames ?? []);
  const semanticAliases = normalizeMetadataTerms(option.binding.semanticAliases);
  const semanticTags = normalizeMetadataTerms(option.binding.semanticTags);
  const metadataTerms = dedupeTerms([
    ...semanticAliases,
    ...semanticTags,
  ]);
  const exactTerms = dedupeTerms([
    option.id,
    option.label,
    sourceName,
    ...clipTerms,
  ]);
  const motionTerms = dedupeTerms([
    option.binding.motionKey,
    ...(MOTION_KEY_HINTS[option.binding.motionKey] ?? []),
  ]);
  const allTerms = dedupeTerms([
    ...exactTerms,
    ...pathTerms,
    ...clipTerms,
    ...metadataTerms,
    ...motionTerms,
  ]);
  const semanticConcepts = resolveSemanticConcepts(allTerms);
  const genericTerms = allTerms.filter(isGenericCharacterAnimationTerm);

  return {
    binding: option.binding,
    clipTerms,
    description: typeof option.binding.semanticDescription === 'string' && option.binding.semanticDescription.trim()
      ? option.binding.semanticDescription.trim()
      : null,
    exactTerms,
    genericTerms,
    id: option.id,
    label: option.label,
    metadataTerms,
    motionKey: option.binding.motionKey,
    pathTerms,
    semanticConcepts,
    sourceQuality: resolveSourceQuality({
      clipTerms,
      exactTerms: dedupeTerms([option.label, sourceName]),
      metadataTerms,
      pathTerms,
    }),
  };
}

export function createCharacterAnimationSemanticIndex(
  bindings: PetModelMotionBinding[],
  maxOptions = 80,
): CharacterAnimationSemanticIndex {
  return {
    entries: resolveCharacterAnimationToolOptions(bindings, maxOptions)
      .map(createSemanticIndexEntry),
  };
}

function scoreTermAgainstInput(term: string, normalizedUserInput: string, rawUserInput: string) {
  const lookupKey = normalizeCharacterAnimationLookupKey(term);
  if (!lookupKey || lookupKey.length < 2) {
    return 0;
  }

  if (normalizedUserInput.includes(lookupKey)) {
    return lookupKey.length;
  }

  if (hasCjkText(term)) {
    const pattern = createCjkTermPattern(term);
    if (pattern?.test(rawUserInput.normalize('NFKC'))) {
      return lookupKey.length;
    }
  }

  return 0;
}

export function scoreCharacterAnimationSemanticIndexEntry(
  entry: CharacterAnimationSemanticIndexEntry,
  userInput: string,
) {
  const normalizedUserInput = normalizeCharacterAnimationLookupKey(userInput);
  if (!normalizedUserInput) {
    return 0;
  }

  const exactScore = Math.max(0, ...entry.exactTerms.map((term) => scoreTermAgainstInput(term, normalizedUserInput, userInput))) * 12;
  const metadataScore = Math.max(0, ...entry.metadataTerms.map((term) => scoreTermAgainstInput(term, normalizedUserInput, userInput))) * 10;
  const conceptScore = Math.max(
    0,
    ...entry.semanticConcepts.flatMap((concept) => (
      concept.terms.map((term) => scoreTermAgainstInput(term, normalizedUserInput, userInput))
    )),
  ) * 8;
  const pathScore = Math.max(0, ...entry.pathTerms.map((term) => scoreTermAgainstInput(term, normalizedUserInput, userInput))) * 5;
  const baseScore = exactScore + metadataScore + conceptScore + pathScore;
  if (baseScore <= 0) {
    return 0;
  }

  const qualityAdjustment = entry.sourceQuality === 'strong'
    ? 12
    : entry.sourceQuality === 'context'
      ? -18
      : -32;

  return Math.max(0, baseScore + qualityAdjustment);
}

export function rankCharacterAnimationSemanticIndexEntries(
  entries: CharacterAnimationSemanticIndexEntry[],
  userInput: string,
) {
  return entries
    .map((entry) => ({
      entry,
      score: scoreCharacterAnimationSemanticIndexEntry(entry, userInput),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      const qualityOrder: Record<CharacterAnimationSemanticSourceQuality, number> = {
        strong: 0,
        context: 1,
        generic: 2,
      };
      return qualityOrder[left.entry.sourceQuality] - qualityOrder[right.entry.sourceQuality];
    });
}

function formatTermList(terms: string[], maxItems: number, maxLength = 36) {
  return terms
    .slice(0, maxItems)
    .map((term) => compactPromptSnippet(term, maxLength))
    .join(', ');
}

export function formatCharacterAnimationSemanticIndexEntry(
  entry: CharacterAnimationSemanticIndexEntry,
  index: number,
) {
  const concepts = entry.semanticConcepts
    .map((concept) => `${concept.id}(${formatTermList(concept.terms, 5, 24)})`)
    .join('; ');
  const genericHint = entry.genericTerms.length
    ? `genericNames=${formatTermList(entry.genericTerms, 4, 24)}`
    : '';

  return [
    `${index + 1}. id=${entry.id}`,
    `label=${compactPromptSnippet(entry.label, 72)}`,
    `quality=${entry.sourceQuality}`,
    `motionKey=${entry.motionKey}`,
    concepts ? `concepts=${concepts}` : '',
    entry.metadataTerms.length ? `metadata=${formatTermList(entry.metadataTerms, 8)}` : '',
    entry.description ? `description=${compactPromptSnippet(entry.description, 120)}` : '',
    entry.exactTerms.length ? `exact=${formatTermList(entry.exactTerms, 8)}` : '',
    entry.pathTerms.length ? `path=${formatTermList(entry.pathTerms, 6)}` : '',
    entry.clipTerms.length ? `clips=${formatTermList(entry.clipTerms, 5)}` : '',
    genericHint,
  ].filter(Boolean).join(' | ');
}
