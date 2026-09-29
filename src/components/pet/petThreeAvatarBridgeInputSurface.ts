import { type PetModelMotionBinding } from '../../types';
import { mergePetContentManifests } from '../../pet-runtime/content/petModelMotionBindings';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import {
  type AvatarRuntimeManualExpressionSelection,
  type AvatarRuntimeManualMotionSelection,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { resolveAvatarRuntimeManualExpressionSelection } from '../../pet-runtime/content/petModelExpressionBindings';

type ResolvePetThreeAvatarBridgeInputSurfaceOptions = {
  contentManifest: PetContentManifest | null;
  contentManifestOverride?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  modelUrl: string;
};

export type PetThreeAvatarBridgeInputSurface = {
  contentManifest: PetContentManifest | null;
  contentManifestResolved: boolean;
  contentManifestSourceUrl: string;
  manualExpressionSelection: AvatarRuntimeManualExpressionSelection | null;
  manualMotionSelection: AvatarRuntimeManualMotionSelection | null;
};

export function resolvePetThreeAvatarBridgeInputSurface({
  contentManifest,
  contentManifestOverride = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  manualExpressionBinding = null,
  manualMotionBinding = null,
  modelUrl,
}: ResolvePetThreeAvatarBridgeInputSurfaceOptions): PetThreeAvatarBridgeInputSurface {
  const mergedContentManifest = mergePetContentManifests(contentManifest, contentManifestOverride);
  const effectiveManualExpressionBinding = manualExpressionBinding
    ?? (manualMotionBinding && isPetModelExpressionBinding(manualMotionBinding)
      ? manualMotionBinding
      : null);
  const manualExpressionSelection = resolveAvatarRuntimeManualExpressionSelection(
    effectiveManualExpressionBinding,
  );
  const manualMotionSelection = !manualMotionBinding || isPetModelExpressionBinding(manualMotionBinding)
    ? null
    : {
      candidateClipNames: Array.from(new Set(
        [
          manualMotionBinding.name?.trim() ?? '',
          ...(manualMotionBinding.clipNames ?? []),
          manualMotionBinding.motionKey,
        ].filter(Boolean),
      )),
      motionKey: manualMotionBinding.motionKey,
      playbackMode: 'native',
    } satisfies AvatarRuntimeManualMotionSelection;

  return {
    contentManifest: mergedContentManifest,
    contentManifestResolved: contentManifestResolved || contentManifestOverride !== null,
    contentManifestSourceUrl: contentManifestSourceUrl ?? modelUrl,
    manualExpressionSelection,
    manualMotionSelection,
  };
}
