import { type PetModelMotionBinding } from '../../types';
import {
  createLive2DMotionBindings,
  createLive2DExpressionMotionBindings,
  resolveLive2DExpressionAssetsFromDirectoryEntries,
  resolveLive2DExpressionAssetsFromModelJsonText,
  resolveLive2DMotionAssetsFromDirectoryEntries,
  resolveLive2DMotionAssetsFromModelJsonText,
} from './live2dExpressionDiscovery';

type Live2DExpressionDiscoveryShell = {
  getPathInfo?: Window['desktopPetShell']['getPathInfo'];
  listDirectory?: Window['desktopPetShell']['listDirectory'];
  readTextFile?: Window['desktopPetShell']['readTextFile'];
};

function isDuplicateLive2DExpressionBinding(
  binding: PetModelMotionBinding,
  existingBindings: PetModelMotionBinding[],
) {
  const sourceUrl = binding.sourceUrl.trim();
  const name = binding.name.trim();
  return existingBindings.some((existingBinding) => (
    existingBinding.sourceUrl.trim() === sourceUrl
    || existingBinding.name.trim() === name
  ));
}

function isDuplicateLive2DMotionBinding(
  binding: PetModelMotionBinding,
  existingBindings: PetModelMotionBinding[],
) {
  const sourceUrl = binding.sourceUrl.trim();
  const name = binding.name.trim();
  return existingBindings.some((existingBinding) => (
    existingBinding.kind !== 'expression'
    && (
      existingBinding.sourceUrl.trim() === sourceUrl
      || existingBinding.name.trim() === name
    )
  ));
}

export async function discoverLive2DExpressionBindingsForModel(options: {
  existingBindings?: PetModelMotionBinding[];
  idPrefix: string;
  modelUrl: string;
  shell?: Live2DExpressionDiscoveryShell | null;
}) {
  const {
    existingBindings = [],
    idPrefix,
    modelUrl,
    shell = typeof window !== 'undefined' ? window.desktopPetShell : null,
  } = options;
  if (!modelUrl.trim() || !shell?.getPathInfo) {
    return [] as PetModelMotionBinding[];
  }

  const expressionAssets = [];
  const motionAssets = [];
  const modelInfo = await shell.getPathInfo({ path: modelUrl }).catch(() => null);
  if (modelInfo?.ok && modelInfo.kind === 'file') {
    const modelJsonResult = await shell.readTextFile?.({
      maxBytes: 512 * 1024,
      path: modelUrl,
    }).catch(() => null);
    if (modelJsonResult?.ok && typeof modelJsonResult.text === 'string') {
      expressionAssets.push(
        ...resolveLive2DExpressionAssetsFromModelJsonText(modelJsonResult.text, modelUrl),
      );
      motionAssets.push(
        ...resolveLive2DMotionAssetsFromModelJsonText(modelJsonResult.text, modelUrl),
      );
    }

    if (modelInfo.dirname && shell.listDirectory) {
      const directoryResult = await shell.listDirectory({
        limit: 200,
        path: modelInfo.dirname,
      }).catch(() => null);
      if (directoryResult?.ok && Array.isArray(directoryResult.entries)) {
        expressionAssets.push(
          ...resolveLive2DExpressionAssetsFromDirectoryEntries(directoryResult.entries, modelUrl),
        );
        motionAssets.push(
          ...resolveLive2DMotionAssetsFromDirectoryEntries(directoryResult.entries, modelUrl),
        );
      }
    }
  }

  const motionBindings = createLive2DMotionBindings(motionAssets, {
    idPrefix,
    startIndex: existingBindings.length,
  }).filter((binding) => !isDuplicateLive2DMotionBinding(binding, existingBindings));

  const expressionBindings = createLive2DExpressionMotionBindings(expressionAssets, {
    idPrefix,
    startIndex: existingBindings.length + motionBindings.length,
  }).filter((binding) => !isDuplicateLive2DExpressionBinding(binding, existingBindings));

  return [
    ...motionBindings,
    ...expressionBindings,
  ];
}
