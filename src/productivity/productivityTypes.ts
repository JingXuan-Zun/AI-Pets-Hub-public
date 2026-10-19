// Reminders, a pomodoro timer and a todo list: the first feature built on the platform
// capability layer. The character manages them from conversation; due items are spoken by
// the current character with a bubble (and voice when it is on).

export type ReminderRepeat = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface ReminderItem {
  createdAt: number;
  /** Local time in ms when it is due next. */
  dueAt: number;
  id: string;
  repeat: ReminderRepeat;
  text: string;
}

export interface TodoItem {
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  id: string;
  text: string;
}

export type PomodoroPhase = 'idle' | 'focus' | 'break';

export interface PomodoroState {
  breakMinutes: number;
  /** Finished focus sessions today, for a little encouragement. */
  completedToday: number;
  completedTodayDate: string;
  focusMinutes: number;
  phase: PomodoroPhase;
  /** When the current phase ends; null when idle. */
  phaseEndsAt: number | null;
  /** What the user is focusing on, if they said. */
  task: string;
}

export interface ProductivitySettings {
  pomodoro: PomodoroState;
  reminders: ReminderItem[];
  todos: TodoItem[];
}
