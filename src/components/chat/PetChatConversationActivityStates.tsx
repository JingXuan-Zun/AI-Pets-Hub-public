import * as motion from 'motion/react-m';
import { AvatarBadge } from './message/MessageContent';

interface PetChatConversationActivityStatesProps {
  activePetName: string;
  /** 正在输入的角色头像；聊天外观关闭头像时为 null。 */
  typingAvatar?: { url: string; fallbackText: string; size: number } | null;
  isListening: boolean;
  isTyping: boolean;
  showStatusMessage: boolean;
  statusMessage: string;
  typingPetName?: string | null;
}

export function PetChatConversationActivityStates({
  activePetName,
  typingAvatar = null,
  isListening,
  isTyping,
  showStatusMessage,
  statusMessage,
  typingPetName = null,
}: PetChatConversationActivityStatesProps) {
  return (
    <>
      {isTyping && (
        <div
          className="flex items-start gap-2.5 self-start"
          role="status"
          aria-label={`${typingPetName?.trim() || activePetName}正在输入`}
        >
          {typingAvatar ? (
            <AvatarBadge avatarUrl={typingAvatar.url} fallbackText={typingAvatar.fallbackText} size={typingAvatar.size} />
          ) : null}
          <div className="flex h-10 items-center gap-1.5 rounded-[15px] border border-white/80 bg-white/90 px-4 shadow-[0_8px_22px_rgba(158,84,140,0.12)] backdrop-blur-xl">
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="h-1.5 w-1.5 rounded-full bg-primary/70"
                animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      )}
      {isListening && (
        <div className="flex flex-col items-start">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-tighter text-sky-700">VOICE_INPUT</div>
          <div className="rounded-[15px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
            正在听你说话...
          </div>
        </div>
      )}
      {showStatusMessage && statusMessage && (
        <div className="rounded border border-sky-100/80 bg-[linear-gradient(180deg,rgba(250,253,255,0.8),rgba(238,246,253,0.72))] px-3 py-2 text-[10px] text-sky-700">
          {statusMessage}
        </div>
      )}
    </>
  );
}
