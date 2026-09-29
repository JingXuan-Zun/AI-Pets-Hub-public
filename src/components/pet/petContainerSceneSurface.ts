import { type ComponentProps } from 'react';
import { PetContainerScene } from './PetContainerScene';
import { PetEnvironmentLayer } from './PetEnvironmentLayer';
import { PetInteractiveDialogueOverlay } from './PetInteractiveDialogueOverlay';

type PetContainerSceneProps = ComponentProps<typeof PetContainerScene>;
type PetEnvironmentLayerProps = ComponentProps<typeof PetEnvironmentLayer>;
type PetInteractiveDialogueOverlayProps = ComponentProps<typeof PetInteractiveDialogueOverlay>;

type CreatePetEnvironmentLayerPropsOptions = PetEnvironmentLayerProps;
type CreatePetInteractiveDialogueOverlayPropsOptions = PetInteractiveDialogueOverlayProps;
type CreatePetContainerScenePropsOptions = PetContainerSceneProps;

export function createPetEnvironmentLayerProps(
  options: CreatePetEnvironmentLayerPropsOptions,
): PetEnvironmentLayerProps {
  return options;
}

export function createPetInteractiveDialogueOverlayProps(
  options: CreatePetInteractiveDialogueOverlayPropsOptions,
): PetInteractiveDialogueOverlayProps {
  return options;
}

export function createPetContainerSceneProps(
  options: CreatePetContainerScenePropsOptions,
): PetContainerSceneProps {
  return options;
}
