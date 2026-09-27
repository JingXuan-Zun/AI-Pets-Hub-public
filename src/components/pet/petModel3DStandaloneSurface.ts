import { type PetAction } from '../../types';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';

type Position = {
  x: number;
  y: number;
};

type ResolvePetModel3DStandaloneSurfaceOptions = {
  action?: PetAction;
  contentManifest?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  focusTarget?: Position | null;
  isMoving?: boolean;
  scale?: number;
  url: string;
};

export type PetModel3DStandaloneSurface = {
  action: PetAction;
  contentManifest: PetContentManifest | null;
  contentManifestResolved: boolean;
  contentManifestSourceUrl: string | null;
  focusTarget: Position | null;
  isMoving: boolean;
  scale: number;
  url: string;
};

export function resolvePetModel3DStandaloneSurface({
  action = 'IDLE',
  contentManifest = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  focusTarget = null,
  isMoving = false,
  scale = 1,
  url,
}: ResolvePetModel3DStandaloneSurfaceOptions): PetModel3DStandaloneSurface {
  return {
    action,
    contentManifest,
    contentManifestResolved,
    contentManifestSourceUrl,
    focusTarget,
    isMoving,
    scale,
    url,
  };
}
