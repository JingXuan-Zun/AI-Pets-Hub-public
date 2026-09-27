import { useEffect, useState } from 'react';
import {
  loadPetContentManifestForModel,
  type LoadedPetContentManifestResult,
} from './petContentManifestLoader';

const EMPTY_MANIFEST_RESULT: LoadedPetContentManifestResult = {
  manifest: null,
  sourceUrl: null,
};

export function usePetContentManifest(modelUrl: string) {
  const [result, setResult] = useState<LoadedPetContentManifestResult>(EMPTY_MANIFEST_RESULT);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    const trimmedModelUrl = modelUrl.trim();
    let cancelled = false;

    if (!trimmedModelUrl) {
      setResult(EMPTY_MANIFEST_RESULT);
      setIsResolved(true);
      return;
    }

    setIsResolved(false);
    void loadPetContentManifestForModel(trimmedModelUrl)
      .then((loadedResult) => {
        if (cancelled) {
          return;
        }

        setResult(loadedResult);
        setIsResolved(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setResult(EMPTY_MANIFEST_RESULT);
        setIsResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  return {
    ...result,
    isResolved,
  };
}
