import { useEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import { EmbeddedPetChatPanelSurface } from './EmbeddedPetChatPanelSurface';
import { type EmbeddedPetChatPanelProps } from './embeddedPetChatPanelTypes';
import { capturePetChatScrollPosition } from './usePetChatConversationAutoScroll';

type EmbeddedPetChatFrameMode = 'normal' | 'minimized';

export default function EmbeddedPetChatPanel({
  isOpen,
  offset,
  position,
  ...surfaceProps
}: EmbeddedPetChatPanelProps) {
  const [frameMode, setFrameMode] = useState<EmbeddedPetChatFrameMode>('normal');
  const isMinimized = frameMode === 'minimized';

  useEffect(() => {
    if (!isOpen) {
      setFrameMode('normal');
    }
  }, [isOpen]);

  const panelStyle = {
    left: position.x + offset.x,
    top: position.y + offset.y,
  } as CSSProperties;

  const handleToggleMinimized = () => {
    if (frameMode === 'normal') {
      capturePetChatScrollPosition(`embedded:${surfaceProps.chatMode}`);
    }
    setFrameMode((currentMode) => (currentMode === 'minimized' ? 'normal' : 'minimized'));
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-desktop-pet-interactive="true"
          data-desktop-pet-window-shape="true"
          data-desktop-pet-native-scope="pet"
          className="absolute z-50 pointer-events-auto"
          style={panelStyle}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <EmbeddedPetChatPanelSurface
            {...surfaceProps}
            isMinimized={isMinimized}
            onToggleMinimized={handleToggleMinimized}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
