import * as motion from 'motion/react-m';

interface PetChatConversationActivityStatesProps {
  activePetName: string;
  isListening: boolean;
  isTyping: boolean;
  showStatusMessage: boolean;
  statusMessage: string;
  typingPetName?: string | null;
}

export function PetChatConversationActivityStates({
  activePetName,
  isListening,
  isTyping,
  showStatusMessage,
  statusMessage,
  typingPetName = null,
}: PetChatConversationActivityStatesProps) {
  return (
    <>
      {isTyping && (
        <div className="flex flex-col items-start">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-tighter text-sky-700">
            {typingPetName?.trim() || activePetName}
          </div>
          <div className="rounded-[18px] border border-sky-100/85 bg-[linear-gradient(180deg,rgba(252,254,255,0.94),rgba(239,247,253,0.9))] px-4 py-3">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex gap-1"
            >
              <div className="h-1 w-1 rounded-full bg-primary" />
              <div className="h-1 w-1 rounded-full bg-primary" />
              <div className="h-1 w-1 rounded-full bg-primary" />
            </motion.div>
          </div>
        </div>
      )}
      {isListening && (
        <div className="flex flex-col items-start">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-tighter text-sky-700">VOICE_INPUT</div>
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
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
