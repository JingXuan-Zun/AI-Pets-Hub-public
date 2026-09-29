import { useEffect, useState } from 'react';
import { desktopPetChatStore } from '../chatStore';
import {
  loadPersistedChatHistory,
  persistChatHistory,
  restorePersistedChatHistory,
} from '../persistentChatHistory';

const CHAT_HISTORY_SAVE_DELAY_MS = 400;

export function usePersistedChatHistory() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let saveTimer: number | null = null;
    let latestMessages = desktopPetChatStore.getState().messages;
    let unsubscribe = () => undefined;

    const saveLatestMessages = () => {
      saveTimer = null;
      void persistChatHistory(latestMessages);
    };
    const scheduleSave = () => {
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveLatestMessages, CHAT_HISTORY_SAVE_DELAY_MS);
    };
    const onPageHide = () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      void persistChatHistory(latestMessages);
    };

    void loadPersistedChatHistory()
      .then((messages) => {
        if (disposed) return;
        restorePersistedChatHistory(messages);
      })
      .catch(() => undefined)
      .finally(() => {
        if (disposed) return;
        latestMessages = desktopPetChatStore.getState().messages;
        unsubscribe = desktopPetChatStore.subscribe(() => {
          latestMessages = desktopPetChatStore.getState().messages;
          scheduleSave();
        });
        window.addEventListener('pagehide', onPageHide);
        setIsReady(true);
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
