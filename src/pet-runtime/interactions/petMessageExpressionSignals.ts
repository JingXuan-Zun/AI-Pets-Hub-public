import { type PetAction } from '../../types';

export type PetMessageExpressionAction = Extract<PetAction, 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING'>;

type CandidateSegmentSource = 'bracket' | 'clause' | 'whole';

type CandidateSegment = {
  index: number;
  source: CandidateSegmentSource;
  text: string;
};

type ExpressionSignalProfile = {
  action: PetMessageExpressionAction;
  keywordWeights: Array<{ text: string; weight: number }>;
  patterns: Array<{ pattern: RegExp; weight: number }>;
  penalties?: Array<{ pattern: RegExp; weight: number }>;
};

const EXPRESSION_TRIGGER_SCORE_THRESHOLD = 4;
const BRACKET_CONTENT_REGEX = /[（(［\[{【]([^（）()［\]{}【】]{1,48})[）)］\]}】]/gu;
const CLAUSE_BOUNDARY_REGEX = /[，。！？；、,.!?;:：~\n\r]+/u;
const CLAUSE_CONTENT_REGEX = /[^，。！？；、,.!?;:：~\n\r]+/gu;

const EXPRESSION_SIGNAL_PROFILES: ExpressionSignalProfile[] = [
  {
    action: 'EATING',
    keywordWeights: [
      { text: '吃', weight: 2 },
      { text: '啃', weight: 3 },
      { text: '咬', weight: 3 },
      { text: '嚼', weight: 3 },
      { text: '吞', weight: 2 },
      { text: '咽', weight: 2 },
      { text: '吧唧', weight: 5 },
      { text: '咔嚓', weight: 5 },
      { text: '咕噜', weight: 3 },
      { text: '嗷呜', weight: 5 },
      { text: '投喂', weight: 4 },
      { text: '零食', weight: 2 },
      { text: '点心', weight: 2 },
      { text: '美味', weight: 2 },
      { text: '好吃', weight: 3 },
      { text: '香喷喷', weight: 3 },
      { text: '舔', weight: 2 },
      { text: '叼', weight: 3 },
      { text: '吃完', weight: 4 },
      { text: '吞掉', weight: 4 },
      { text: '干饭', weight: 6 },
      { text: '炫饭', weight: 6 },
      { text: '香香', weight: 2 },
      { text: '馋', weight: 2 },
    ],
    patterns: [
      { pattern: /(?:埋头|低头|凑过去).{0,6}(?:吃|啃|嚼)/u, weight: 6 },
      { pattern: /(?:吧唧|咔嚓|嚼嚼|嗷呜)/u, weight: 6 },
      { pattern: /(?:吞下|咽下|吃掉|塞进嘴里)/u, weight: 5 },
      { pattern: /(?:舔了?舔|叼着?|咬住).{0,6}(?:零食|饼干|食物|点心|饭团)?/u, weight: 5 },
      { pattern: /(?:大口|埋头|认真|开心地).{0,4}(?:干饭|炫饭|吃饭)/u, weight: 6 },
    ],
    penalties: [
      { pattern: /(?:别|不要|不能|不许).{0,3}(?:吃|啃|咬)/u, weight: 3 },
    ],
  },
  {
    action: 'SLEEPING',
    keywordWeights: [
      { text: '困', weight: 3 },
      { text: '睡', weight: 2 },
      { text: '哈欠', weight: 5 },
      { text: '瞌睡', weight: 5 },
      { text: '迷糊', weight: 3 },
      { text: '犯困', weight: 5 },
      { text: '昏昏欲睡', weight: 6 },
      { text: '想睡', weight: 4 },
      { text: '睡着', weight: 4 },
      { text: '打盹', weight: 5 },
      { text: '揉眼', weight: 4 },
      { text: '眼皮', weight: 2 },
      { text: '软绵绵', weight: 2 },
      { text: '迷迷瞪瞪', weight: 5 },
      { text: '睡眼惺忪', weight: 6 },
      { text: '困乎乎', weight: 5 },
      { text: '晕乎乎', weight: 4 },
      { text: '睁不开', weight: 5 },
      { text: '困倦', weight: 6 },
      { text: '疲惫', weight: 5 },
      { text: '没睡醒', weight: 6 },
      { text: '懒洋洋', weight: 4 },
      { text: '软趴趴', weight: 5 },
      { text: '昏沉沉', weight: 5 },
    ],
    patterns: [
      { pattern: /打了?(?:个)?哈欠/u, weight: 6 },
      { pattern: /揉了?揉眼/u, weight: 6 },
      { pattern: /眼皮(?:都|开始|已经)?.{0,4}打架/u, weight: 6 },
      { pattern: /(?:困得|困到|困乎乎|昏昏沉沉)/u, weight: 5 },
      { pattern: /(?:睡眼惺忪|迷迷糊糊|昏昏欲睡)/u, weight: 6 },
      { pattern: /(?:脑袋|小脑袋).{0,4}(?:一点一点|直往下坠|耷拉下来)/u, weight: 6 },
      { pattern: /(?:还没睡醒|困倦地|软趴趴地|懒洋洋地)/u, weight: 6 },
    ],
    penalties: [
      { pattern: /(?:别|不要|不能|不许).{0,3}(?:睡|困)/u, weight: 3 },
    ],
  },
  {
    action: 'HAPPY',
    keywordWeights: [
      { text: '开心', weight: 5 },
      { text: '高兴', weight: 5 },
      { text: '兴奋', weight: 5 },
      { text: '激动', weight: 4 },
      { text: '惊喜', weight: 4 },
      { text: '满足', weight: 3 },
      { text: '期待', weight: 2 },
      { text: '得意', weight: 4 },
      { text: '愉快', weight: 3 },
      { text: '欢快', weight: 3 },
      { text: '微笑', weight: 4 },
      { text: '笑意', weight: 5 },
      { text: '笑盈盈', weight: 6 },
      { text: '笑眯眯', weight: 6 },
      { text: '笑吟吟', weight: 6 },
      { text: '甜甜', weight: 5 },
      { text: '甜滋滋', weight: 5 },
      { text: '甜乎乎', weight: 5 },
      { text: '眯眼', weight: 5 },
      { text: '月牙', weight: 5 },
      { text: '乐呵呵', weight: 5 },
      { text: '雀跃', weight: 5 },
      { text: '可爱', weight: 2 },
      { text: '撒娇', weight: 4 },
      { text: '害羞', weight: 4 },
      { text: '脸红', weight: 3 },
      { text: '亮晶晶', weight: 4 },
      { text: '喜滋滋', weight: 5 },
      { text: '乐滋滋', weight: 5 },
      { text: '嘿嘿', weight: 4 },
      { text: '好耶', weight: 5 },
      { text: '贴贴', weight: 4 },
      { text: '偷笑', weight: 5 },
      { text: '憋笑', weight: 4 },
      { text: '哈哈', weight: 3 },
      { text: '嘻嘻', weight: 4 },
      { text: '笑', weight: 1 },
      { text: '甜', weight: 1 },
    ],
    patterns: [
      { pattern: /(?:嘴角|唇角).{0,6}(?:上扬|弯起|翘起|抿起)/u, weight: 7 },
      { pattern: /眼(?:睛|眸).{0,10}(?:眯成|弯成|亮得像).{0,4}(?:月牙|弯弯|星星)/u, weight: 7 },
      { pattern: /(?:眉眼弯弯|笑眯眯|笑吟吟|笑得很甜|喜滋滋|乐开了花)/u, weight: 6 },
      { pattern: /(?:甜甜地|甜滋滋|甜乎乎|轻快地|雀跃地)/u, weight: 5 },
      { pattern: /(?:忍不住|开心得|高兴得).{0,4}笑/u, weight: 5 },
      { pattern: /(?:耳尖|脸颊).{0,4}(?:发烫|泛红|红红的)/u, weight: 5 },
      { pattern: /(?:嘿嘿|哈哈哈|嘻嘻|好耶|开心坏了)/u, weight: 5 },
      { pattern: /(?:眼睛|眼眸).{0,6}(?:亮晶晶|亮起来|发亮)/u, weight: 5 },
      { pattern: /(?:偷笑|憋不住笑|眉梢都带着笑意)/u, weight: 6 },
    ],
    penalties: [
      { pattern: /(?:要我|让我|想看我).{0,3}笑/u, weight: 2 },
      { pattern: /(?:不|别|不要).{0,3}笑/u, weight: 2 },
      { pattern: /(?:苦笑|冷笑|惨笑)/u, weight: 5 },
    ],
  },
  {
    action: 'SAD',
    keywordWeights: [
      { text: '难过', weight: 5 },
      { text: '伤心', weight: 5 },
      { text: '失落', weight: 5 },
      { text: '委屈', weight: 6 },
      { text: '沮丧', weight: 5 },
      { text: '低落', weight: 5 },
      { text: '失望', weight: 5 },
      { text: '可怜', weight: 3 },
      { text: '害怕', weight: 4 },
      { text: '紧张', weight: 3 },
      { text: '生气', weight: 4 },
      { text: '不安', weight: 4 },
      { text: '郁闷', weight: 4 },
      { text: '哭', weight: 1 },
      { text: '哽咽', weight: 6 },
      { text: '炸毛', weight: 6 },
      { text: '抽噎', weight: 6 },
      { text: '泪汪汪', weight: 6 },
      { text: '耷拉', weight: 5 },
      { text: '垂头丧气', weight: 6 },
      { text: '可怜巴巴', weight: 6 },
      { text: '撇嘴', weight: 4 },
      { text: '闷闷', weight: 4 },
      { text: '呜呜', weight: 5 },
      { text: '蔫蔫', weight: 5 },
      { text: '没精打采', weight: 6 },
      { text: '可怜兮兮', weight: 6 },
      { text: '苦笑', weight: 5 },
      { text: '无奈', weight: 4 },
      { text: '叹气', weight: 5 },
      { text: '委屈巴巴', weight: 6 },
      { text: '蔫巴巴', weight: 6 },
    ],
    patterns: [
      { pattern: /(?:鼻子|鼻尖).{0,4}发酸/u, weight: 7 },
      { pattern: /(?:眼眶|眼圈).{0,4}(?:红了|湿了|发红)/u, weight: 7 },
      { pattern: /(?:委委屈屈|可怜巴巴|垂头丧气|闷闷不乐)/u, weight: 7 },
      { pattern: /(?:低下|垂下).{0,4}(?:头|脑袋)/u, weight: 6 },
      { pattern: /(?:耷拉着?(?:脑袋|耳朵)|撇了撇嘴)/u, weight: 6 },
      { pattern: /(?:快要|忍不住).{0,4}哭/u, weight: 5 },
      { pattern: /(?:呜呜|眼巴巴|抽抽搭搭|没精打采|蔫蔫的)/u, weight: 6 },
      { pattern: /(?:苦笑着?|无奈地叹了口气|委屈巴巴地缩着)/u, weight: 6 },
    ],
    penalties: [
      { pattern: /(?:别|不要|不许).{0,3}哭/u, weight: 3 },
      { pattern: /(?:不|别|不要).{0,3}难过/u, weight: 2 },
    ],
  },
];

function normalizeMessageText(message: string) {
  return message
    .replace(/\s+/g, '')
    .replace(/[“”"'`~!@#$%^&*_+=|\\/<>《》【】\[\]-]/g, '');
}

function extractCandidateSegments(message: string): CandidateSegment[] {
  const bracketSegments: CandidateSegment[] = Array.from(message.matchAll(BRACKET_CONTENT_REGEX))
    .map((match) => ({
      index: match.index ?? 0,
      source: 'bracket' as const,
      text: normalizeMessageText(match[1] ?? ''),
    }))
    .filter((segment) => segment.text);

  const bracketlessMessage = message.replace(BRACKET_CONTENT_REGEX, ' ');
  const clauseSegments: CandidateSegment[] = Array.from(bracketlessMessage.matchAll(CLAUSE_CONTENT_REGEX))
    .map((match) => ({
      index: match.index ?? 0,
      source: 'clause' as const,
      text: normalizeMessageText(match[0] ?? ''),
    }))
    .filter((segment) => segment.text);

  const orderedSegments: CandidateSegment[] = [...bracketSegments, ...clauseSegments]
    .sort((left, right) => left.index - right.index || (left.source === 'bracket' ? -1 : 1));

  const normalizedWhole = normalizeMessageText(bracketlessMessage.replace(CLAUSE_BOUNDARY_REGEX, ' '));
  if (normalizedWhole) {
    orderedSegments.push({
      index: Number.MAX_SAFE_INTEGER,
      source: 'whole',
      text: normalizedWhole,
    });
  }

  return orderedSegments;
}

function resolveSegmentSourceBonus(source: CandidateSegmentSource) {
  switch (source) {
    case 'bracket':
      return 2.4;
    case 'clause':
      return 1.1;
    default:
      return 0.2;
  }
}

function resolveSegmentPositionBonus(segmentIndex: number, segmentCount: number) {
  if (segmentCount <= 1) {
    return 0;
  }

  return Number(((segmentIndex / Math.max(1, segmentCount - 1)) * 1.8).toFixed(2));
}

const HAPPY_EXPLICIT_BLOCK_PATTERNS = [
  /(?:\u82e6\u7b11|\u51b7\u7b11|\u60e8\u7b11)/u,
];

const HAPPY_EXPLICIT_SIGNAL_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  {
    pattern: /^(?:\u7b11|\u7b11\u4e86\u7b11|\u7b11\u4e00\u7b11|\u5fae\u7b11|\u8f7b\u7b11|\u542b\u7b11|\u574f\u7b11|\u839e\u5c14\u4e00\u7b11|\u4f1a\u5fc3\u4e00\u7b11)$/u,
    weight: 5,
  },
  {
    pattern: /(?:\u8f7b\u7b11(?:\u4e86)?(?:\u4e00\u4e0b)?|\u542b\u7b11(?:\u770b\u7740|\u671b\u7740)?|\u7b11\u772f\u772f\u5730?.{0,4}(?:\u770b\u7740|\u671b\u7740)|\u5fcd\u4fca\u4e0d\u7981|\u839e\u5c14\u4e00\u7b11|\u4f1a\u5fc3\u4e00\u7b11|\u5657\u55e4.{0,2}\u7b11\u51fa\u58f0)/u,
    weight: 6,
  },
  {
    pattern: /(?:\u5634\u89d2|\u5507\u89d2).{0,4}(?:\u52fe\u8d77|\u626c\u8d77).{0,6}(?:\u4e00\u62b9)?(?:\u7b11|\u7b11\u610f|\u574f\u7b11)/u,
    weight: 6,
  },
  {
    pattern: /(?:\u9732\u51fa\u7b11\u610f|\u7709\u773c\u5f2f\u5f2f)/u,
    weight: 5,
  },
];

function resolveExplicitSegmentScore(
  action: PetMessageExpressionAction,
  segment: string,
) {
  if (action !== 'HAPPY') {
    return 0;
  }

  if (HAPPY_EXPLICIT_BLOCK_PATTERNS.some((pattern) => pattern.test(segment))) {
    return 0;
  }

  return HAPPY_EXPLICIT_SIGNAL_PATTERNS.reduce((bestScore, entry) => (
    entry.pattern.test(segment)
      ? Math.max(bestScore, entry.weight)
      : bestScore
  ), 0);
}

function scoreSegment(profile: ExpressionSignalProfile, segment: string) {
  let score = 0;

  for (const keyword of profile.keywordWeights) {
    if (segment.includes(keyword.text)) {
      score += keyword.weight;
    }
  }

  for (const pattern of profile.patterns) {
    if (pattern.pattern.test(segment)) {
      score += pattern.weight;
    }
  }

  for (const penalty of profile.penalties ?? []) {
    if (penalty.pattern.test(segment)) {
      score -= penalty.weight;
    }
  }

  score += resolveExplicitSegmentScore(profile.action, segment);

  return score;
}

function dedupeSequentialActions(actions: PetMessageExpressionAction[]) {
  return actions.filter((action, index) => index === 0 || actions[index - 1] !== action);
}

function resolveScoredActionForSegment(
  segment: CandidateSegment,
  segmentIndex: number,
  segmentCount: number,
) {
  const sourceBonus = resolveSegmentSourceBonus(segment.source);
  const positionBonus = resolveSegmentPositionBonus(segmentIndex, segmentCount);
  let bestAction: PetMessageExpressionAction | null = null;
  let bestScore = 0;

  for (const profile of EXPRESSION_SIGNAL_PROFILES) {
    const baseScore = scoreSegment(profile, segment.text);
    if (baseScore <= 0) {
      continue;
    }

    const totalScore = Number((baseScore + sourceBonus + positionBonus).toFixed(2));
    if (totalScore > bestScore) {
      bestAction = profile.action;
      bestScore = totalScore;
    }
  }

  if (!bestAction || bestScore < EXPRESSION_TRIGGER_SCORE_THRESHOLD) {
    return null;
  }

  return {
    action: bestAction,
    score: bestScore,
  };
}

export function resolvePetMessageExpressionActions(
  latestMessage: string,
): PetMessageExpressionAction[] {
  if (!latestMessage.trim()) {
    return [];
  }

  const segments = extractCandidateSegments(latestMessage);
  if (segments.length === 0) {
    return [];
  }

  const primarySegmentActions = segments
    .filter((segment) => segment.source !== 'whole')
    .map((segment, index, filteredSegments) => (
      resolveScoredActionForSegment(segment, index, filteredSegments.length)
    ))
    .filter((candidate): candidate is { action: PetMessageExpressionAction; score: number } => Boolean(candidate))
    .map((candidate) => candidate.action);

  const dedupedPrimaryActions = dedupeSequentialActions(primarySegmentActions);
  if (dedupedPrimaryActions.length > 0) {
    return dedupedPrimaryActions;
  }

  const wholeSegment = segments.find((segment) => segment.source === 'whole');
  if (!wholeSegment) {
    return [];
  }

  const wholeSegmentAction = resolveScoredActionForSegment(wholeSegment, 0, 1);
  return wholeSegmentAction ? [wholeSegmentAction.action] : [];
}

export function resolvePetMessageExpressionAction(
  latestMessage: string,
): PetMessageExpressionAction | null {
  if (!latestMessage.trim()) {
    return null;
  }

  return resolvePetMessageExpressionActions(latestMessage)[0] ?? null;
}
