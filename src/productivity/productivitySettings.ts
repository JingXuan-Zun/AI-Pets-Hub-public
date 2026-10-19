import type { PomodoroState, ProductivitySettings, ReminderItem, ReminderRepeat, TodoItem } from './productivityTypes';

export const DEFAULT_POMODORO_FOCUS_MINUTES = 25;
export const DEFAULT_POMODORO_BREAK_MINUTES = 5;
const MAX_REMINDERS = 100;
const MAX_TODOS = 200;
const MAX_TEXT_LENGTH = 200;
const REPEATS: ReminderRepeat[] = ['none', 'daily', 'weekdays', 'weekly'];

export const DEFAULT_POMODORO_STATE: PomodoroState = {
  breakMinutes: DEFAULT_POMODORO_BREAK_MINUTES,
  completedToday: 0,
  completedTodayDate: '',
  focusMinutes: DEFAULT_POMODORO_FOCUS_MINUTES,
  phase: 'idle',
  phaseEndsAt: null,
  task: '',
};

export const DEFAULT_PRODUCTIVITY_SETTINGS: ProductivitySettings = {
  pomodoro: DEFAULT_POMODORO_STATE,
  reminders: [],
  todos: [],
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_LENGTH) : '';
}

function time(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function minutes(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 && number <= 240 ? Math.round(number) : fallback;
}

function normalizeReminder(value: unknown): ReminderItem | null {
  const item = record(value);
  const id = text(item.id);
  const body = text(item.text);
  const dueAt = time(item.dueAt);
  if (!id || !body || !dueAt) return null;
  return {
    createdAt: time(item.createdAt) ?? dueAt,
    dueAt,
    id,
    repeat: REPEATS.includes(item.repeat as ReminderRepeat) ? item.repeat as ReminderRepeat : 'none',
    text: body,
  };
}

function normalizeTodo(value: unknown): TodoItem | null {
  const item = record(value);
  const id = text(item.id);
  const body = text(item.text);
  if (!id || !body) return null;
  return {
    createdAt: time(item.createdAt) ?? 0,
    done: item.done === true,
    doneAt: item.done === true ? time(item.doneAt) : null,
    id,
    text: body,
  };
}

export function normalizePomodoroState(value: unknown): PomodoroState {
  const state = record(value);
  const phase = state.phase === 'focus' || state.phase === 'break' ? state.phase : 'idle';
  const phaseEndsAt = phase === 'idle' ? null : time(state.phaseEndsAt);
  return {
    breakMinutes: minutes(state.breakMinutes, DEFAULT_POMODORO_BREAK_MINUTES),
    completedToday: Math.max(0, Math.round(Number(state.completedToday) || 0)),
    completedTodayDate: typeof state.completedTodayDate === 'string' ? state.completedTodayDate : '',
    focusMinutes: minutes(state.focusMinutes, DEFAULT_POMODORO_FOCUS_MINUTES),
    phase: phaseEndsAt ? phase : 'idle',
    phaseEndsAt,
    task: text(state.task),
  };
}

export function normalizeProductivitySettings(value: unknown): ProductivitySettings {
  const settings = record(value);
  return {
    pomodoro: normalizePomodoroState(settings.pomodoro),
    reminders: (Array.isArray(settings.reminders) ? settings.reminders : [])
      .map(normalizeReminder).filter((item): item is ReminderItem => Boolean(item)).slice(0, MAX_REMINDERS),
    todos: (Array.isArray(settings.todos) ? settings.todos : [])
      .map(normalizeTodo).filter((item): item is TodoItem => Boolean(item)).slice(0, MAX_TODOS),
  };
}

export function createProductivityId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export { MAX_REMINDERS, MAX_TODOS };
