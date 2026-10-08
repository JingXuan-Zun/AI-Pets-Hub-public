import { useEffect, useRef, type MutableRefObject, type SetStateAction } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { isLifeCompanionQuietHour } from '../life-companion/lifeCompanionScheduler';
import {
  classifyLifeCompanionActivity,
  isDesktopPetForeground,
  lifeCompanionActivityKey,
} from '../life-companion/screen-watch/lifeCompanionActivity';
import { postCompanionLine } from '../life-companion/screen-watch/screenWatchComment';
import { runScreenWatchLook } from '../life-companion/screen-watch/screenWatchLook';
import { isScreenWatchAcceptance, isScreenWatchRefusal } from '../life-companion/screen-watch/screenWatchRefusal';
import { screenWatchStore } from '../life-companion/screen-watch/screenWatchStore';
import type { PetConfig } from '../types';

const POLL_INTERVAL_MS = 15_000;

/**
 * From the user's interval: look at least that often, sooner (but not instantly) after
 * a window switch, and speak at most about once per interval.
 */
export function screenWatchGaps(intervalSeconds: number) {
  const interval = intervalSeconds * 1000;
  return { comment: Math.min(interval, 3 * 60 * 1000), maxLook: interval, minLook: Math.min(interval, Math.max(20_000, interval * 0.4)) };
}

type ApplyConfig = (updater: SetStateAction<PetConfig>) => void;

function setConsent(applyConfig: ApplyConfig, consented: boolean) {
  applyConfig((prev) => ({
    ...prev,
    settings: { ...prev.settings, lifeCompanion: { ...prev.settings.lifeCompanion, screenWatchConsented: consented } },
  }));
}

/** Answers from the pill and from chat ("不用看了", or "好呀" right after it asked). */
function useScreenWatchConsent(configRef: MutableRefObject<PetConfig>, applyConfig: ApplyConfig) {
  useEffect(() => {
    const disconnect = (fromChat: boolean) => {
      screenWatchStore.setState({ asking: false, watching: false });
      setConsent(applyConfig, false);
      // From chat, the character's normal reply already answers the user.
      if (!fromChat) postCompanionLine(configRef.current, '好，那我不看啦。');
    };
    const answer = (accepted: boolean) => {
      screenWatchStore.setState(accepted ? { asking: false } : { asking: false, declinedAt: Date.now() });
      if (accepted) setConsent(applyConfig, true);
    };
    screenWatchStore.setActions({ answer, disconnect: () => disconnect(false) });
    let lastSeenId = desktopPetChatStore.getState().messages.at(-1)?.id;
    const unsubscribe = desktopPetChatStore.subscribe(() => {
      const latest = desktopPetChatStore.getState().messages.at(-1);
      if (!latest || latest.id === lastSeenId) return;
      lastSeenId = latest.id;
      if (latest.role !== 'user') return;
      const watching = configRef.current.settings.lifeCompanion.screenWatchConsented;
      const { asking } = screenWatchStore.getState();
      if (isScreenWatchRefusal(latest.text)) {
        if (watching) disconnect(true);
        else if (asking) answer(false);
      } else if (asking && isScreenWatchAcceptance(latest.text)) {
        answer(true);
      }
    });
    return () => { unsubscribe(); screenWatchStore.setActions({ answer: () => undefined, disconnect: () => undefined }); };
  }, [applyConfig, configRef]);
}

/**
 * Consent-based screen watching: once the user agrees, the character keeps an eye on
 * the window in front until the user disconnects (pill under the model, or by chat).
 */
export function useLifeCompanionScreenWatch(options: {
  applyConfig: ApplyConfig;
  configRef: MutableRefObject<PetConfig>;
  consented: boolean;
}) {
  const { applyConfig, configRef, consented } = options;
  const lastLookRef = useRef({ at: 0, commentAt: 0, key: '' });
  useScreenWatchConsent(configRef, applyConfig);
  useEffect(() => { screenWatchStore.setState({ watching: consented }); }, [consented]);
  useEffect(() => {
    if (!consented) return undefined;
    let disposed = false;
    const poll = async () => {
      const settings = configRef.current.settings.lifeCompanion;
      if (screenWatchStore.getState().looking || isLifeCompanionQuietHour(settings)) return;
      const result = await desktopPetShellRuntime.listRunningApps({ includeWindows: true }) as {
        ok?: boolean;
        activeWindow?: { displayId?: string | null; hwnd?: number | null; processName?: string; title?: string } | null;
      };
      const processName = result.activeWindow?.processName ?? '';
      const title = result.activeWindow?.title ?? '';
      if (disposed || !result.ok || isDesktopPetForeground(processName, title)) return;
      const key = lifeCompanionActivityKey({ processName, title });
      const now = Date.now();
      const sinceLook = now - lastLookRef.current.at;
      const gaps = screenWatchGaps(settings.screenWatchIntervalSeconds);
      const due = (key !== lastLookRef.current.key && sinceLook >= gaps.minLook) || sinceLook >= gaps.maxLook;
      const chat = desktopPetChatStore.getState();
      if (!due || chat.isTyping || chat.isSpeaking) return;
      lastLookRef.current = { ...lastLookRef.current, at: now, key };
      screenWatchStore.setState({ looking: true });
      try {
        const look = await runScreenWatchLook({
          activeWindow: { displayId: result.activeWindow?.displayId, hwnd: result.activeWindow?.hwnd, title },
          activity: classifyLifeCompanionActivity(processName, title),
          allowComment: now - lastLookRef.current.commentAt >= gaps.comment,
          config: configRef.current,
        });
        if (disposed) return;
        if (look.status === 'commented') lastLookRef.current.commentAt = Date.now();
        if (look.status === 'commented' || look.status === 'quiet') screenWatchStore.setState({ lastSummary: look.summary });
        if (look.status === 'vision-off') {
          postCompanionLine(configRef.current, '我现在看不到画面呢，视觉识别好像没开，先不看啦。');
          screenWatchStore.setState({ watching: false });
          setConsent(applyConfig, false);
        }
      } catch (error) {
        screenWatchStore.setState({ lastSummary: `这次没看清：${error instanceof Error ? error.message : String(error)}` });
      } finally {
        screenWatchStore.setState({ looking: false });
      }
    };
    const timer = window.setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    void poll();
    return () => { disposed = true; window.clearInterval(timer); };
  }, [applyConfig, configRef, consented]);
}
