import { normalizeProductivitySettings } from './productivitySettings';
import { formatDueTime, localDateKey, nextRepeatTime } from './productivityTime';
import type { ProductivitySettings } from './productivityTypes';

/** How late a reminder may fire (e.g. the app was closed) and still be said as "刚才…". */
const LATE_AFTER_MS = 2 * 60_000;
/** Older than this when the app comes back: dropped quietly instead of announced. */
const STALE_AFTER_MS = 12 * 60 * 60_000;

export type ProductivityEvent =
  | { dueAt: number; kind: 'reminder'; late: boolean; text: string }
  | { completedToday: number; breakMinutes: number; kind: 'focus-end'; task: string }
  | { kind: 'break-end' };

/**
 * What is due at `now`, and the settings after handling it: one-off reminders are removed,
 * repeating ones move to their next time, the pomodoro moves focus → break → idle.
 */
export function collectDueProductivityEvents(raw: unknown, now: number): { changed: boolean; events: ProductivityEvent[]; next: ProductivitySettings } {
  const settings = normalizeProductivitySettings(raw);
  const events: ProductivityEvent[] = [];
  const reminders = settings.reminders.flatMap((item) => {
    if (item.dueAt > now) return [item];
    if (now - item.dueAt <= STALE_AFTER_MS) {
      events.push({ dueAt: item.dueAt, kind: 'reminder', late: now - item.dueAt > LATE_AFTER_MS, text: item.text });
    }
    const nextDue = nextRepeatTime(item.dueAt, item.repeat, now);
    return nextDue ? [{ ...item, dueAt: nextDue }] : [];
  });

  let pomodoro = settings.pomodoro;
  if (pomodoro.phase !== 'idle' && pomodoro.phaseEndsAt && pomodoro.phaseEndsAt <= now) {
    const stale = now - pomodoro.phaseEndsAt > STALE_AFTER_MS;
    if (pomodoro.phase === 'focus') {
      const today = localDateKey(now);
      const completedToday = (pomodoro.completedTodayDate === today ? pomodoro.completedToday : 0) + 1;
      if (!stale) events.push({ breakMinutes: pomodoro.breakMinutes, completedToday, kind: 'focus-end', task: pomodoro.task });
      pomodoro = stale
        ? { ...pomodoro, phase: 'idle', phaseEndsAt: null, task: '' }
        : { ...pomodoro, completedToday, completedTodayDate: today, phase: 'break', phaseEndsAt: now + pomodoro.breakMinutes * 60_000 };
    } else {
      if (!stale) events.push({ kind: 'break-end' });
      pomodoro = { ...pomodoro, phase: 'idle', phaseEndsAt: null, task: '' };
    }
  }

  const changed = reminders.length !== settings.reminders.length
    || reminders.some((item, index) => item.dueAt !== settings.reminders[index]?.dueAt)
    || pomodoro !== settings.pomodoro;
  return { changed, events, next: changed ? { ...settings, pomodoro, reminders } : settings };
}

/** What the character should get across; it says this in its own words. */
export function describeProductivityEvents(events: ProductivityEvent[], now: number) {
  return events.map((event) => {
    if (event.kind === 'reminder') {
      return event.late
        ? `用户之前让你在 ${formatDueTime(event.dueAt, now)} 提醒“${event.text}”，那时没能提醒到，现在补上`
        : `到时间了，提醒用户：${event.text}`;
    }
    if (event.kind === 'focus-end') {
      return `番茄钟专注时间到了${event.task ? `（刚才在做：${event.task}）` : ''}，这是今天第 ${event.completedToday} 个番茄。叫用户休息 ${event.breakMinutes} 分钟，可以起来活动、喝口水`;
    }
    return '番茄钟的休息结束了。问用户要不要开始下一轮专注';
  });
}

/** Used when the model cannot be reached: still says it, plainly. */
export function fallbackProductivityLine(events: ProductivityEvent[]) {
  return events.map((event) => {
    if (event.kind === 'reminder') return event.late ? `刚才该提醒你的：${event.text}。` : `提醒你：${event.text}。`;
    if (event.kind === 'focus-end') return `专注时间到啦，今天第 ${event.completedToday} 个番茄完成，休息 ${event.breakMinutes} 分钟吧。`;
    return '休息结束了，要不要再来一轮专注？';
  }).join('');
}
