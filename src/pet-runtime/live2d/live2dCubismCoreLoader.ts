const LIVE2D_CUBISM_CORE_GLOBAL_KEY = 'Live2DCubismCore';
const DEFAULT_CUBISM4_CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
const LOCAL_CUBISM4_CORE_CANDIDATES = [
  './live2dcubismcore.min.js',
  './live2dcubismcore.js',
  './live2d/live2dcubismcore.min.js',
  './live2d/live2dcubismcore.js',
  './models-3d/live2d/live2dcubismcore.min.js',
  './models-3d/live2d/live2dcubismcore.js',
  '/live2dcubismcore.min.js',
  '/live2dcubismcore.js',
  '/live2d/live2dcubismcore.min.js',
  '/live2d/live2dcubismcore.js',
  '/models-3d/live2d/live2dcubismcore.min.js',
  '/models-3d/live2d/live2dcubismcore.js',
] as const;

let cubism4CoreLoadPromise: Promise<void> | null = null;

function hasCubism4Core() {
  return typeof window !== 'undefined'
    && Boolean((window as unknown as Record<string, unknown>)[LIVE2D_CUBISM_CORE_GLOBAL_KEY]);
}

function appendScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Live2D Cubism Core can only be loaded in a browser renderer.'));
      return;
    }

    const existingScript = Array.from(document.scripts).find((script) => script.src === src);
    if (existingScript && hasCubism4Core()) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (hasCubism4Core()) {
        resolve();
        return;
      }

      reject(new Error(`Live2D Cubism Core script loaded but did not expose ${LIVE2D_CUBISM_CORE_GLOBAL_KEY}: ${src}`));
    };
    script.onerror = () => reject(new Error(`Unable to load Live2D Cubism Core script: ${src}`));
    script.src = src;
    document.head.appendChild(script);
  });
}

async function tryLoadCubism4CoreFromCandidates(urls: readonly string[]) {
  const errors: string[] = [];
  for (const url of urls) {
    try {
      await appendScript(url);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors.join(' | '));
}

export function ensureLive2DCubism4Core(options?: {
  remoteCoreUrl?: string;
}) {
  if (hasCubism4Core()) {
    return Promise.resolve();
  }

  if (!cubism4CoreLoadPromise) {
    cubism4CoreLoadPromise = tryLoadCubism4CoreFromCandidates([
      ...LOCAL_CUBISM4_CORE_CANDIDATES,
      options?.remoteCoreUrl?.trim() || DEFAULT_CUBISM4_CORE_URL,
    ]).catch((error) => {
      cubism4CoreLoadPromise = null;
      throw new Error(
        `Live2D Cubism Core was not loaded. Put live2dcubismcore.min.js or live2dcubismcore.js under public/live2d/, or allow loading the official Core URL. ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  return cubism4CoreLoadPromise;
}
