import assert from 'node:assert/strict';
import { type ConversationCaptureHandlers } from '../src/voice/conversationCapture';
import { CONVERSATION_RESUME_GRACE_MS, createVoiceConversationSession } from '../src/components/chat/voiceConversationSession';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

// Manual clock so grace and idle timers are deterministic.
let now = 0;
let nextId = 1;
const timers = new Map<number, { at: number; callback: () => void }>();
const setTimer = (callback: () => void, ms: number) => { const id = nextId++; timers.set(id, { at: now + ms, callback }); return id; };
const clearTimer = (id: number) => { timers.delete(id); };
function advance(ms: number) {
  const target = now + ms;
  for (;;) {
    const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    timers.delete(due[0]);
    now = due[1].at;
    due[1].callback();
  }
  now = target;
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(idleTimeoutMs = 60000) {
  let busy = false;
  let busyListener: (() => void) | null = null;
  let handlers: ConversationCaptureHandlers | null = null;
  const capture = { paused: false, stopped: false };
  const log = { listening: [] as boolean[], sent: [] as string[], ended: [] as string[], recognized: 0 };
  const session = createVoiceConversationSession({
    startCapture: async (h) => {
      handlers = h;
      return {
        pause: () => { capture.paused = true; },
        resume: () => { capture.paused = false; },
        isPaused: () => capture.paused,
        stop: async () => { capture.stopped = true; },
      };
    },
    recognize: async (audio) => {
      log.recognized += 1;
      if (audio.startsWith('crash')) throw new Error('STT worker unavailable');
      if (audio === 'silence') return '';
      if (audio === 'noise') return '。';
      return `heard:${audio}`;
    },
    send: async (text) => {
      log.sent.push(text);
      if (text.includes('reply-error')) throw new Error('模型只输出了内部推理，没有生成最终回复');
    },
    isBusy: () => busy,
    subscribeBusy: (listener) => { busyListener = listener; return () => { busyListener = null; }; },
    onListeningChange: (listening) => log.listening.push(listening),
    onEnd: (reason) => log.ended.push(reason),
    idleTimeoutMs,
    setTimer,
    clearTimer,
    now: () => now,
  });
  const setBusy = (value: boolean) => { busy = value; busyListener?.(); };
  return { session, capture, log, setBusy, handlers: () => handlers as ConversationCaptureHandlers };
}

(async () => {
  const a = setup();
  check(await a.session.start(), true, 'starts');
  check([a.capture.paused, a.log.listening.at(-1)], [false, true], 'listening right away when pet is idle');

  a.handlers().onUtterance('hello', 1200);
  await flush();
  check(a.log.sent, ['heard:hello'], 'utterance recognized and sent');

  a.setBusy(true); // reply generating / speaking / queued synthesis
  check([a.capture.paused, a.log.listening.at(-1)], [true, false], 'mic paused (and shown off) while pet has the floor');
  a.handlers().onUtterance('echo-of-pet', 800);
  await flush();
  check(a.log.sent, ['heard:hello'], 'audio arriving while busy is dropped');

  a.setBusy(false);
  advance(CONVERSATION_RESUME_GRACE_MS - 1);
  check(a.capture.paused, true, 'still paused inside the grace window');
  a.setBusy(true); // next queued sentence starts within the grace window
  advance(10);
  check(a.capture.paused, true, 'grace cancelled when pet resumes speaking');
  a.setBusy(false);
  advance(CONVERSATION_RESUME_GRACE_MS);
  check([a.capture.paused, a.log.listening.at(-1)], [false, true], 'resumes after the grace window');

  a.handlers().onUtterance('silence', 900);
  await flush();
  check(a.log.sent.length, 1, 'empty recognition sends nothing');

  a.handlers().onUtterance('noise', 900);
  await flush();
  check(a.log.sent.length, 1, 'punctuation-only recognition (noise) is not sent');

  // Idle timeout: only recognizable speech or the pet's turn restarts the window; noise does not.
  const b = setup(5000);
  await b.session.start();
  advance(4000);
  b.handlers().onUtterance('hi', 900);
  await flush();
  advance(4000);
  check(b.log.ended, [], 'real speech restarted the idle window');
  b.setBusy(true);
  advance(20000);
  check(b.log.ended, [], 'idle timer frozen while pet speaks');
  b.setBusy(false);
  advance(CONVERSATION_RESUME_GRACE_MS + 4000);
  check(b.log.ended, [], 'pet finishing her turn gives a fresh window');
  b.handlers().onUtterance('noise', 900);
  await flush();
  b.handlers().onUtterance('silence', 900);
  await flush();
  advance(CONVERSATION_RESUME_GRACE_MS + 1000);
  check([b.log.ended, b.capture.stopped, b.session.isActive()], [['idle'], true, false], 'noise does not keep the mic open');

  // Manual stop.
  const c = setup();
  await c.session.start();
  c.session.stop('user');
  check([c.log.ended, c.capture.stopped, c.log.listening.at(-1)], [['user'], true, false], 'user stop');
  c.session.stop('user');
  check(c.log.ended, ['user'], 'stop is idempotent');

  // Recognition that keeps failing ends the session instead of "listening" forever.
  const d = setup();
  await d.session.start();
  d.handlers().onUtterance('crash-1', 900);
  await flush();
  check([d.session.isActive(), d.log.ended], [true, []], 'one failure keeps listening');
  d.handlers().onUtterance('ok', 900);
  await flush();
  d.handlers().onUtterance('crash-2', 900);
  await flush();
  check(d.session.isActive(), true, 'a success resets the failure count');
  d.handlers().onUtterance('crash-3', 900);
  await flush();
  check([d.session.isActive(), d.log.ended, d.capture.stopped], [false, ['error'], true], 'two consecutive failures stop with error');

  // A failing reply (LLM error) is not a recognition failure and must not close the mic.
  const e = setup();
  await e.session.start();
  e.handlers().onUtterance('reply-error-1', 900);
  await flush();
  e.handlers().onUtterance('reply-error-2', 900);
  await flush();
  e.handlers().onUtterance('reply-error-3', 900);
  await flush();
  check([e.session.isActive(), e.log.ended, e.log.sent.length], [true, [], 3], 'reply errors keep the conversation open');

  console.log(`voice conversation session passed: ${cases} cases`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
