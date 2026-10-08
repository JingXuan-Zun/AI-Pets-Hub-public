import { memo, useCallback, useEffect, useRef } from 'react';
import { arePetVisualBoundsEqual, type PetVisualBounds } from './petVisualBounds';
import { type PetAction, type PetVideoEmotionFolderAliases } from '../../types';
import { useVideo2DPlaybackQueue } from '../../pet-runtime/video2d/useVideo2DPlaybackQueue';
import { resolveVideo2DVisualBounds } from './video2dVisualBounds';

interface PetVideo2DRendererProps {
  emotionAction?: PetAction | null;
  isDragging?: boolean;
  enableItemInteractions?: boolean;
  modelUrl: string;
  randomVideoPlaybackEnabled?: boolean;
  videoEmotionFolderAliases?: PetVideoEmotionFolderAliases | null;
  videoLibraryRootPath?: string | null;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pointerLookTarget?: { x: number; y: number } | null;
  scale: number;
}

const PetVideo2DRenderer = memo(function PetVideo2DRenderer({
  emotionAction = null,
  isDragging = false,
  enableItemInteractions = false,
  modelUrl,
  randomVideoPlaybackEnabled = false,
  videoEmotionFolderAliases = null,
  videoLibraryRootPath = null,
  onVisualBoundsChange,
  pointerLookTarget,
  scale,
}: PetVideo2DRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reportedBoundsRef = useRef<PetVisualBounds | null>(null);
  const {
    activeVideo,
    handleEnded,
    handlePlaybackFailure,
    shouldLoopBase,
  } = useVideo2DPlaybackQueue({
    emotionAction,
    emotionFolderAliases: videoEmotionFolderAliases,
    enableItemInteractions,
    libraryRootPath: videoLibraryRootPath,
    modelUrl,
    randomPlaybackEnabled: randomVideoPlaybackEnabled,
  });

  useEffect(() => {
    reportedBoundsRef.current = null;
  }, [modelUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch((error) => {
      // A clip swap remounts the element and aborts the old play() promise.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      handlePlaybackFailure(String(error));
    });
  }, [activeVideo, handlePlaybackFailure, modelUrl]);

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
          loop={shouldLoopBase}
          preload="auto"
          onEnded={handleEnded}
          onError={() => handlePlaybackFailure('media error')}
          aria-label="2D 视频桌宠"
        />
      </div>
    </div>
  );
});

PetVideo2DRenderer.displayName = 'PetVideo2DRenderer';

export default PetVideo2DRenderer;
