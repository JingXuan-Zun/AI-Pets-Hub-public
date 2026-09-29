import { type ComponentProps, type RefObject } from 'react';
import { CompanionPetRuntimeLayer } from './CompanionPetRuntimeLayer';
import { DesktopOrganizationOverlay } from './DesktopOrganizationOverlay';
import { PetAvatarLayer } from './PetAvatarLayer';
import { PetEnvironmentLayer } from './PetEnvironmentLayer';
import { PetInteractiveDialogueOverlay } from './PetInteractiveDialogueOverlay';
import { PetPanelsLayer } from './PetPanelsLayer';

type PetEnvironmentLayerProps = ComponentProps<typeof PetEnvironmentLayer>;
type PetInteractiveDialogueOverlayProps = ComponentProps<typeof PetInteractiveDialogueOverlay>;
type PetPanelsLayerProps = ComponentProps<typeof PetPanelsLayer>;
type PetAvatarLayerProps = ComponentProps<typeof PetAvatarLayer>;
type CompanionPetRuntimeLayerProps = ComponentProps<typeof CompanionPetRuntimeLayer>;
type DesktopOrganizationOverlayProps = ComponentProps<typeof DesktopOrganizationOverlay>;

interface PetContainerSceneProps {
  companionRuntimeLayerItems: CompanionPetRuntimeLayerProps[];
  desktopOrganizationOverlayProps: DesktopOrganizationOverlayProps;
  environmentLayerProps: PetEnvironmentLayerProps;
  interactiveDialogueOverlayProps: PetInteractiveDialogueOverlayProps;
  panelsLayerProps: PetPanelsLayerProps;
  primaryPetAvatarLayerProps: PetAvatarLayerProps;
  sceneRef: RefObject<HTMLDivElement | null>;
}

export function PetContainerScene({
  companionRuntimeLayerItems,
  desktopOrganizationOverlayProps,
  environmentLayerProps,
  interactiveDialogueOverlayProps,
  panelsLayerProps,
  primaryPetAvatarLayerProps,
  sceneRef,
}: PetContainerSceneProps) {
  return (
    <div ref={sceneRef} className="relative h-full w-full overflow-hidden">
      <PetEnvironmentLayer {...environmentLayerProps} />

      <PetInteractiveDialogueOverlay {...interactiveDialogueOverlayProps} />

      <DesktopOrganizationOverlay {...desktopOrganizationOverlayProps} />

      <PetPanelsLayer {...panelsLayerProps} />

      {companionRuntimeLayerItems
        .filter((layerProps) => !layerProps.isInteractiveDialogueHidden)
        .map((layerProps) => (
          <CompanionPetRuntimeLayer
            key={layerProps.slot.id}
            {...layerProps}
          />
        ))}

      {!primaryPetAvatarLayerProps.isInteractiveDialogueHidden && (
        <PetAvatarLayer {...primaryPetAvatarLayerProps} />
      )}
    </div>
  );
}
