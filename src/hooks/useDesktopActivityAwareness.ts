import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { isLifeCompanionQuietHour } from '../life-companion/lifeCompanionScheduler';
import {
  classifyLifeCompanionActivity,
  isDesktopPetForeground,
  type LifeCompanionActivityKind,
} from '../life-companion/screen-watch/lifeCompanionActivity';
import { postCompanionLine, requestActivityLine } from '../life-companion/screen-watch/screenWatchComment';
import { screenWatchStore } from '../life-companion/screen-watch/screenWatchStore';
import type { PetConfig } from '../types';

const POLL_INTERVAL_MS = 30_000;
// The same activity must still be in front on the next poll, so a quick alt-tab is ignored.
const STABLE_POLLS = 2;
// After a "no", the character waits this long before asking to watch again.
const ASK_AGAIN_AFTER_DECLINE_MS = 2 * 60 * 60 * 1000;

/**
 * Rough awareness: notices from the foreground app what the user is roughly doing and
 * opens a conversation in the character's voice. It reads only the app name and window
 * title; looking at the screen is the separate, consent-based screen watch.
 */
export function useDesktopActivityAwareness(configRef: MutableRefObject<PetConfig>) {
  const lastKindRef = useRef<LifeCompanionActivityKind | null>(null);
  const stableCountRef = useRef(0);
  const lastLineAtRef = useRef(0);
  useEffect(() => {
    let disposed = false;
    let busy = false;
    const poll = async () => {
      const settings = configRef.current.settings.lifeCompanion;
      // Watching already comments on what it sees; quiet hours mean no interruptions.
      if (busy || !settings.desktopActivityAwarenessEnabled || settings.screenWatchConsented || isLifeCompanionQuietHour(settings)) return;
      const result = await desktopPetShellRuntime.listRunningApps({ includeWindows: true }) as {
        ok?: boolean;
        activeWindow?: { processName?: string; title?: string } | null;
      };
      if (disposed || !result.ok) return;
      const processName = result.activeWindow?.processName ?? '';
      const title = result.activeWindow?.title ?? '';
      const activity = isDesktopPetForeground(processName, title) ? null : classifyLifeCompanionActivity(processName, title);
      if (!activity) { stableCountRef.current = 0; lastKindRef.current = null; return; }
      if (lastKindRef.current === activity.kind) stableCountRef.current += 1;
      else { lastKindRef.current = activity.kind; stableCountRef.current = 1; }
      const cooldownMs = settings.desktopActivityAwarenessIntervalMinutes * 60 * 1000;
      if (stableCountRef.current < STABLE_POLLS || Date.now() - lastLineAtRef.current < cooldownMs) return;
      const chat = desktopPetChatStore.getState();
      if (chat.isTyping || chat.isSpeaking || chat.chatMode !== 'single') return;
      const watch = screenWatchStore.getState();
      const askToWatch = !watch.asking && Date.now() - watch.declinedAt > ASK_AGAIN_AFTER_DECLINE_MS;
      busy = true;
      lastLineAtRef.current = Date.now();
      try {
        const line = await requestActivityLine(configRef.current, activity, askToWatch);
        if (!disposed && postCompanionLine(configRef.current, line) && askToWatch) screenWatchStore.setState({ asking: true });
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    void poll();
    return () => { disposed = true; window.clearInterval(timer); };
  }, [configRef]);
}
