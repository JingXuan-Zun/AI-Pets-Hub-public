import { desktopPetChatStore } from '../../chatStore';

export function publishChatStatusMessage(
  message: string,
  onStatusMessage?: (message: string) => void,
) {
  const nextMessage = message.trim();
  desktopPetChatStore.setStatusMessage(nextMessage);
  onStatusMessage?.(nextMessage);
}
