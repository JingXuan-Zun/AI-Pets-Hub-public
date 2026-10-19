import type { ReminderRepeat } from './productivityTypes';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function localDateKey(time: number) {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-10 周五 21:44" — the model resolves "下午三点"/"明天" against this. */
export function formatLocalNow(now: number) {
  const date = new Date(now);
  return `${localDateKey(now)} ${WEEKDAYS[date.getDay()]} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "今天 15:00" / "明天 09:30" / "10月12日 周日 08:00". */
export function formatDueTime(dueAt: number, now: number) {
  const due = new Date(dueAt);
  const clock = `${pad(due.getHours())}:${pad(due.getMinutes())}`;
  const dayDiff = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
    - new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime()) / 86_400_000);
  if (dayDiff === 0) return `今天 ${clock}`;
  if (dayDiff === 1) return `明天 ${clock}`;
  if (dayDiff === 2) return `后天 ${clock}`;
  return `${due.getMonth() + 1}月${due.getDate()}日 ${WEEKDAYS[due.getDay()]} ${clock}`;
}

/**
 * Parses what the model passes: "15:00" (today, or tomorrow when already past),
 * "2026-10-12 08:00", "10-12 08:00" or "10/12 8:00". Returns null when unreadable.
 */
export function parseLocalTime(value: string, now: number): number | null {
  const text = value.trim().replace(/[：]/gu, ':').replace(/\s+/gu, ' ');
  const clockOnly = /^(\d{1,2}):(\d{2})$/u.exec(text);
  if (clockOnly) {
    const hours = Number(clockOnly[1]);
    const minutes = Number(clockOnly[2]);
    if (hours > 23 || minutes > 59) return null;
    const date = new Date(now);
    date.setHours(hours, minutes, 0, 0);
    if (date.getTime() <= now) date.setDate(date.getDate() + 1);
    return date.getTime();
  }
  const dated = /^(?:(\d{4})[-/.])?(\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})$/u.exec(text);
  if (!dated) return null;
  const year = dated[1] ? Number(dated[1]) : new Date(now).getFullYear();
  const [month, day, hours, minutes] = [dated[2], dated[3], dated[4], dated[5]].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) return null;
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (date.getMonth() !== month - 1) return null;
  // "10-12 08:00" already past this year most likely means next year.
  if (!dated[1] && date.getTime() < now - 86_400_000) date.setFullYear(year + 1);
  return date.getTime();
}

/** Next due time of a repeating reminder after it fired (or after a missed stretch). */
export function nextRepeatTime(dueAt: number, repeat: ReminderRepeat, now: number): number | null {
  if (repeat === 'none') return null;
  const date = new Date(dueAt);
  do {
    date.setDate(date.getDate() + (repeat === 'weekly' ? 7 : 1));
    while (repeat === 'weekdays' && (date.getDay() === 0 || date.getDay() === 6)) date.setDate(date.getDate() + 1);
  } while (date.getTime() <= now);
  return date.getTime();
}

export const REPEAT_LABELS: Record<ReminderRepeat, string> = {
  daily: '每天',
  none: '',
  weekdays: '工作日',
  weekly: '每周',
};
