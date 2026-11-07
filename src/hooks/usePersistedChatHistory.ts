import { useEffect, useState } from 'react';
import { desktopPetChatStore } from '../chatStore';
import {
  loadPersistedChatHistory,
  persistChatHistory,
  restorePersistedChatHistory,
} from '../persistentChatHistory';

const CHAT_HISTORY_SAVE_DELAY_MS = 400;

/** Older full-size screenshots in the saved history become smaller JPEGs, one message at a time. */
async function compressLargeHistoryImages(isDisposed: () => boolean) {
  const { compressImageAttachment, hasLargeInlineImage } = await import('../services/chatImageCompression');
  const ids = desktopPetChatStore.getState().messages.filter(hasLargeInlineImage).map((message) => message.id).filter(Boolean) as string[];
  for (const id of ids) {
    if (isDisposed()) return;
    const message = desktopPetChatStore.getState().messages.find((item) => item.id === id);
    if (!message?.attachments) continue;
    const attachments = await Promise.all(message.attachments.map(compressImageAttachment));
    if (attachments.some((item, index) => item !== message.attachments?.[index])) {
      desktopPetChatStore.updateMessage(id, (current) => ({ ...current, attachments }));
    }
  }
}

export function usePersistedChatHistory() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let saveTimer: number | null = null;
    let latestMessages = desktopPetChatStore.getState().messages;
    let lastSavedSerialized: string | null = null;
    let unsubscribe = () => undefined;

    // The chat store emits for every field (typing, speech, animation state…);
    // only write when the persisted messages themselves changed.
    const saveLatestMessages = () => {
      saveTimer = null;
      const serialized = JSON.stringify(latestMessages);
      if (serialized === lastSavedSerialized) return;
      lastSavedSerialized = serialized;
      void persistChatHistory(latestMessages).then((saved) => {
        if (!saved && lastSavedSerialized === serialized) lastSavedSerialized = null;
      });
    };
    const scheduleSave = () => {
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveLatestMessages, CHAT_HISTORY_SAVE_DELAY_MS);
    };
    const onPageHide = () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
      }
      saveLatestMessages();
    };

    void loadPersistedChatHistory()
      .then((messages) => {
        if (disposed) return;
        restorePersistedChatHistory(messages);
        // A task card saved mid-task (app closed or reloaded) would show 进行中 forever.
        void import('../components/chat/runController/conversationTaskCard')
          .then((taskCard) => taskCard.settleOrphanedTaskCards())
          .catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => {
        if (disposed) return;
        latestMessages = desktopPetChatStore.getState().messages;
        lastSavedSerialized = JSON.stringify(latestMessages);
        unsubscribe = desktopPetChatStore.subscribe(() => {
          const nextMessages = desktopPetChatStore.getState().messages;
          if (nextMessages === latestMessages) return;
          latestMessages = nextMessages;
          scheduleSave();
        });
        window.addEventListener('pagehide', onPageHide);
        setIsReady(true);
        void compressLargeHistoryImages(() => disposed);
      });

    return () => {
      disposed = true;
      unsubscribe();
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  return isReady;
}
