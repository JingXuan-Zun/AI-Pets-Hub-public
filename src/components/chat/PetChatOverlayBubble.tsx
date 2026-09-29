import { AnimatePresence, motion } from 'motion/react';
import { useTimedPetBubbleMessage } from '../pet/useTimedPetBubbleMessage';
import { type PetChatOverlayBubbleProps } from './petChatOverlayTypes';

const OPENING_BRACKETS = new Set(['(', '（', '[', '【']);
const CLOSING_BRACKETS = new Set([')', '）', ']', '】']);

function splitBubbleText(text: string) {
  const parts: Array<{ isBracket: boolean; text: string }> = [];
  let buffer = '';
  let depth = 0;
  const push = (isBracket: boolean) => {
    if (buffer) parts.push({ isBracket, text: buffer });
    buffer = '';
  };
  for (const character of text) {
    if (OPENING_BRACKETS.has(character)) {
      push(depth > 0);
      depth += 1;
      buffer += character;
    } else if (CLOSING_BRACKETS.has(character)) {
      buffer += character;
      push(true);
      depth = Math.max(0, depth - 1);
    } else {
      buffer += character;
    }
  }
  push(depth > 0);
  return parts;
}

export function PetChatOverlayBubble({
  chatBracketOuterTextColor,
  chatBubbleEnabled,
  isPrimaryTyping,
  latestPetMessage,
  petAnchorPosition,
  petVisualBounds,
  webSearchStatusMessage = '',
}: PetChatOverlayBubbleProps) {
  const bubbleGap = 10;
  const bubbleBottomY = Math.round(petAnchorPosition.y - petVisualBounds.top - bubbleGap);
  const displayMessage = useTimedPetBubbleMessage({
    activeMessage: webSearchStatusMessage,
    isActive: isPrimaryTyping,
    latestMessage: latestPetMessage,
  });

  return (
    <AnimatePresence>
      {chatBubbleEnabled && displayMessage && (
        <motion.div
          data-desktop-pet-interactive="true"
          data-desktop-pet-window-shape="true"
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          className="pointer-events-auto absolute z-30 w-72 max-w-[80vw] -translate-x-1/2 overflow-visible rounded-2xl text-center text-sm leading-relaxed"
          style={{
            bottom: `calc(100% - ${bubbleBottomY}px)`,
            left: petAnchorPosition.x,
            color: chatBracketOuterTextColor,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="relative overflow-hidden rounded-2xl">
            <div
              className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words border border-white/80 bg-white/90 px-3 py-2 font-semibold shadow-[0_8px_24px_rgba(15,23,42,0.24)] backdrop-blur-sm [scrollbar-width:thin]"
              style={{ color: chatBracketOuterTextColor }}
              onWheel={(event) => {
                // The overlay sits above the transparent desktop-pet surface;
                // keep wheel input inside the bubble instead of letting the
                // native pet drag/zoom layer consume it.
                event.stopPropagation();
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {splitBubbleText(displayMessage).map((part, index) => (
                <span key={`${index}-${part.text}`} style={part.isBracket ? { color: '#111827' } : undefined}>
                  {part.text}
                </span>
              ))}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/80 bg-white/90"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
