import type { ChatMessageContentSegment, ChatMessageExpressionContentSegment } from '../../types.ts';
import type { ExpressionReplyCatalog, SystemExpressionCatalogItem } from '../expressionLibraryTypes.ts';
import type { ExpressionReplySettings } from '../expressionSettings.ts';

export interface ExpressionReplyHistoryItem {
  expressionId: string;
}

export interface ResolveExpressionReplyInput {
  catalog: ExpressionReplyCatalog;
  conversationId: string;
  petId: string;
  recentHistory: ExpressionReplyHistoryItem[];
  replySettings: ExpressionReplySettings;
  replyText: string;
  semanticSelections?: Array<{ segmentIndex: number; rootId: string; categoryId: string }>;
}

type ExpressionChannel = 'image' | 'kaomoji' | 'systemEmoji';
type Candidate = ChatMessageExpressionContentSegment & { intents: string[] };

const channelScores = new Map<string, Record<ExpressionChannel, number>>();
const INTENT_KEYWORDS: Array<[string, string[]]> = [
  ['庆祝', ['恭喜', '庆祝', '成功', '太棒', '好耶']],
  ['愤怒', ['愤怒', '生气', '恼火', '气愤', '火大', '不满']],
  ['惊讶', ['惊讶', '惊喜', '意外', '没想到', '震惊']],
  ['吃醋', ['吃醋', '嫉妒', '醋意']],
  ['委屈', ['委屈']],
  ['开心', ['开心', '高兴', '快乐', '欢喜', '喜悦', '喜不自胜', '不错', '幸运', '喜欢', '好呀']],
  ['伤心', ['伤心', '难过', '失落', '遗憾', '哭', '糟糕']],
  ['关心', ['保重', '休息', '辛苦', '抱抱', '照顾', '没事']],
  ['疑惑', ['为什么', '怎么', '疑惑', '不懂', '奇怪', '？', '?']],
  ['赞同', ['同意', '赞同', '没错', '确实', '当然', '好的']],
  ['害羞', ['害羞', '不好意思', '谢谢', '夸奖']],
  ['打招呼', ['你好', '早上好', '晚上好', '再见', '拜拜']],
];

// Category prose often mentions other emotions as context or contrast. Resolve
// the label first; only unnamed/custom emotions need the description fallback.
// Conversational cues (e.g. “喜欢”, “可以”, “?”) are not category labels.
const CATEGORY_LABELS: Array<[string, string[]]> = [
  ['庆祝', ['庆祝', '恭喜']],
  ['愤怒', ['愤怒', '生气', '恼火', '气愤', '火大']],
  ['惊讶', ['惊讶', '惊喜', '震惊']],
  ['吃醋', ['吃醋', '嫉妒', '醋意']],
  ['委屈', ['委屈']],
  ['开心', ['开心', '高兴', '快乐', '欢喜', '喜悦', '愉悦']],
  ['伤心', ['伤心', '难过', '失落', '悲伤']],
  ['关心', ['关心', '关怀', '安慰']],
  ['疑惑', ['疑惑', '困惑', '疑问']],
  ['赞同', ['赞同', '同意', '认可']],
  ['害羞', ['害羞', '羞涩']],
  ['打招呼', ['打招呼', '问候']],
];

function categoryIntents(name: string, description: string) {
  const labelsIn = (value: string) => CATEGORY_LABELS
    .filter(([, labels]) => labels.some((label) => hasEmotionKeyword(value, label)))
    .map(([intent]) => intent);
  const named = labelsIn(name);
  if (named.length) return named;
  // An ambiguous description is not enough evidence to send an image.
  const described = labelsIn(description);
  return described.length === 1 ? described : [];
}

function hasEmotionKeyword(text: string, keyword: string) {
  let position = text.indexOf(keyword);
  while (position >= 0) {
    const prefix = text.slice(Math.max(0, position - 8), position).trimEnd();
    if (!/(?:不|没|没有|别|不要|不是|并非|不会|不再|并不)(?:很|太|那么|这么|特别)?$/u.test(prefix)) return true;
    position = text.indexOf(keyword, position + keyword.length);
  }
  return false;
}

function resolveIntent(text: string) {
  return INTENT_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => hasEmotionKeyword(text, keyword)))?.[0] ?? null;
}

export function splitReplyText(text: string) {
  const matches = text.match(/[^。！？!?\n]+[。！？!?]?|\n+/gu) ?? [text];
  return matches.filter(Boolean);
}

function systemCandidates(items: SystemExpressionCatalogItem[], kind: 'emoji' | 'kaomoji'): Candidate[] {
  return items.map((item) => ({
    expressionId: item.id,
    expressionKind: kind,
    intents: item.intents,
    kind: 'expression',
    value: item.value,
  }));
}

function imageCandidates(catalog: ExpressionReplyCatalog, mode: ExpressionReplySettings['imageLibraryMode']): Candidate[] {
  if (!mode) return [];
  return catalog.roots
    .filter((root) => root.enabledForReply && root.sourceType === mode)
    .sort((left, right) => left.replyPriority - right.replyPriority)
    .flatMap((root) => root.assets.flatMap((asset) => {
      const category = root.categories.find((item) => item.id === asset.categoryId);
      if (!category) return [];
      return [{
        assetId: asset.assetId,
        categorySnapshot: {
          description: category.description,
          id: category.id,
          name: category.name,
          semanticVersion: category.semanticVersion,
        },
        expressionId: asset.assetId,
        expressionKind: 'image' as const,
        intents: categoryIntents(category.name, category.description),
        kind: 'expression' as const,
        mimeType: asset.mimeType,
        rootSnapshot: { id: root.id, name: root.name, sourceType: root.sourceType },
      }];
    }));
}

function chooseChannel(
  key: string,
  settings: ExpressionReplySettings,
  candidates: Record<ExpressionChannel, Candidate[]>,
): ExpressionChannel | null {
  const weights: Record<ExpressionChannel, number> = {
    image: settings.imageLibraryEnabled && candidates.image.length ? settings.imageStickerWeight : 0,
    kaomoji: candidates.kaomoji.length ? settings.kaomojiWeight : 0,
    systemEmoji: candidates.systemEmoji.length ? settings.systemEmojiWeight : 0,
  };
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (!settings.enabled || total <= 0) return null;
  const scores = channelScores.get(key) ?? { image: 0, kaomoji: 0, systemEmoji: 0 };
  (Object.keys(weights) as ExpressionChannel[]).forEach((channel) => {
    scores[channel] = weights[channel] > 0 ? scores[channel] + weights[channel] : 0;
  });
  const selected = (Object.keys(weights) as ExpressionChannel[])
    .filter((channel) => weights[channel] > 0)
    .sort((left, right) => scores[right] - scores[left])[0] ?? null;
  if (selected) scores[selected] -= total;
  channelScores.set(key, scores);
  return selected;
}

function matchesIntent(candidate: Candidate, intent: string) {
  return candidate.intents.includes(intent);
}

function chooseCandidate(pool: Candidate[], excludedIds: Set<string>) {
  return pool.find((candidate) => !excludedIds.has(candidate.expressionId)) ?? pool[0] ?? null;
}

export function resolveExpressionReply(input: ResolveExpressionReplyInput): ChatMessageContentSegment[] {
  const text = String(input.replyText ?? '');
  const textOnly: ChatMessageContentSegment[] = text ? [{ kind: 'text', text }] : [];
  try {
    if (!text || !input.replySettings.enabled) return textOnly;
    const candidates: Record<ExpressionChannel, Candidate[]> = {
      image: imageCandidates(input.catalog, input.replySettings.imageLibraryMode),
      kaomoji: systemCandidates(input.catalog.system.kaomoji, 'kaomoji'),
      systemEmoji: systemCandidates(input.catalog.system.emoji, 'emoji'),
    };
    const excludedIds = new Set(input.recentHistory.slice(-input.replySettings.recentExpressionWindow).map((item) => item.expressionId));
    const segments: ChatMessageContentSegment[] = [];
    let expressionCount = 0;
    for (const [segmentIndex, textSegment] of splitReplyText(text).entries()) {
      segments.push({ kind: 'text', text: textSegment });
      const selection = input.semanticSelections?.find((item) => item.segmentIndex === segmentIndex);
      const selectedCategory = selection && input.catalog.roots.find((root) => root.id === selection.rootId)
        ?.categories.find((category) => category.id === selection.categoryId);
      const intent = input.semanticSelections !== undefined
        ? (selectedCategory ? categoryIntents(selectedCategory.name, selectedCategory.description)[0] : null)
        : resolveIntent(textSegment);
      if ((!intent && !selectedCategory) || expressionCount >= 3) continue;
      const availableByIntent: Record<ExpressionChannel, Candidate[]> = {
        image: candidates.image.filter((candidate) => selection
          ? candidate.rootSnapshot?.id === selection.rootId && candidate.categorySnapshot?.id === selection.categoryId
          : matchesIntent(candidate, intent)),
        kaomoji: candidates.kaomoji.filter((candidate) => matchesIntent(candidate, intent)),
        systemEmoji: candidates.systemEmoji.filter((candidate) => matchesIntent(candidate, intent)),
      };
      const channel = chooseChannel(`${input.petId}:${input.conversationId}`, input.replySettings, availableByIntent);
      if (!channel) continue;
      const candidate = chooseCandidate(availableByIntent[channel], excludedIds);
      if (!candidate) continue;
      segments.push(candidate);
      excludedIds.add(candidate.expressionId);
      expressionCount += 1;
    }
    return segments;
  } catch {
    return textOnly;
  }
}
