import { type PetVisualBounds } from './petVisualBounds';
import { resolvePetInteractiveHitAreaStyle } from './petInteractiveHitArea';

type PetDebugBoundsKind = 'clamp' | 'collision';

interface PetDebugBoundsOverlayProps {
  bounds?: PetVisualBounds | null;
  kind: PetDebugBoundsKind;
  label: string;
  shellSize: number;
}

export function PetDebugBoundsOverlay({
  bounds = null,
  kind,
  label,
  shellSize,
}: PetDebugBoundsOverlayProps) {
  const style = resolvePetInteractiveHitAreaStyle(shellSize, bounds);
  if (!style) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-desktop-pet-debug-box={label}
      data-desktop-pet-debug-box-kind={kind}
      className="pointer-events-none absolute"
      style={style}
    />
  );
}
