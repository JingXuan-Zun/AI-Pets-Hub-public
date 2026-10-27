import { useEffect, useState } from 'react';
import { normalizeInteractiveDialogueLayout, type InteractiveDialogueLayout } from '../../../interactiveDialogueSettings';

/**
 * 设置窗里拖滑块时，互动对话窗口马上跟着变（还没点保存）。
 *
 * 设置窗的改动在保存前只在设置窗里；两个窗口同源，所以用 localStorage 传“正在预览的值”，
 * 互动对话窗口通过 storage 事件收到。预览带着角色 id：只有正在通话的就是这个角色才用。
 * 离开这个设置页（或关掉设置窗）就清掉，画面回到已保存的值。
 */
const PREVIEW_KEY = 'desktop-pet.interactive-dialogue-preview.v2';

type InteractiveDialoguePreview = { layout: InteractiveDialogueLayout; petId: string };

export function publishInteractiveDialoguePreview(preview: InteractiveDialoguePreview | null) {
  try {
    if (preview) window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(preview));
    else window.localStorage.removeItem(PREVIEW_KEY);
  } catch {
    // 存不下就没有实时预览，保存后照样生效。
  }
}

function readPreview(): InteractiveDialoguePreview | null {
  try {
    const raw = window.localStorage.getItem(PREVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { layout?: unknown; petId?: unknown };
    return typeof parsed.petId === 'string'
      ? { layout: normalizeInteractiveDialogueLayout(parsed.layout), petId: parsed.petId }
      : null;
  } catch {
    return null;
  }
}

/** 正在预览这个角色时用预览值，否则用已保存的摆放。 */
export function useInteractiveDialoguePreview(petId: string, saved: InteractiveDialogueLayout) {
  const [preview, setPreview] = useState<InteractiveDialoguePreview | null>(readPreview);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREVIEW_KEY || event.key === null) setPreview(readPreview());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return preview && preview.petId === petId ? preview.layout : saved;
}
