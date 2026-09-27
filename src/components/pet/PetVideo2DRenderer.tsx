import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { arePetVisualBoundsEqual, type PetVisualBounds } from './petVisualBounds';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { subscribeVideoItemInteractions } from '../../pet-runtime/video2d/videoItemInteraction';
import { resolveVideo2DVisualBounds } from './video2dVisualBounds';

interface PetVideo2DRendererProps {
  isDragging?: boolean;
  enableItemInteractions?: boolean;
  modelUrl: string;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pointerLookTarget?: { x: number; y: number } | null;
  scale: number;
}

const PetVideo2DRenderer = memo(function PetVideo2DRenderer({
  isDragging = false,
  enableItemInteractions = false,
  modelUrl,
  onVisualBoundsChange,
  pointerLookTarget,
  scale,
}: PetVideo2DRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reportedBoundsRef = useRef<PetVisualBounds | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ url: string; requestId: number } | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setActiveVideo(null);
    if (!enableItemInteractions) return undefined;
    const unsubscribe = subscribeVideoItemInteractions((interaction) => {
      if (interaction.modelUrl !== modelUrl) return;
      const requestId = ++requestIdRef.current;
      const pickVideo = window.desktopPetShell?.pick2DVideoFromFolder;
      if (!pickVideo) return;
      void pickVideo({ folderPath: interaction.folderPath }).then((result) => {
        if (requestId !== requestIdRef.current) return;
        if (!result.ok || !result.videoUrl) {
          pushFrontendRuntimeLog('model', 'video item folder playback failed', {
            error: result.error ?? 'No playable video',
          });
          return;
        }
        setActiveVideo({ url: result.videoUrl, requestId });
      }).catch((error) => {
        if (requestId === requestIdRef.current) {
          pushFrontendRuntimeLog('model', 'video item folder playback failed', { error: String(error) });
        }
      });
    });
    return () => {
      requestIdRef.current += 1;
      unsubscribe();
    };
  }, [enableItemInteractions, modelUrl]);

  useEffect(() => {
    reportedBoundsRef.current = null;
  }, [modelUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch((error) => {
      pushFrontendRuntimeLog('model', 'video pet playback failed', {
        modelUrl: activeVideo?.url ?? modelUrl,
        error: String(error),
      });
      if (activeVideo) setActiveVideo((current) => (
        current?.requestId === activeVideo.requestId ? null : current
      ));
    });
  }, [activeVideo, modelUrl]);

  const translateX = pointerLookTarget ? Math.max(-8, Math.min(8, pointerLookTarget.x * 0.04)) : 0;
  const translateY = pointerLookTarget ? Math.max(-5, Math.min(5, pointerLookTarget.y * 0.025)) : 0;
  const faceDirection = pointerLookTarget?.x && Math.abs(pointerLookTarget.x) >= 0.25
    ? (pointerLookTarget.x < 0 ? -1 : 1)
    : 1;

  const reportVisibleVideoBounds = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const bounds = resolveVideo2DVisualBounds({
      containerRect: container.getBoundingClientRect(),
      sourceHeight: video.videoHeight,
      sourceWidth: video.videoWidth,
      videoRect: video.getBoundingClientRect(),
    });
    if (!bounds || arePetVisualBoundsEqual(reportedBoundsRef.current, bounds)) return;

    reportedBoundsRef.current = bounds;
    onVisualBoundsChange?.(bounds);
  }, [onVisualBoundsChange]);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return undefined;

    let frameId = 0;
    const scheduleMeasurement = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(reportVisibleVideoBounds);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    resizeObserver.observe(container);
    video.addEventListener('loadeddata', scheduleMeasurement);
    video.addEventListener('loadedmetadata', scheduleMeasurement);
    video.addEventListener('canplay', scheduleMeasurement);
    scheduleMeasurement();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      video.removeEventListener('loadeddata', scheduleMeasurement);
      video.removeEventListener('loadedmetadata', scheduleMeasurement);
      video.removeEventListener('canplay', scheduleMeasurement);
    };
  }, [activeVideo?.requestId, modelUrl, reportVisibleVideoBounds, scale, translateX, translateY]);

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-visible">
      <div
        className={`pet-anim-shell flex h-full w-full items-center justify-center ${isDragging ? 'pet-anim-dragging' : ''}`}
        style={{ transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${faceDirection * scale}, ${scale})` }}
      >
        <video
          ref={videoRef}
          key={activeVideo?.requestId ?? modelUrl}
          src={activeVideo?.url ?? modelUrl}
          className="pointer-events-none h-full w-full object-contain"
          muted
          playsInline
          autoPlay
          loop={!activeVideo}
          preload="auto"
          onEnded={() => {
            if (activeVideo) setActiveVideo((current) => (
              current?.requestId === activeVideo.requestId ? null : current
            ));
          }}
          onError={() => {
            pushFrontendRuntimeLog('model', 'video pet playback failed', { modelUrl: activeVideo?.url ?? modelUrl });
            if (activeVideo) setActiveVideo((current) => (
              current?.requestId === activeVideo.requestId ? null : current
            ));
          }}
          aria-label="2D 视频桌宠"
        />
      </div>
    </div>
  );
});

PetVideo2DRenderer.displayName = 'PetVideo2DRenderer';

export default PetVideo2DRenderer;
