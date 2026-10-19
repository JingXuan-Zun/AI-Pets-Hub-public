import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { subscribePrimaryPetDragPreviewOffset } from '../pet/primaryPetDragPreviewOffset';
import { useTimedPetBubbleMessage } from '../pet/useTimedPetBubbleMessage';
import { type PetChatOverlayBubbleProps } from './petChatOverlayTypes';
import {
  PET_SPEECH_BUBBLE_FRAME_CLASS,
  PET_SPEECH_BUBBLE_MOTION,
  PetSpeechBubbleCard,
} from './PetSpeechBubbleCard';

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

  // 拖动桌宠时正式位置要到松手才更新；这里直接平移外层容器，让气泡实时跟着桌宠走。
  const followLayerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => subscribePrimaryPetDragPreviewOffset((offset) => {
    const followLayer = followLayerRef.current;
    if (!followLayer) return;
    followLayer.style.translate = offset ? `${offset.x}px ${offset.y}px` : '';
  }), []);

  if (!chatBubbleEnabled) return null;

  return (
    <div ref={followLayerRef} className="pointer-events-none absolute inset-0 z-30">
    <AnimatePresence>
      {chatBubbleEnabled && displayMessage && (
        <motion.div
          data-desktop-pet-interactive="true"
          data-desktop-pet-window-shape="true"
          {...PET_SPEECH_BUBBLE_MOTION}
          className={PET_SPEECH_BUBBLE_FRAME_CLASS}
          style={{
            bottom: `calc(100% - ${bubbleBottomY}px)`,
            left: petAnchorPosition.x,
            color: chatBracketOuterTextColor,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <PetSpeechBubbleCard text={displayMessage} textColor={chatBracketOuterTextColor} />
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
