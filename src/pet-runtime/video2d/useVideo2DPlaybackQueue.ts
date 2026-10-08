import { useCallback, useEffect, useRef, useState } from 'react';
import { type PetAction, type PetVideoEmotionAction, type PetVideoEmotionFolderAliases } from '../../types';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { subscribeVideoItemInteractions } from './videoItemInteraction';
import { isVideoEmotionAction, resolveVideoEmotionFolderNames } from './videoLibraryEmotionFolders';
import {
  VIDEO_2D_MAX_CONSECUTIVE_FAILURES,
  resolveVideo2DNextStep,
  shouldLoopVideo2DBase,
  shouldQueueVideo2DEmotion,
  type Video2DClipSource,
} from './video2dPlaybackPlan';

type PickResult = { error?: string; ok: boolean; videoUrl?: string };
type ActiveVideo = { requestId: number; source: Video2DClipSource; url: string };

interface UseVideo2DPlaybackQueueOptions {
  emotionAction?: PetAction | null;
  emotionFolderAliases?: PetVideoEmotionFolderAliases | null;
  enableItemInteractions: boolean;
  libraryRootPath?: string | null;
  modelUrl: string;
  randomPlaybackEnabled: boolean;
}

export function useVideo2DPlaybackQueue({
  emotionAction = null,
  emotionFolderAliases = null,
  enableItemInteractions,
  libraryRootPath = null,
  modelUrl,
  randomPlaybackEnabled,
}: UseVideo2DPlaybackQueueOptions) {
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [idleRotationPaused, setIdleRotationPaused] = useState(false);
  const requestIdRef = useRef(0);
  const activeSourceRef = useRef<Video2DClipSource | null>(null);
  const pendingEmotionRef = useRef<PetVideoEmotionAction | null>(null);
  const failureCountRef = useRef(0);
  const aliasesRef = useRef(emotionFolderAliases);
  aliasesRef.current = emotionFolderAliases;
  const idleRotationActive = Boolean(randomPlaybackEnabled && libraryRootPath) && !idleRotationPaused;

  const showClip = useCallback((clip: ActiveVideo | null) => {
    activeSourceRef.current = clip?.source ?? null;
    setActiveVideo(clip);
  }, []);

  // Each request supersedes older in-flight picks; a failed pick keeps the
  // current frame so a missing emotion folder never interrupts playback.
  const requestClip = useCallback((
    source: Video2DClipSource,
    pick: () => Promise<PickResult> | undefined,
    onFailure?: (error: string) => void,
  ) => {
    const requestId = ++requestIdRef.current;
    const pending = pick();
    if (!pending) return;
    void pending.then((result) => {
      if (requestId !== requestIdRef.current) return;
      if (result.ok && result.videoUrl) {
        showClip({ requestId, source, url: result.videoUrl });
        return;
      }
      onFailure?.(result.error ?? 'No playable video');
    }).catch((error) => {
      if (requestId === requestIdRef.current) onFailure?.(String(error));
    });
  }, [showClip]);

  const playIdleClip = useCallback(() => {
    if (!libraryRootPath) return;
    requestClip('idle', () => window.desktopPetShell?.pick2DVideoFromLibrary?.({ rootPath: libraryRootPath }), (error) => {
      pushFrontendRuntimeLog('model', 'video library idle playback paused', { error });
      setIdleRotationPaused(true);
      showClip(null);
    });
  }, [libraryRootPath, requestClip, showClip]);

  const playEmotionClip = useCallback((action: PetVideoEmotionAction) => {
    if (!libraryRootPath) return;
    const folderNames = resolveVideoEmotionFolderNames(action, aliasesRef.current);
    requestClip('emotion', () => window.desktopPetShell?.pick2DVideoFromLibrary?.({
      folderNames,
      rootPath: libraryRootPath,
    }), (error) => {
      pushFrontendRuntimeLog('model', 'video library emotion clip unavailable', { action, error });
    });
  }, [libraryRootPath, requestClip]);

  const advance = useCallback(() => {
    const next = resolveVideo2DNextStep({ idleRotationActive, pendingEmotion: pendingEmotionRef.current });
    pendingEmotionRef.current = null;
    if (next.kind === 'emotion') playEmotionClip(next.action);
    else if (next.kind === 'idle') playIdleClip();
    else showClip(null);
  }, [idleRotationActive, playEmotionClip, playIdleClip, showClip]);

  useEffect(() => {
    setIdleRotationPaused(false);
    failureCountRef.current = 0;
  }, [libraryRootPath, modelUrl, randomPlaybackEnabled]);

  // Start (or stop) idle rotation whenever the library source changes.
  useEffect(() => {
    pendingEmotionRef.current = null;
    if (idleRotationActive) playIdleClip();
    else {
      requestIdRef.current += 1;
      showClip(null);
    }
    return () => { requestIdRef.current += 1; };
  }, [idleRotationActive, modelUrl, playIdleClip, showClip]);

  useEffect(() => {
    if (!isVideoEmotionAction(emotionAction) || !libraryRootPath) return;
    if (shouldQueueVideo2DEmotion(activeSourceRef.current)) {
      pendingEmotionRef.current = emotionAction;
      return;
    }
    playEmotionClip(emotionAction);
  }, [emotionAction, libraryRootPath, playEmotionClip]);

  useEffect(() => {
    if (!enableItemInteractions) return undefined;
    return subscribeVideoItemInteractions((interaction) => {
      if (interaction.modelUrl !== modelUrl) return;
      requestClip('item', () => window.desktopPetShell?.pick2DVideoFromFolder?.({
        folderPath: interaction.folderPath,
      }), (error) => {
        pushFrontendRuntimeLog('model', 'video item folder playback failed', { error });
      });
    });
  }, [enableItemInteractions, modelUrl, requestClip]);

  const handleEnded = useCallback(() => {
    failureCountRef.current = 0;
    advance();
  }, [advance]);

  const handlePlaybackFailure = useCallback((error: string) => {
    pushFrontendRuntimeLog('model', 'video pet playback failed', { error, modelUrl: activeVideo?.url ?? modelUrl });
    failureCountRef.current += 1;
    if (failureCountRef.current >= VIDEO_2D_MAX_CONSECUTIVE_FAILURES) {
      setIdleRotationPaused(true);
      showClip(null);
      return;
    }
    if (activeVideo) advance();
  }, [activeVideo, advance, modelUrl, showClip]);

  return {
    activeVideo,
    handleEnded,
    handlePlaybackFailure,
    shouldLoopBase: shouldLoopVideo2DBase(Boolean(activeVideo), idleRotationActive),
  };
}
