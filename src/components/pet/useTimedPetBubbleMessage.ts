import { useEffect, useState } from 'react';

const DEFAULT_PET_BUBBLE_IDLE_HIDE_DELAY_MS = 20_000;

interface TimedPetBubbleMessageOptions {
  activeMessage?: string;
  hideDelayMs?: number;
  isActive?: boolean;
  latestMessage?: string;
  typingMessage?: string;
}

export function useTimedPetBubbleMessage({
  activeMessage = '',
  hideDelayMs = DEFAULT_PET_BUBBLE_IDLE_HIDE_DELAY_MS,
  isActive = false,
  latestMessage = '',
  typingMessage = '\u6B63\u5728\u601D\u8003...',
}: TimedPetBubbleMessageOptions) {
  const trimmedActiveMessage = activeMessage.trim();
  const trimmedLatestMessage = latestMessage.trim();
  const [visibleLatestMessage, setVisibleLatestMessage] = useState(trimmedLatestMessage);

  useEffect(() => {
    if (trimmedLatestMessage) {
      setVisibleLatestMessage(trimmedLatestMessage);
      return;
    }

    setVisibleLatestMessage('');
  }, [trimmedLatestMessage]);

  useEffect(() => {
    if (isActive || trimmedActiveMessage || !visibleLatestMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setVisibleLatestMessage('');
    }, hideDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hideDelayMs, isActive, trimmedActiveMessage, visibleLatestMessage]);

  if (trimmedActiveMessage) {
    return trimmedActiveMessage;
  }

  if (isActive) {
    return typingMessage;
  }

  return visibleLatestMessage;
}
