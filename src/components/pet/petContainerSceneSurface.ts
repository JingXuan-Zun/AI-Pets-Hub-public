import { type ComponentProps } from 'react';
import { PetContainerScene } from './PetContainerScene';
import { PetEnvironmentLayer } from './PetEnvironmentLayer';

type PetContainerSceneProps = ComponentProps<typeof PetContainerScene>;
type PetEnvironmentLayerProps = ComponentProps<typeof PetEnvironmentLayer>;

type CreatePetEnvironmentLayerPropsOptions = PetEnvironmentLayerProps;
type CreatePetContainerScenePropsOptions = PetContainerSceneProps;

export function createPetEnvironmentLayerProps(
  options: CreatePetEnvironmentLayerPropsOptions,
): PetEnvironmentLayerProps {
  return options;
}

export function createPetContainerSceneProps(
  options: CreatePetContainerScenePropsOptions,
): PetContainerSceneProps {
  return options;
}
