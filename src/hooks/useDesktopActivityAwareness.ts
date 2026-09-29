import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import type { PetConfig } from '../types';
import { createChatMessageId } from '../components/chat/multiPetChat';

type ActivityKind = 'browser' | 'office' | 'video';

function classifyProcess(processName: string, title: string): ActivityKind | null {
  const value = `${processName} ${title}`.toLowerCase();
  if (/(chrome|msedge|firefox|brave|opera|browser)/u.test(value)) return 'browser';
  if (/(word|excel|powerpnt|outlook|libreoffice|wps|notion|写字板)/u.test(value)) return 'office';
  if (/(vlc|potplayer|mpv|netflix|youtube|bilibili|视频|电影)/u.test(value)) return 'video';
  return null;
}

const PROMPTS: Record<ActivityKind, string> = {
  browser: '我注意到你正在用浏览器，像是在看点东西。今天在浏览什么内容？',
  office: '看起来你正在处理工作，辛苦了。记得过一会儿喝水、起来活动一下。',
  video: '你现在好像在看视频，最近在看什么有趣的内容？',
};

export function useDesktopActivityAwareness(configRef: MutableRefObject<PetConfig>) {
  const lastKindRef = useRef<ActivityKind | null>(null);
  const stableCountRef = useRef(0);
  const lastPromptAtRef = useRef(0);
  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      const settings = configRef.current.settings.lifeCompanion;
      if (!settings.desktopActivityAwarenessEnabled || !settings.proactiveEnabled) return;
      const result = await desktopPetShellRuntime.listRunningApps({ includeWindows: true }) as {
        ok?: boolean;
        activeWindow?: { processName?: string; title?: string } | null;
      };
      if (disposed || !result.ok) return;
      const active = result.activeWindow;
      const kind = classifyProcess(active?.processName ?? '', active?.title ?? '');
      if (!kind) { stableCountRef.current = 0; lastKindRef.current = null; return; }
      if (lastKindRef.current === kind) stableCountRef.current += 1;
      else { lastKindRef.current = kind; stableCountRef.current = 1; }
      if (stableCountRef.current < 2 || Date.now() - lastPromptAtRef.current < 30 * 60 * 1000) return;
      const state = desktopPetChatStore.getState();
      if (state.isTyping || state.isSpeaking || state.chatMode !== 'single') return;
      desktopPetChatStore.addMessage({
        id: createChatMessageId('activity'), role: 'model', text: PROMPTS[kind],
        chatMode: 'single', petId: state.activePetId, petName: configRef.current.personality.name,
      });
      lastPromptAtRef.current = Date.now();
    };
    const timer = window.setInterval(() => { void poll(); }, 30_000);
    void poll();
    return () => { disposed = true; window.clearInterval(timer); };
  }, [configRef]);
}
