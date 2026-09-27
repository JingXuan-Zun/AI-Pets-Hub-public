import {
  inject3DModelFormatIntoDataUrl,
  resolve3DModelDirectoryUrl,
  resolve3DModelFormatFromFileName,
  shouldPersist3DModelAsLocalPath,
} from '../../model3dFormatSupport';
import { type PetModelMotionAssetFormat } from '../../types';
import {
  isLive2DModelFileName,
  resolveUnsupportedLive2DMotionImportReason,
  resolveLive2DExpressionFormatFromFileName,
  resolveLive2DMotionFormatFromFileName,
} from '../../pet-runtime/live2d/live2dModelSupport';

export const MAX_CUSTOM_PET_MODELS = 20;
export const MAX_CUSTOM_2D_MODEL_EDGE = 1024;
export const MAX_CUSTOM_3D_MODEL_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_CUSTOM_MOTION_FILE_FORMATS = ['vrma', 'fbx', 'glb', 'gltf'] as const satisfies PetModelMotionAssetFormat[];
const SUPPORTED_CUSTOM_MOTION_ACCEPT_ATTRIBUTE = '.vrma,.fbx,.glb,.gltf,.motion3.json,.exp3.json';
const LIVE2D_MOTION_IMPORT_HELPER_ACCEPT_ATTRIBUTE = '.can3,.cdi3.json,.vtube.json';
type SupportedCustom3DMotionFormat = (typeof SUPPORTED_CUSTOM_MOTION_FILE_FORMATS)[number];

type FileWithOptionalPath = File & {
  path?: string;
};

async function compactImageDataUrl(sourceUrl: string, label: string, maxEdge: number) {
  const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error(`Unable to read image: ${label}`));
    nextImage.src = sourceUrl;
  });

  const longestEdge = Math.max(imageElement.naturalWidth, imageElement.naturalHeight, 1);
  const scale = Math.min(1, maxEdge / longestEdge);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imageElement.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(imageElement.naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

export async function fileToCompactImageDataUrl(file: File, maxEdge = 192) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await compactImageDataUrl(objectUrl, file.name, maxEdge);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function resolveSequenceFilePattern(fileName: string) {
  const matched = fileName.match(/^(.*?)(\d+)(\.[^.]+)$/u);
  if (!matched) return null;

  return {
    extension: matched[3].toLowerCase(),
    index: Number(matched[2]),
    prefix: matched[1].toLowerCase(),
  };
}

export async function fileToCustom2DSequenceDataUrls(file: File, maxEdge = 1024) {
  const selectedPath = resolveElectronSelectedFilePath(file);
  const selectedPattern = resolveSequenceFilePattern(file.name);
  const fallback = [await fileToCompactImageDataUrl(file, maxEdge)];
  if (!selectedPath || !selectedPattern || !window.desktopPetShell?.listDirectory || !window.desktopPetShell?.readFileDataUrl) {
    return fallback;
  }

  const separatorIndex = Math.max(selectedPath.lastIndexOf('/'), selectedPath.lastIndexOf('\\'));
  if (separatorIndex < 0) return fallback;

  const directoryPath = selectedPath.slice(0, separatorIndex);
  const directoryResult = await window.desktopPetShell.listDirectory({ path: directoryPath, limit: 256 });
  if (!directoryResult.ok || !Array.isArray(directoryResult.entries)) return fallback;

  const sequenceEntries = directoryResult.entries
    .map((entry) => ({ entry, pattern: resolveSequenceFilePattern(entry.name) }))
    .filter((item) => item.entry.kind === 'file'
      && item.pattern
      && item.pattern.prefix === selectedPattern.prefix
      && item.pattern.extension === selectedPattern.extension)
    .sort((left, right) => (
      (left.pattern?.index ?? 0) - (right.pattern?.index ?? 0)
      || left.entry.name.localeCompare(right.entry.name, undefined, { numeric: true })
    ));

  if (sequenceEntries.length < 2) return fallback;

  const loadedFrames = await Promise.all(sequenceEntries.map(async ({ entry }) => {
    const result = await window.desktopPetShell?.readFileDataUrl?.({ path: entry.path });
    if (!result?.ok || !result.dataUrl) return null;
    return compactImageDataUrl(result.dataUrl, entry.name, maxEdge);
  }));
  const validFrames = loadedFrames.filter((frame): frame is string => Boolean(frame));
  return validFrames.length > 0 ? validFrames : fallback;
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.trim()) {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Unable to read file: ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`Unable to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function resolveElectronSelectedFilePath(file: File) {
  const shellFilePath = window.desktopPetShell?.getPathForFile?.(file);
  if (typeof shellFilePath === 'string' && shellFilePath.trim()) {
    return shellFilePath.trim();
  }

  const filePath = (file as FileWithOptionalPath).path;
  return typeof filePath === 'string' && filePath.trim() ? filePath.trim() : null;
}

export async function fileToCustom3DModelUrl(file: File) {
  const format = resolve3DModelFormatFromFileName(file.name);
  if (!format) {
    throw new Error(`暂不支持这个 3D 模型格式：${file.name}`);
  }

  if (shouldPersist3DModelAsLocalPath(format)) {
    const localFilePath = resolveElectronSelectedFilePath(file);
    if (!localFilePath) {
      throw new Error(`${format.toUpperCase()} 模型需要读取原始本地文件路径，请在桌面版里重新导入。`);
    }

    return localFilePath;
  }

  const rawDataUrl = await fileToDataUrl(file);
  return inject3DModelFormatIntoDataUrl(rawDataUrl, format);
}

export async function fileToCustomLive2DModelUrl(file: File) {
  const localFilePath = resolveElectronSelectedFilePath(file);
  if (!localFilePath) {
    throw new Error('Live2D 模型需要读取原始 .model3.json 路径，才能加载同目录下的 moc3、贴图和动作文件。请在桌面版里重新导入。');
  }

  return localFilePath;
}

export function resolveCustomMotionFormatFromFileName(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();
  const live2dMotionFormat = resolveLive2DMotionFormatFromFileName(normalizedFileName);
  if (live2dMotionFormat) {
    return live2dMotionFormat;
  }

  const live2dExpressionFormat = resolveLive2DExpressionFormatFromFileName(normalizedFileName);
  if (live2dExpressionFormat) {
    return live2dExpressionFormat;
  }

  const matchedExtension = normalizedFileName.match(/\.([a-z0-9]+)$/iu)?.[1] ?? '';
  return SUPPORTED_CUSTOM_MOTION_FILE_FORMATS.includes(matchedExtension as SupportedCustom3DMotionFormat)
    ? matchedExtension as SupportedCustom3DMotionFormat
    : null;
}

export function resolveUnsupportedCustomMotionImportReason(fileName: string) {
  return resolveUnsupportedLive2DMotionImportReason(fileName);
}

export async function fileToCustomMotionSource(file: File) {
  const format = resolveCustomMotionFormatFromFileName(file.name);
  if (!format) {
    throw new Error(`暂不支持这个动作格式：${file.name}`);
  }

  const localFilePath = resolveElectronSelectedFilePath(file);
  if (localFilePath) {
    return {
      format,
      sourceUrl: localFilePath,
    };
  }

  return {
    format,
    sourceUrl: await fileToDataUrl(file),
  };
}

function normalizeMotionClipNames(clipNames: string[]) {
  return Array.from(new Set(
    clipNames
      .filter((clipName): clipName is string => typeof clipName === 'string')
      .map((clipName) => clipName.trim())
      .filter(Boolean),
  ));
}

type CustomMotionClipInspection = {
  clipNames: string[];
  durationMs: number | null;
};

type InspectableMotionClip = {
  duration?: number;
  name?: string;
};

function normalizeMotionDurationMs(durationsSeconds: number[]) {
  const longestDurationSeconds = durationsSeconds
    .filter((durationSeconds) => Number.isFinite(durationSeconds) && durationSeconds > 0)
    .reduce((longest, durationSeconds) => Math.max(longest, durationSeconds), 0);

  return longestDurationSeconds > 0
    ? Math.max(1, Math.round(longestDurationSeconds * 1000))
    : null;
}

function inspectMotionClips(clips: InspectableMotionClip[]): CustomMotionClipInspection {
  return {
    clipNames: normalizeMotionClipNames(
      clips.map((clip) => clip.name?.trim() ?? ''),
    ),
    durationMs: normalizeMotionDurationMs(
      clips.map((clip) => Number(clip.duration)),
    ),
  };
}

export async function inspectCustomMotionMetadata(
  file: File,
  format: PetModelMotionAssetFormat,
) {
  try {
    if (format === 'motion3' || format === 'exp3') {
      const parsedMotion = JSON.parse(await file.text()) as {
        Meta?: {
          Duration?: number;
        };
      };
      const durationSeconds = Number(parsedMotion.Meta?.Duration);
      const fileNamePattern = format === 'motion3' ? /\.motion3\.json$/iu : /\.exp3\.json$/iu;
      return {
        clipNames: normalizeMotionClipNames([
          file.name.replace(fileNamePattern, ''),
        ]),
        durationMs: format === 'motion3' && Number.isFinite(durationSeconds) && durationSeconds > 0
          ? Math.round(durationSeconds * 1000)
          : null,
      };
    }

    if (format === 'vrma' || format === 'glb' || format === 'gltf') {
      const [{ GLTFLoader }, vrmAnimationModule] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        format === 'vrma'
          ? import('@pixiv/three-vrm-animation')
          : Promise.resolve(null),
      ]);
      const loader = new GLTFLoader();
      if (format === 'vrma' && vrmAnimationModule?.VRMAnimationLoaderPlugin) {
        loader.register((parser) => new vrmAnimationModule.VRMAnimationLoaderPlugin(parser));
      }

      const fileBasePath = resolveElectronSelectedFilePath(file);
      const parseBasePath = fileBasePath
        ? resolve3DModelDirectoryUrl(fileBasePath)
        : window.location.href;
      const payload = format === 'gltf'
        ? await file.text()
        : await file.arrayBuffer();

      const motionInspection = await new Promise<CustomMotionClipInspection>((resolve, reject) => {
        loader.parse(
          payload,
          parseBasePath,
          (gltf) => {
            const rawClipInspection = inspectMotionClips(gltf.animations);
            if (rawClipInspection.clipNames.length > 0) {
              resolve(rawClipInspection);
              return;
            }

            if (format === 'vrma') {
              const vrmAnimations = Array.isArray((gltf as { userData?: { vrmAnimations?: unknown[] } }).userData?.vrmAnimations)
                ? (gltf as { userData?: { vrmAnimations?: unknown[] } }).userData?.vrmAnimations ?? []
                : [];
              resolve({
                clipNames: vrmAnimations.map((_, index) => `vrma-clip-${index + 1}`),
                durationMs: rawClipInspection.durationMs,
              });
              return;
            }

            resolve(rawClipInspection);
          },
          (error) => reject(error instanceof Error ? error : new Error(String(error))),
        );
      });

      return {
        ...motionInspection,
        clipNames: normalizeMotionClipNames(motionInspection.clipNames),
      };
    }

    if (format === 'fbx') {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      const fbx = loader.parse(await file.arrayBuffer(), file.name);
      return inspectMotionClips(fbx.animations);
    }
  } catch {
    return {
      clipNames: [],
      durationMs: null,
    };
  }

  return {
    clipNames: [],
    durationMs: null,
  };
}

export async function inspectCustomMotionClipNames(
  file: File,
  format: PetModelMotionAssetFormat,
) {
  return (await inspectCustomMotionMetadata(file, format)).clipNames;
}

export function resolveCustomPetModelType(file: File) {
  if (isLive2DModelFileName(file.name)) {
    return 'live2d' as const;
  }

  if (isSupportedCustomImageFile(file) || /\.(?:webm|mp4|m4v|mov|gif)$/iu.test(file.name)) {
    return '2d' as const;
  }

  return resolve3DModelFormatFromFileName(file.name)
    ? '3d' as const
    : null;
}

export function isSupportedCustomModelFile(file: File) {
  return isSupportedCustomImageFile(file)
    || /\.(?:webm|mp4|m4v|mov|gif)$/iu.test(file.name)
    || isLive2DModelFileName(file.name)
    || resolve3DModelFormatFromFileName(file.name) !== null;
}

const CUSTOM_IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|jpeg|jpg|png|webp)$/iu;

export function isSupportedCustomImageFile(file: File) {
  return file.type.startsWith('image/') || CUSTOM_IMAGE_EXTENSION_PATTERN.test(file.name);
}

export function isCustom2DVideoFile(file: File) {
  return /\.(?:webm|mp4|m4v|mov|gif)$/iu.test(file.name);
}

export function isSupportedCustomMotionFile(file: File) {
  return resolveCustomMotionFormatFromFileName(file.name) !== null;
}

export function getSupportedCustomMotionAcceptAttribute() {
  return SUPPORTED_CUSTOM_MOTION_ACCEPT_ATTRIBUTE;
}

export function getLive2DMotionImportAcceptAttribute() {
  return [
    '.motion3.json',
    '.exp3.json',
    LIVE2D_MOTION_IMPORT_HELPER_ACCEPT_ATTRIBUTE,
  ].join(',');
}
