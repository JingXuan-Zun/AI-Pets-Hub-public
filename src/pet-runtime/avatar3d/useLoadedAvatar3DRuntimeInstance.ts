import { useEffect, useMemo, useRef, useState } from 'react';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type Supported3DModelFormat } from '../../model3dFormatSupport';
import {
  loadAvatar3DRuntimeInstanceByFormat,
  type LoadedAvatar3DExternalMotionClipsResult,
} from './avatar3dAssetLoader';
import { type Avatar3DRuntimeInstance } from './avatar3dRuntimeInstance';
import { type PetContentManifest } from '../content/petContentManifest';

type UseLoadedAvatar3DRuntimeInstanceOptions = {
  contentManifest?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  debugLabel?: string;
  enabled?: boolean;
  externalMotionClipsResult?: LoadedAvatar3DExternalMotionClipsResult | null;
  format: Supported3DModelFormat | null;
  url: string;
};

export function useLoadedAvatar3DRuntimeInstance({
  contentManifest = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  debugLabel,
  enabled = true,
  externalMotionClipsResult = null,
  format,
  url,
}: UseLoadedAvatar3DRuntimeInstanceOptions) {
  const [loadedInstance, setLoadedInstance] = useState<Avatar3DRuntimeInstance | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const activeInstanceRef = useRef<Avatar3DRuntimeInstance | null>(null);
  const loadAttemptIdRef = useRef(0);
  const contentManifestSignature = useMemo(
    () => JSON.stringify(contentManifest ?? null),
    [contentManifest],
  );
  const externalMotionClipsSignature = useMemo(() => JSON.stringify(
    (externalMotionClipsResult?.clips ?? []).map((clip) => ({
      duration: Number.isFinite(clip.duration) ? Number(clip.duration.toFixed(4)) : 0,
      name: clip.name.trim(),
      trackCount: clip.tracks.length,
      userData: clip.userData ?? null,
    })),
  ), [externalMotionClipsResult?.clips]);

  useEffect(() => () => {
    activeInstanceRef.current?.dispose?.();
    activeInstanceRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAttemptId = loadAttemptIdRef.current + 1;
    loadAttemptIdRef.current = loadAttemptId;

    if (!enabled || !format || !url.trim()) {
      const previousActiveInstance = activeInstanceRef.current;
      activeInstanceRef.current = null;
      setLoadError(null);
      setLoadedInstance(null);
      previousActiveInstance?.dispose?.();
      return;
    }

    setLoadError(null);
    pushFrontendRuntimeLog(
      'model',
      `3d runtime load start pet=${debugLabel ?? 'unknown'} format=${format} url=${url}`,
      {
        debugLabel: debugLabel ?? null,
        format,
        url,
      },
    );

    void loadAvatar3DRuntimeInstanceByFormat({
      contentManifest,
      contentManifestResolved,
      contentManifestSourceUrl,
      externalMotionClipsResult,
      format,
      sourceUrl: url,
    })
      .then((instance) => {
        if (cancelled || loadAttemptId !== loadAttemptIdRef.current) {
          instance.dispose?.();
          return;
        }

        const previousActiveInstance = activeInstanceRef.current;
        activeInstanceRef.current = instance;
        setLoadedInstance(instance);
        if (previousActiveInstance && previousActiveInstance !== instance) {
          previousActiveInstance.dispose?.();
        }
      })
      .catch((error) => {
        const nextError = error instanceof Error ? error : new Error(String(error));
        if (cancelled) {
          return;
        }

        setLoadError(nextError);
        pushFrontendRuntimeError('model', '3d runtime load failed', nextError, {
          debugLabel: debugLabel ?? null,
          format,
          url,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    contentManifestResolved,
    contentManifestSignature,
    contentManifestSourceUrl,
    debugLabel,
    externalMotionClipsSignature,
    externalMotionClipsResult?.failedSourceUrls.join('|'),
    externalMotionClipsResult?.loadedAssetCount,
    externalMotionClipsResult?.sourceUrls.join('|'),
    format,
    url,
  ]);

  return {
    loadedInstance,
    loadError,
  };
}
