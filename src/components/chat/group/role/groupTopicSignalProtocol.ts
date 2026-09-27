export const GROUP_TOPIC_SIGNALS = [
  'none',
  'disagreement',
  'waiting-information',
  'stage-conclusion',
  'derive-topic',
] as const;

export type GroupTopicSignal = (typeof GROUP_TOPIC_SIGNALS)[number];

const TOPIC_SIGNAL_MARKER_REGEX = /\[\[topic-signal\s*:\s*([a-z-]+)\s*\]\]/giu;
const TRAILING_PARTIAL_MARKER_REGEX = /\[\[[^\]\r\n]*$/u;
const TOPIC_SIGNAL_SET = new Set<string>(GROUP_TOPIC_SIGNALS);

export function extractGroupTopicSignal(text: string): GroupTopicSignal | undefined {
  const matches = Array.from(text.matchAll(TOPIC_SIGNAL_MARKER_REGEX));
  if (matches.length !== 1) return undefined;
  const signal = matches[0][1]?.toLowerCase();
  return signal && TOPIC_SIGNAL_SET.has(signal) ? signal as GroupTopicSignal : undefined;
}

export function stripGroupTopicSignalMarkers(text: string) {
  return text
    .replace(TOPIC_SIGNAL_MARKER_REGEX, '')
    .replace(TRAILING_PARTIAL_MARKER_REGEX, '')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

export function buildGroupTopicSignalPromptLines() {
  return [
    '在回复末尾追加且只追加一个隐藏状态标记，正文中不要解释或引用该标记。',
    '格式：[[topic-signal:none]]。值只能是 none、disagreement、waiting-information、stage-conclusion、derive-topic。',
    '仅在明确出现分歧、确实需要外部信息、形成阶段结论或建议另开话题时使用对应值；不确定时必须使用 none。',
    'derive-topic 只表示建议另开话题，不得生成话题 ID，也不得声称已经切换话题。',
  ];
}
