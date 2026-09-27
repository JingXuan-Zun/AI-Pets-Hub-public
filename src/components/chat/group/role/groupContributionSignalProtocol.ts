export const GROUP_CONTRIBUTION_SIGNALS = [
  'new-fact', 'new-viewpoint', 'new-question', 'new-action',
  'new-relationship', 'new-conclusion', 'none',
] as const;

export type GroupContributionSignal = (typeof GROUP_CONTRIBUTION_SIGNALS)[number];

const MARKER = /\[\[contribution-signal\s*:\s*([a-z-]+)\s*\]\]/giu;
const SIGNALS = new Set<string>(GROUP_CONTRIBUTION_SIGNALS);

export function extractGroupContributionSignal(text: string) {
  const matches = Array.from(text.matchAll(MARKER));
  if (matches.length !== 1) return undefined;
  const value = matches[0][1]?.toLowerCase();
  return value && SIGNALS.has(value) ? value as GroupContributionSignal : undefined;
}

export function stripGroupContributionSignalMarkers(text: string) {
  return text.replace(MARKER, '').replace(/[ \t]+\n/gu, '\n').trim();
}

export function buildGroupContributionSignalPromptLines() {
  return [
    '在回复末尾追加且只追加一个隐藏贡献标记，正文中不要解释该标记。',
    '格式：[[contribution-signal:none]]。值只能是 new-fact、new-viewpoint、new-question、new-action、new-relationship、new-conclusion、none。',
    '只有本轮确实新增事实、观点、问题、行动、关系判断或结论时才使用对应值；只是附和、改写或重复时使用 none。',
  ];
}
