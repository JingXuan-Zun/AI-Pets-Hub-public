// One stream of things that happened in the app, for parts that need to react to each other
// without knowing each other: a background task started / made progress / ended, her reply
// finished. Before this, the QQ / WeChat relay had to guess from the order of chat messages
// whether a reply was done (and guessed wrong when a task card or a picture came in between).
// Synchronous and in-memory; nothing is stored.

export type BackgroundTaskEnd = 'done' | 'failed' | 'cancelled';

export type AppEvent =
  | { type: 'task.started'; taskId: string; kind: string; title: string; petId: string | null }
  | { type: 'task.progress'; taskId: string; note: string }
  | { type: 'task.ended'; taskId: string; kind: string; title: string; petId: string | null; status: BackgroundTaskEnd; text: string }
  /** Her reply in the chat is complete (text, voice queued, expressions resolved). */
  | { type: 'reply.finished'; messageId: string; petId: string | null };

type Listener = (event: AppEvent) => void;

const listeners = new Set<Listener>();

export function emitAppEvent(event: AppEvent) {
  [...listeners].forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('[app-events] listener failed', error);
    }
  });
}

export function subscribeAppEvents(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
