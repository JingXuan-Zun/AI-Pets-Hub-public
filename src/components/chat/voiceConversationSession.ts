import { type ConversationCapture, type ConversationCaptureHandlers } from '../../voice/conversationCapture';

// After the pet finishes, wait before listening again so the tail of her voice (and the gap
// before a queued sentence starts) is not taken as the user's turn.
export const CONVERSATION_RESUME_GRACE_MS = 700;

export type VoiceConversationEndReason = 'user' | 'idle' | 'error';

// Noise and breathing often come back as a lone "。" — that is not the user taking a turn.
export function isMeaningfulTranscript(text: string) {
  return /[\p{L}\p{N}]/u.test(text);
}

export interface VoiceConversationSessionDeps {
  startCapture: (handlers: ConversationCaptureHandlers) => Promise<ConversationCapture>;
  recognize: (audioBase64: string) => Promise<string>;
  send: (text: string) => Promise<void>;
  isBusy: () => boolean;
  subscribeBusy: (listener: () => void) => () => void;
  onListeningChange: (listening: boolean) => void;
  onEnd: (reason: VoiceConversationEndReason) => void;
  onRecognitionError?: (error: unknown) => void;
  idleTimeoutMs: number;
  /** Consecutive recognition failures that end the session instead of silently "listening" forever. */
  maxConsecutiveFailures?: number;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (handle: number) => void;
  now?: () => number;
}

// Half-duplex loop: listen → utterance → recognize → send → muted while the pet has the floor →
// listen again; closes itself after idleTimeoutMs without the user saying anything recognizable.
// Only real speech or the pet finishing her turn restarts that window — background noise does not.
export function createVoiceConversationSession(deps: VoiceConversationSessionDeps) {
  const setTimer = deps.setTimer ?? ((callback, ms) => window.setTimeout(callback, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => window.clearTimeout(handle));
  const now = deps.now ?? Date.now;
  let capture: ConversationCapture | null = null;
  let active = false;
  let recognizing = false;
  let resumeTimer: number | null = null;
  let idleTimer: number | null = null;
  let unsubscribe: (() => void) | null = null;
  let consecutiveFailures = 0;
  let idleDeadline = 0;
  let petHadFloor = false;
  const maxFailures = deps.maxConsecutiveFailures ?? 2;

  const clear = (handle: number | null) => {
    if (handle !== null) clearTimer(handle);
    return null;
  };

  function refreshIdleDeadline() {
    idleDeadline = now() + deps.idleTimeoutMs;
  }

  // Counts down only while listening; pausing keeps the remaining time.
  function armIdleTimer() {
    idleTimer = clear(idleTimer);
    idleTimer = setTimer(() => stop('idle'), Math.max(0, idleDeadline - now()));
  }

  function setListening(listening: boolean) {
    if (!capture) return;
    if (listening) {
      capture.resume();
      armIdleTimer();
    } else {
      capture.pause();
      idleTimer = clear(idleTimer);
    }
    deps.onListeningChange(listening);
  }

  function sync() {
    if (!active || !capture) return;
    if (deps.isBusy() || recognizing) {
      if (deps.isBusy()) petHadFloor = true;
      resumeTimer = clear(resumeTimer);
      if (!capture.isPaused()) setListening(false);
      return;
    }
    if (capture.isPaused() && resumeTimer === null) {
      resumeTimer = setTimer(() => {
        resumeTimer = null;
        if (!active || deps.isBusy() || recognizing) return;
        if (petHadFloor) refreshIdleDeadline(); // her turn just ended: the user gets a full window to answer
        petHadFloor = false;
        setListening(true);
      }, CONVERSATION_RESUME_GRACE_MS);
    }
  }

  async function handleUtterance(audioBase64: string) {
    if (!active || deps.isBusy()) return; // never talk over the pet
    recognizing = true;
    sync();
    let text = '';
    try {
      text = (await deps.recognize(audioBase64)).trim();
      consecutiveFailures = 0;
      if (isMeaningfulTranscript(text)) refreshIdleDeadline();
      else text = '';
    } catch (error) {
      if (active) {
        consecutiveFailures += 1;
        deps.onRecognitionError?.(error);
        if (consecutiveFailures >= maxFailures) stop('error');
      }
    }
    try {
      // Reply failures (model errors, empty replies) are reported by the chat flow itself and must not
      // count as recognition failures that would close the mic.
      if (active && text) await deps.send(text);
    } catch {
      // Already surfaced by the send pipeline.
    } finally {
      recognizing = false;
      sync();
    }
  }

  async function start() {
    active = true;
    try {
      const nextCapture = await deps.startCapture({
        onUtterance: (audioBase64) => void handleUtterance(audioBase64),
      });
      if (!active) {
        await nextCapture.stop();
        return false;
      }
      capture = nextCapture;
      capture.pause();
      refreshIdleDeadline();
      unsubscribe = deps.subscribeBusy(sync);
      if (deps.isBusy()) deps.onListeningChange(false);
      else setListening(true);
      return true;
    } catch (error) {
      active = false;
      throw error;
    }
  }

  function stop(reason: VoiceConversationEndReason = 'user') {
    if (!active) return;
    active = false;
    resumeTimer = clear(resumeTimer);
    idleTimer = clear(idleTimer);
    unsubscribe?.();
    unsubscribe = null;
    const current = capture;
    capture = null;
    void current?.stop();
    deps.onListeningChange(false);
    deps.onEnd(reason);
  }

  return { start, stop, isActive: () => active };
}
