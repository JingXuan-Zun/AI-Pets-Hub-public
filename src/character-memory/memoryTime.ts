// Time in memories (2026-11-09 memory check-up). A worry noted on 11-06 as "明天下午要去开会"
// was read on 11-08 as tomorrow again: memories kept for days need concrete dates, and the ones
// tied to a moment (plans, things that happened) show the day they were noted.

import type { CharacterMemoryItem, CharacterMemoryKind } from './characterMemoryTypes';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** "11月6日" in local time. */
export function formatMemoryDay(ms: number) {
  const date = new Date(ms);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** "11月9日 周一". */
export function describeMemoryToday(now: number) {
  return `${formatMemoryDay(now)} 周${WEEKDAYS[new Date(now).getDay()]}`;
}

/** For every prompt that writes memories. */
export const MEMORY_DATE_RULE = '写到时间就写具体日期（如“11月7日下午”），不要写今天、明天、昨天、下周这类说法（今天是 today，每句对话带着它的 date）。';

/** Plans and happenings depend on when they were said; who the user is does not. */
export function isTimeBoundMemoryKind(kind: CharacterMemoryKind) {
  return kind === 'promise' || kind === 'event';
}

/** One memory as the reply sees it; plans and happenings carry the day they were noted. */
export function formatMemoryLineForPrompt(item: Pick<CharacterMemoryItem, 'kind' | 'text' | 'updatedAt'>) {
  return isTimeBoundMemoryKind(item.kind) && item.updatedAt > 0
    ? `- ${item.text}（${formatMemoryDay(item.updatedAt)}记下的）`
    : `- ${item.text}`;
}

/** The day of a chat message for the extraction prompts ('' when it has no time). */
export function messageDay(createdAt: number | undefined) {
  return typeof createdAt === 'number' && createdAt > 0 ? formatMemoryDay(createdAt) : '';
}
