// Time in the chat history (2026-11-10). The history used to reach the model as bare text, so
// yesterday's messages, task cards included ("【任务记录】打开 WeGame…：已完成"), looked like they
// had just happened: after the computer was turned off and on she kept talking as if yesterday's
// windows were still open. Long gaps now get a time mark, task cards from before a gap or before
// this launch say they are old, and a note tells her how long it has been and that the computer
// was restarted.

import type { ChatMessage } from '../../types';

/** A gap at least this long (or a new day) gets a time mark. */
export const HISTORY_GAP_MS = 3 * 60 * 60 * 1000;
const TASK_RECORD = /^【任务记录】/u;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dayKey(time: number) {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** “今天 09:12” / “昨天 15:10” / “11月8日 15:10”. */
export function formatHistoryWhen(time: number, now: number) {
  const date = new Date(time);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (dayKey(time) === dayKey(now)) return `今天 ${clock}`;
  if (dayKey(time) === dayKey(now - 24 * 60 * 60 * 1000)) return `昨天 ${clock}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
}

/** “5 小时” / “2 天”. */
export function formatHistoryGap(ms: number) {
  const hours = Math.max(1, Math.round(ms / (60 * 60 * 1000)));
  return hours < 24 ? `${hours} 小时` : `${Math.round(hours / 24)} 天`;
}

function isLongGap(earlier: number, later: number) {
  return later - earlier >= HISTORY_GAP_MS || dayKey(earlier) !== dayKey(later);
}

export interface HistoryTimeline {
  messages: ChatMessage[];
  /** For her inner note (system prompt); empty when nothing needs saying. */
  note: string;
}

/**
 * Marks gaps in the history her reply is based on. `appStartedAt` is when this run of the app
 * began: anything before it happened before the computer / app was closed and opened again.
 */
export function annotateHistoryTimeline(history: ChatMessage[], options: { appStartedAt: number; now: number }): HistoryTimeline {
  const { appStartedAt, now } = options;
  let marked = false;
  let previous: number | null = null;
  const messages = history.map((message) => {
    const time = typeof message.createdAt === 'number' && message.createdAt > 0 ? message.createdAt : null;
    if (time === null) return message;
    let text = message.text ?? '';
    // A task card from before a long gap or before this launch is a record, not something running.
    if (TASK_RECORD.test(text) && (time < appStartedAt || isLongGap(time, now))) {
      text = text.replace(TASK_RECORD, `【以前的任务记录 · ${formatHistoryWhen(time, now)}】`);
    }
    if (previous !== null && isLongGap(previous, time)) {
      const restarted = previous < appStartedAt && time >= appStartedAt;
      text = `［${formatHistoryWhen(time, now)} · 距上一条 ${formatHistoryGap(time - previous)}${restarted ? ' · 中间桌宠重启过' : ''}］\n${text}`;
      marked = true;
    }
    previous = time;
    return text === message.text ? message : { ...message, text };
  });

  const lines: string[] = [];
  if (previous !== null) {
    const last = previous;
    if (last < appStartedAt) {
      lines.push(`你们上一次说话是${formatHistoryWhen(last, now)}（隔了 ${formatHistoryGap(now - last)}）。这之后桌宠关过、重新打开过（${formatHistoryWhen(appStartedAt, now)} 打开，电脑可能也关过）：之前说到的窗口、程序、正在做的任务都不一定还在，需要时先重新看一眼，不要当成还开着、还在进行。`);
    } else if (isLongGap(last, now)) {
      lines.push(`你们上一次说话是${formatHistoryWhen(last, now)}（隔了 ${formatHistoryGap(now - last)}）。之前说到的电脑状态（窗口、程序、任务）可能已经变了，需要时先重新看一眼。`);
    }
  }
  if (marked) lines.push('聊天记录里“［…］”是系统加的时间标记，告诉你两段对话之间隔了多久；你回复时不要写这种标记。');
  return { messages, note: lines.join('\n') };
}

let appStartedAt: number | null = null;

/** When this run of the app began: from the main process (a window may open later), else the page load. */
export function readAppStartedAt() {
  if (appStartedAt !== null) return appStartedAt;
  let fromMain = 0;
  try {
    fromMain = typeof window === 'undefined' ? 0 : Number(window.desktopPetShell?.appStartedAt?.()) || 0;
  } catch {
    fromMain = 0;
  }
  const origin = typeof performance !== 'undefined' ? performance.timeOrigin : NaN;
  appStartedAt = fromMain > 0 ? fromMain : Number.isFinite(origin) && origin > 0 ? origin : Date.now();
  return appStartedAt;
}
