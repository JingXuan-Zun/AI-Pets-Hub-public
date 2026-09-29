import { resolve3DModelLoaderUrl } from '../../model3dFormatSupport';
import { type ModelType, type PetModelMotionAssetFormat } from '../../types';

const LIVE2D_MODEL3_FILE_PATTERN = /\.model3\.json$/iu;
const LIVE2D_LEGACY_MODEL_FILE_PATTERN = /\.model\.json$/iu;
const LIVE2D_MOTION3_FILE_PATTERN = /\.motion3\.json$/iu;
const LIVE2D_EXPRESSION3_FILE_PATTERN = /\.exp3\.json$/iu;
const LIVE2D_CUBISM_ANIMATION_PROJECT_FILE_PATTERN = /\.can3$/iu;
const LIVE2D_DISPLAY_INFO_FILE_PATTERN = /\.cdi3\.json$/iu;
const LIVE2D_VTUBE_STUDIO_FILE_PATTERN = /\.vtube\.json$/iu;

export type Live2DModelFormat = 'model3' | 'legacy-model';

export function isLive2DModelFileName(fileName: string) {
  const normalizedFileName = fileName.trim();
  return LIVE2D_MODEL3_FILE_PATTERN.test(normalizedFileName)
    || LIVE2D_LEGACY_MODEL_FILE_PATTERN.test(normalizedFileName);
}

export function resolveLive2DModelFormatFromFileName(fileName: string): Live2DModelFormat | null {
  const normalizedFileName = fileName.trim();
  if (LIVE2D_MODEL3_FILE_PATTERN.test(normalizedFileName)) {
    return 'model3';
  }

  if (LIVE2D_LEGACY_MODEL_FILE_PATTERN.test(normalizedFileName)) {
    return 'legacy-model';
  }

  return null;
}

export function isLive2DMotionFileName(fileName: string) {
  return LIVE2D_MOTION3_FILE_PATTERN.test(fileName.trim());
}

export function isLive2DExpressionFileName(fileName: string) {
  return LIVE2D_EXPRESSION3_FILE_PATTERN.test(fileName.trim());
}

export function resolveLive2DMotionFormatFromFileName(fileName: string): Extract<PetModelMotionAssetFormat, 'motion3'> | null {
  return isLive2DMotionFileName(fileName) ? 'motion3' : null;
}

export function resolveLive2DExpressionFormatFromFileName(fileName: string): Extract<PetModelMotionAssetFormat, 'exp3'> | null {
  return isLive2DExpressionFileName(fileName) ? 'exp3' : null;
}

export function resolveUnsupportedLive2DMotionImportReason(fileName: string) {
  const normalizedFileName = fileName.trim();
  if (LIVE2D_CUBISM_ANIMATION_PROJECT_FILE_PATTERN.test(normalizedFileName)) {
    return 'Live2D .can3 是 Cubism Editor 的动画工程文件，当前运行时不能直接播放。请先在 Cubism Editor 中把它导出为 .motion3.json，再导入应用。';
  }

  if (LIVE2D_DISPLAY_INFO_FILE_PATTERN.test(normalizedFileName)) {
    return 'Live2D .cdi3.json 是参数/部件显示信息文件，不是可播放动作。动作请导入 .motion3.json，表情请导入 .exp3.json。';
  }

  if (LIVE2D_VTUBE_STUDIO_FILE_PATTERN.test(normalizedFileName)) {
    return 'Live2D .vtube.json 是 VTube Studio 相关配置，不是 Cubism runtime 动作文件。动作请导入 .motion3.json，表情请导入 .exp3.json。';
  }

  return null;
}

export function isLive2DModelType(modelType: ModelType) {
  return modelType === 'live2d';
}

export function canModelTypeUseMotionBindings(modelType: ModelType) {
  return modelType === '3d' || modelType === 'live2d';
}

export function resolveLive2DModelRuntimeUrl(modelUrl: string) {
  return resolve3DModelLoaderUrl(modelUrl);
}

export function getSupportedLive2DModelAcceptAttribute() {
  return '.model3.json,.model.json';
}

export function getSupportedLive2DMotionAcceptAttribute() {
  return '.motion3.json,.exp3.json';
}
