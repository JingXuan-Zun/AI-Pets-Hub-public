import type { DirectedRelationshipDimensions } from '../../../../character-relationship';

export type GroupRelationshipSignal = {
  deltas: DirectedRelationshipDimensions;
  reason: string;
  targetRoleName: string;
};

const RELATIONSHIP_MARKER_REGEX = /\[\[relationship-signal\s*:\s*([^\]\r\n]*)\]\]/giu;

function parseFields(value: string) {
  return Object.fromEntries(value.split(';').map((part) => {
    const separator = part.indexOf('=');
    return separator < 1 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }).filter(([key]) => key));
}

function delta(value: string | undefined) {
  if (!value || !/^-?\d{1,2}$/u.test(value)) return null;
  const numeric = Number(value);
  return numeric >= -10 && numeric <= 10 ? numeric : null;
}

export function extractGroupRelationshipSignal(text: string): GroupRelationshipSignal | undefined {
  const matches = Array.from(text.matchAll(RELATIONSHIP_MARKER_REGEX));
  if (matches.length !== 1 || matches[0][1]?.trim().toLowerCase() === 'none') return undefined;
  const fields = parseFields(matches[0][1] ?? '');
  const targetRoleName = fields.target?.trim().slice(0, 120) ?? '';
  const reason = fields.reason?.trim().slice(0, 240) ?? '';
  const trust = delta(fields.trust);
  const intimacy = delta(fields.intimacy);
  const vigilance = delta(fields.vigilance);
  if (!targetRoleName || !reason || trust === null || intimacy === null || vigilance === null) return undefined;
  return { deltas: { intimacy, trust, vigilance }, reason, targetRoleName };
}

export function stripGroupRelationshipSignalMarkers(text: string) {
  return text.replace(RELATIONSHIP_MARKER_REGEX, '');
}

export function buildGroupRelationshipSignalPromptLines() {
  return [
    '若本轮互动明确改变了你对另一位当前群聊角色的关系判断，可在回复末尾追加一个隐藏关系候选标记；它只生成待用户审核候选，不会自动修改正式关系。',
    '格式：[[relationship-signal:target=角色名;trust=0;intimacy=0;vigilance=0;reason=简短依据]]。每项变化必须是 -10 到 10 的整数，reason 不得包含分号。',
    '只有存在清晰互动证据时才给非零变化；不确定、玩笑、测试、提问或没有关系变化时使用 [[relationship-signal:none]]。',
    '最多输出一个关系候选标记，不要在正文中解释、引用或展示该标记。',
  ];
}
