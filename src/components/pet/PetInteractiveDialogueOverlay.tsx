import { type CSSProperties } from 'react';

interface PetInteractiveDialogueOverlayProps {
  interactiveDialogueStageFrame: CSSProperties;
  isVisible: boolean;
}

export function PetInteractiveDialogueOverlay({
  interactiveDialogueStageFrame,
  isVisible,
}: PetInteractiveDialogueOverlayProps) {
  void interactiveDialogueStageFrame;

  if (!isVisible) {
    return null;
  }

  return (
    <div data-desktop-pet-window-shape="full-window" className="pointer-events-none absolute inset-0 z-[18]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_55%,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_28%,rgba(6,23,38,0.16)_62%,rgba(6,23,38,0.28))]" />
    </div>
  );
}
