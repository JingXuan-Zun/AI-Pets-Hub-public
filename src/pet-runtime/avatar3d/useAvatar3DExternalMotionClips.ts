import { useEffect, useMemo, useState } from 'react';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  loadAvatar3DExternalMotionClips,
  type LoadedAvatar3DExternalMotionClipsResult,
} from './avatar3dAssetLoader';
import { type PetContentManifest } from '../content/petContentManifest';

const EMPTY_EXTERNAL_MOTION_CLIPS_RESULT: LoadedAvatar3DExternalMotionClipsResult = {
  clips: [],
  failedSourceUrls: [],
  loadedAssetCount: 0,
  sourceUrls: [],
};

export type UseAvatar3DExternalMotionClipsResult = LoadedAvatar3DExternalMotionClipsResult & {
  isResolved: boolean;
};

export function useAvatar3DExternalMotionClips({
  contentManifest,
  contentManifestSourceUrl,
  enabled = true,
  modelUrl,
}: {
  contentManifest?: PetContentManifest | null;
  contentManifestSourceUrl?: string | null;
  enabled?: boolean;
  modelUrl: string;
}) {
  const [result, setResult] = useState<LoadedAvatar3DExternalMotionClipsResult>(EMPTY_EXTERNAL_MOTION_CLIPS_RESULT);
  const [isResolved, setIsResolved] = useState(true);
  const contentManifestSignature = useMemo(
    () => JSON.stringify(contentManifest ?? null),
    [contentManifest],
  );

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !contentManifest) {
      setResult(EMPTY_EXTERNAL_MOTION_CLIPS_RESULT);
      setIsResolved(true);
      return;
    }

    setIsResolved(false);
    void loadAvatar3DExternalMotionClips({
      contentManifest,
      contentManifestSourceUrl,
      modelUrl,
    })
      .then((loadedResult) => {
        if (cancelled) {
          return;
        }

        setResult(loadedResult);
        setIsResolved(true);
        if (loadedResult.sourceUrls.length || loadedResult.failedSourceUrls.length) {
          pushFrontendRuntimeLog(
            'model',
            `3d external motions ready loaded=${loadedResult.loadedAssetCount} clips=${loadedResult.clips.map((clip) => {
              const keyframes = Number((clip.userData as { desktopPetExternalMotionKeyframes?: number } | undefined)?.desktopPetExternalMotionKeyframes ?? 0);
              const rate = Number((clip.userData as { desktopPetPlaybackRateMultiplier?: number } | undefined)?.desktopPetPlaybackRateMultiplier ?? 1);
              const duration = Number.isFinite(clip.duration) ? clip.duration.toFixed(3) : '0.000';
              return `${clip.name.trim() || 'unnamed'}@${duration}s#${keyframes}x${rate}`;
            }).join('|') || 'none'} sources=${loadedResult.sourceUrls.join('|') || 'none'} failed=${loadedResult.failedSourceUrls.join('|') || 'none'}`,
            {
              clipNames: loadedResult.clips.map((clip) => clip.name.trim()).filter(Boolean),
              failedSourceUrls: loadedResult.failedSourceUrls,
              loadedAssetCount: loadedResult.loadedAssetCount,
              modelUrl,
              sourceUrls: loadedResult.sourceUrls,
            },
          );
        }
      })
      .catch((error) => {
        const nextError = error instanceof Error ? error : new Error(String(error));
        if (cancelled) {
          return;
        }

        setResult(EMPTY_EXTERNAL_MOTION_CLIPS_RESULT);
        setIsResolved(true);
        pushFrontendRuntimeError('model', '3d external motion load failed', nextError, {
          contentManifestSourceUrl,
          modelUrl,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [contentManifestSignature, contentManifestSourceUrl, enabled, modelUrl]);

  return useMemo(() => ({
    ...result,
    isResolved,
  }), [isResolved, result]);
}
