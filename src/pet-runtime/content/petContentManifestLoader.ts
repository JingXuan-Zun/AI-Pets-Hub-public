import {
  resolve3DModelDirectoryUrl,
  resolve3DModelLoaderUrl,
} from '../../model3dFormatSupport';
import {
  normalizePetContentManifest,
  type PetContentManifest,
} from './petContentManifest';
import { resolveBuiltInPet2DContentManifest } from './pet2dContentManifest';

const DEFAULT_MANIFEST_FILE_NAMES = [
  'pet-content.manifest.json',
  'manifest.json',
] as const;
const petContentManifestRequestCache = new Map<string, Promise<LoadedPetContentManifestResult>>();

export type LoadedPetContentManifestResult = {
  manifest: PetContentManifest | null;
  sourceUrl: string | null;
};

function resolveModelBaseName(modelUrl: string) {
  const loaderUrl = resolve3DModelLoaderUrl(modelUrl);
  const normalizedUrl = loaderUrl
    .replace(/[?#].*$/u, '')
    .replace(/\\/g, '/');
  const fileName = normalizedUrl.split('/').pop() ?? '';
  const baseName = fileName.replace(/\.[^.]+$/u, '').trim();
  return baseName || null;
}

function resolveUrlAgainstDirectory(baseDirectoryUrl: string, fileName: string) {
  try {
    return new URL(fileName, baseDirectoryUrl).toString();
  } catch {
    const normalizedDirectoryUrl = baseDirectoryUrl.endsWith('/')
      ? baseDirectoryUrl
      : `${baseDirectoryUrl}/`;
    return `${normalizedDirectoryUrl}${fileName}`;
  }
}

export function resolvePetContentManifestCandidateUrls(modelUrl: string) {
  const trimmedModelUrl = modelUrl.trim();
  if (!trimmedModelUrl || /^(?:data|blob):/iu.test(trimmedModelUrl)) {
    return [];
  }

  const baseDirectoryUrl = resolve3DModelDirectoryUrl(trimmedModelUrl);
  if (!baseDirectoryUrl) {
    return [];
  }

  const modelBaseName = resolveModelBaseName(trimmedModelUrl);
  const candidateFileNames = [
    ...(modelBaseName ? [`${modelBaseName}.manifest.json`] : []),
    ...DEFAULT_MANIFEST_FILE_NAMES,
  ];

  return Array.from(new Set(candidateFileNames)).map((fileName) => (
    resolveUrlAgainstDirectory(baseDirectoryUrl, fileName)
  ));
}

async function tryLoadPetContentManifestFromUrl(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const manifest = normalizePetContentManifest(await response.json(), sourceUrl);
  if (!manifest) {
    return null;
  }

  return manifest;
}

export async function loadPetContentManifestForModel(modelUrl: string): Promise<LoadedPetContentManifestResult> {
  const cacheKey = resolve3DModelLoaderUrl(modelUrl.trim());
  if (!cacheKey) {
    return {
      manifest: null,
      sourceUrl: null,
    };
  }

  const cachedPromise = petContentManifestRequestCache.get(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const requestPromise = (async () => {
  const candidateUrls = resolvePetContentManifestCandidateUrls(modelUrl);

  for (const candidateUrl of candidateUrls) {
    try {
      const manifest = await tryLoadPetContentManifestFromUrl(candidateUrl);
      if (manifest) {
        return {
          manifest,
          sourceUrl: candidateUrl,
        };
      }
    } catch {
      // Ignore missing or invalid sidecar manifests and fall back to defaults.
    }
  }

  const builtin2DManifest = resolveBuiltInPet2DContentManifest(modelUrl);
  if (builtin2DManifest) {
    return {
      manifest: builtin2DManifest,
      sourceUrl: `builtin:${builtin2DManifest.id}`,
    };
  }

  return {
    manifest: null,
    sourceUrl: null,
  };
  })();

  petContentManifestRequestCache.set(cacheKey, requestPromise);
  return requestPromise;
}
