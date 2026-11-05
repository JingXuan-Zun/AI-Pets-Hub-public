import { useSyncExternalStore } from 'react';
import { emitAppEvent, type BackgroundTaskEnd } from '../../events/appEvents';

// Long jobs (drawing with ComfyUI takes minutes) run here instead of inside her reply, so she
// can keep talking meanwhile. The tool that starts one returns at once; when the job ends the
// starter's `onEnd` presents the result and she says it. One job of a kind at a time: a
// second drawing while one runs is refused, and she can cancel the first.

export interface BackgroundTaskOutcome {
  ok: boolean;
  /** Plain-language result for her to relay ("画好了…" / the reason it failed). */
  text: string;
}

export interface BackgroundTaskInfo {
  id: string;
  kind: string;
  petId: string | null;
  startedAt: number;
  title: string;
}

interface RunningTask extends BackgroundTaskInfo {
  controller: AbortController;
}

let running: RunningTask[] = [];
let snapshot: BackgroundTaskInfo[] = [];
const storeListeners = new Set<() => void>();

function publish() {
  snapshot = running.map(({ id, kind, petId, startedAt, title }) => ({ id, kind, petId, startedAt, title }));
  [...storeListeners].forEach((listener) => listener());
}

export function listBackgroundTasks(): BackgroundTaskInfo[] {
  return snapshot;
}

export function subscribeBackgroundTasks(listener: () => void) {
  storeListeners.add(listener);
  return () => { storeListeners.delete(listener); };
}

export function useBackgroundTasks() {
  return useSyncExternalStore(subscribeBackgroundTasks, listBackgroundTasks, listBackgroundTasks);
}

/** For her prompt: what she is doing in the background right now, so she can talk about it. */
export function describeBackgroundTasksForPrompt(now = Date.now()) {
  if (!running.length) return '';
  const lines = running.map((task) => `- ${task.title}（已经 ${Math.max(1, Math.round((now - task.startedAt) / 1000))} 秒）`);
  return [
    '【你正在后台做的事】',
    ...lines,
    '这些事做完时会自动把结果发出来并告诉用户，现在照常聊天就好；用户问起就说进度，想停就用取消后台任务的工具。不要再为同一件事重复调用工具。',
  ].join('\n');
}

let nextId = 1;

/**
 * Starts a job and returns at once. `run` gets an abort signal (cancel) and may report
 * progress; `onEnd` is called once with how it ended (also when cancelled).
 */
export function startBackgroundTask(options: {
  kind: string;
  onEnd: (outcome: BackgroundTaskOutcome & { status: BackgroundTaskEnd }) => void | Promise<void>;
  petId: string | null;
  run: (signal: AbortSignal, report: (note: string) => void) => Promise<BackgroundTaskOutcome>;
  title: string;
}): { ok: true; task: BackgroundTaskInfo } | { ok: false; busy: BackgroundTaskInfo } {
  const busy = running.find((task) => task.kind === options.kind);
  if (busy) return { busy, ok: false };
  const task: RunningTask = {
    controller: new AbortController(),
    id: `bg-${Date.now().toString(36)}-${nextId++}`,
    kind: options.kind,
    petId: options.petId,
    startedAt: Date.now(),
    title: options.title,
  };
  running = [...running, task];
  publish();
  emitAppEvent({ kind: task.kind, petId: task.petId, taskId: task.id, title: task.title, type: 'task.started' });

  const finish = async (status: BackgroundTaskEnd, text: string) => {
    if (!running.includes(task)) return;
    running = running.filter((entry) => entry !== task);
    publish();
    emitAppEvent({ kind: task.kind, petId: task.petId, status, taskId: task.id, text, title: task.title, type: 'task.ended' });
    try {
      await options.onEnd({ ok: status === 'done', status, text });
    } catch (error) {
      console.error('[background-task] onEnd failed', error);
    }
  };
  const report = (note: string) => emitAppEvent({ note, taskId: task.id, type: 'task.progress' });
  // A cancel ends it at once, even if the job itself takes a moment to notice.
  task.controller.signal.addEventListener('abort', () => { void finish('cancelled', '已经取消了。'); }, { once: true });
  void options.run(task.controller.signal, report).then(
    (outcome) => finish(task.controller.signal.aborted ? 'cancelled' : outcome.ok ? 'done' : 'failed', outcome.text),
    (error) => finish(task.controller.signal.aborted ? 'cancelled' : 'failed', error instanceof Error ? error.message : String(error)),
  );
  return { ok: true, task: { id: task.id, kind: task.kind, petId: task.petId, startedAt: task.startedAt, title: task.title } };
}

/** Stops a job (all jobs of a kind when no id); returns the titles that were stopped. */
export function cancelBackgroundTasks(filter: { id?: string; kind?: string } = {}) {
  const stopped = running.filter((task) => (!filter.id || task.id === filter.id) && (!filter.kind || task.kind === filter.kind));
  stopped.forEach((task) => task.controller.abort());
  return stopped.map((task) => task.title);
}
