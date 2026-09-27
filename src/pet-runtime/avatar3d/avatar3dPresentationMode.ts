import { type ModelType } from '../../types';

export type Avatar3DPresentationMode = 'default' | 'interactive-dialogue';

export function resolveAvatar3DPresentationMode(
  modelType: ModelType,
  isInteractiveDialogueMode: boolean,
): Avatar3DPresentationMode {
  return modelType === '3d' && isInteractiveDialogueMode
    ? 'interactive-dialogue'
    : 'default';
}
