import { useEffect, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { resolveLifeCompanionPromptTarget } from '../life-companion/companionLineTarget';
import { postCompanionLine } from '../life-companion/screen-watch/screenWatchComment';
import { getDesktopPetSlot } from '../multiPetRoster';
import type { PetConfig } from '../types';
import { startLiveWatchEars, type LiveWatchEars } from './liveWatchEars';
import { startLiveWatchEyes, type LiveWatchEyes } from './liveWatchEyes';
import {
  buildLiveLineInstruction, cleanLiveLine, isLivePass, isWatchAlongStop, LIVE_WATCH_LIMITS, shouldAsk,
  type LiveHeard, type LiveSeen,
} from './liveWatchRules';
import { liveWatchStore, useLiveWatchState } from './liveWatchStore';

const LINE_TIMEOUT_MS = 30_000;
const RECENT_HISTORY_MESSAGES = 6;
// A forgotten session does not keep looking (and paying for looks) all night.
const MAX_SESSION_MS = 2 * 60 * 60 * 1000;

async function askForLine(config: PetConfig, instruction: string) {
  const target = resolveLifeCompanionPromptTarget(config);
  const slot = getDesktopPetSlot(config, target.petId);
  const history = buildScopedChatHistory(desktopPetChatStore.getState().messages, 'single', target.petId).slice(-RECENT_HISTORY_MESSAGES);
  const { getPetResponseStrict } = await import('../services/geminiService');
  return getPetResponseStrict(history, instruction, slot?.personality ?? config.personality,
    { ...config.settings, webSearchEnabled: false }, 'block', [], AbortSignal.timeout(LINE_TIMEOUT_MS));
}

/** One running session: eyes and ears feed what she knows; she is asked when something new came. */
function runSession(configRef: MutableRefObject<PetConfig>) {
  const startedAt = Date.now();
  const clock = () => (Date.now() - startedAt) / 1000;
  const heard: LiveHeard[] = [];
  const seen: LiveSeen[] = [];
  const said: string[] = [];
  let fresh = false; let asking = false; let lastAskAt = -Infinity; let lastSpokeAt = -Infinity;
  let stopped = false;
  let eyes: LiveWatchEyes | null = null;
  let ears: LiveWatchEars | null = null;

  const maybeAsk = () => {
    const now = clock();
    if (stopped || !shouldAsk({ asking, fresh, lastAskAt, lastSpokeAt, now }, LIVE_WATCH_LIMITS)) return;
    const chat = desktopPetChatStore.getState();
    if (chat.isTyping || chat.isSpeaking) return; // the user and she are talking: watch quietly
    asking = true; fresh = false; lastAskAt = now;
    liveWatchStore.count({ asks: 1 });
    liveWatchStore.setState({ busy: true });
    void askForLine(configRef.current, buildLiveLineInstruction({ heard, now, said, seen }))
      .then((reply) => {
        if (stopped) return;
        if (isLivePass(reply)) { liveWatchStore.count({ passes: 1 }); return; }
        const line = cleanLiveLine(reply);
        if (line && postCompanionLine(configRef.current, line)) {
          said.push(line); lastSpokeAt = clock();
          liveWatchStore.count({ spoken: 1 });
          liveWatchStore.setState({ lastLine: line });
        }
      })
      .catch(() => undefined)
      .finally(() => { asking = false; liveWatchStore.setState({ busy: false }); });
  };
  const keep = <T,>(list: T[], item: T, max: number) => { list.push(item); if (list.length > max) list.shift(); };

  void (async () => {
    [eyes, ears] = await Promise.all([
      startLiveWatchEyes({
        clock, config: () => configRef.current,
        onError: (message) => liveWatchStore.setState({ note: `看画面出错了：${message}` }),
        onSeen: (item) => { liveWatchStore.count({ lastSeen: item.text, looks: 1 }); keep(seen, item, 8); fresh = true; maybeAsk(); },
      }),
      startLiveWatchEars({ clock, config: () => configRef.current, onHeard: (item) => { liveWatchStore.count({ heard: 1, lastHeard: item.text }); keep(heard, item, 12); fresh = true; maybeAsk(); } }),
    ]);
    if (stopped) { eyes?.stop(); ears?.stop(); return; }
    if (!eyes && !ears) {
      liveWatchStore.stop('看不到画面也听不到声音，没法一起看。');
      postCompanionLine(configRef.current, '我这边看不到画面也听不到声音，没法陪你看了。');
      return;
    }
    liveWatchStore.setState({ hearing: Boolean(ears) });
  })();
  const limitTimer = window.setTimeout(() => {
    if (liveWatchStore.stop('看了两个小时，自动停下了。')) postCompanionLine(configRef.current, '看了好久了，我先不看啦，想继续再叫我。');
  }, MAX_SESSION_MS);
  return () => {
    stopped = true;
    window.clearTimeout(limitTimer);
    eyes?.stop(); ears?.stop();
  };
}

/**
 * Watch-along: while a session is on, the character watches and listens with the user and now
 * and then says one short line. Started by the user's words (through the watch_along
 * capability); stopped by the pill under the model or by "不看了".
 */
export function useLiveWatch(configRef: MutableRefObject<PetConfig>) {
  const { active } = useLiveWatchState();
  useEffect(() => (active ? runSession(configRef) : undefined), [active, configRef]);
  useEffect(() => {
    liveWatchStore.setPillStop(() => { if (liveWatchStore.stop()) postCompanionLine(configRef.current, '好，不看啦。'); });
    return () => liveWatchStore.setPillStop(() => { liveWatchStore.stop(); });
  }, [configRef]);
  useEffect(() => {
    let lastSeenId = desktopPetChatStore.getState().messages.at(-1)?.id;
    return desktopPetChatStore.subscribe(() => {
      const latest = desktopPetChatStore.getState().messages.at(-1);
      if (!latest || latest.id === lastSeenId) return;
      lastSeenId = latest.id;
      // Her normal reply answers the user; only the session stops here.
      if (latest.role === 'user' && liveWatchStore.getState().active && isWatchAlongStop(latest.text)) liveWatchStore.stop();
    });
  }, []);
}
