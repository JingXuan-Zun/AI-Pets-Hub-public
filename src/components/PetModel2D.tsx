import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { type PetAction } from '../types';
import { DEFAULT_BUILTIN_STATIC_PET_MODEL_URL } from '../constants';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { type PetContentManifest } from '../pet-runtime/content/petContentManifest';
import {
  resolvePet2DExpressionSequenceFrames,
  resolvePet2DMotionSequenceFrames,
} from '../pet-runtime/content/pet2dContentManifest';
import { resolve2dFaceDirectionScale } from './pet/petMotionVisualState';
import { subscribeSharedAnimationTick } from './pet/sharedAnimationTicker';
import {
  resolvePet2DPresentationState,
  type Pet2DPresentationState,
} from './pet/pet2dPresentationState';
import {
  resolvePet2DRenderAdapterState,
  type Pet2DRenderAdapterState,
} from './pet/pet2dRenderAdapterState';
import { resolvePointerLookVisualStyle } from './pet/petPointerLookVisual';

type DirectionalExtents = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

interface PetModel2DProps {
  url: string;
  scale?: number;
  action?: PetAction;
  contentManifest?: PetContentManifest | null;
  expressionAction?: PetAction | null;
  isDragging?: boolean;
  isMoving?: boolean;
  presentationState?: Pet2DPresentationState;
  renderAdapterState?: Pet2DRenderAdapterState;
  sequenceFrameDurationMultiplier?: number;
  sequenceFrames?: string[];
  focusTarget?: { x: number, y: number } | null;
  pointerLookTarget?: { x: number, y: number } | null;
  onVisualBoundsChange?: (bounds: DirectionalExtents) => void;
}

type SpriteMetrics = {
  contentBottom: number;
  contentLeft: number;
  contentRight: number;
  contentTop: number;
  displayHeight: number;
  displayWidth: number;
};

type CleanedSpriteCacheEntry = {
  cleanedUrl: string;
  metrics: SpriteMetrics;
  sequenceUrl: string;
  sourceMetrics: SpriteMetrics;
};

type SequenceSpriteCacheEntry = {
  displayFrames: string[];
  metrics: SpriteMetrics | null;
};

const cleanedSpriteCache = new Map<string, CleanedSpriteCacheEntry>();
const sequenceSpriteCache = new Map<string, SequenceSpriteCacheEntry>();
const pendingSequenceSpriteCache = new Map<string, Promise<SequenceSpriteCacheEntry>>();
const SEQUENCE_METRICS_YIELD_EVERY = 3;

const isLocalSprite = (url: string) => !/^https?:\/\//i.test(url);

const isSupportedExpressionSequenceAction = (
  action: PetAction | null | undefined,
): action is Extract<PetAction, 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING'> => (
  action === 'EATING'
  || action === 'HAPPY'
  || action === 'SAD'
  || action === 'SLEEPING'
);

const isLightBackgroundPixel = (r: number, g: number, b: number, a: number) => {
  if (a < 16) {
    return true;
  }

  const brightness = (r + g + b) / 3;
  const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);

  return brightness > 234 && colorSpread < 30;
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load sprite: ${url}`));
    image.src = url;
  });

const cleanupSprite = async (url: string) => {
  if (!isLocalSprite(url)) {
    return {
      cleanedUrl: url,
      metrics: {
        contentBottom: 0,
        contentLeft: 0,
        contentRight: 0,
        contentTop: 0,
        displayHeight: 0,
        displayWidth: 0,
      },
      sequenceUrl: url,
      sourceMetrics: {
        contentBottom: 0,
        contentLeft: 0,
        contentRight: 0,
        contentTop: 0,
        displayHeight: 0,
        displayWidth: 0,
      },
    } satisfies CleanedSpriteCacheEntry;
  }

  const cached = cleanedSpriteCache.get(url);
  if (cached) {
    return cached;
  }

  const image = await loadImage(url);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    return {
      cleanedUrl: url,
      metrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
      sequenceUrl: url,
      sourceMetrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
    } satisfies CleanedSpriteCacheEntry;
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });

  if (!sourceContext) {
    return {
      cleanedUrl: url,
      metrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
      sequenceUrl: url,
      sourceMetrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
    } satisfies CleanedSpriteCacheEntry;
  }

  sourceContext.drawImage(image, 0, 0, width, height);
  const imageData = sourceContext.getImageData(0, 0, width, height);
  const { data } = imageData;
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    const dataIndex = pixelIndex * 4;
    if (
      !isLightBackgroundPixel(
        data[dataIndex],
        data[dataIndex + 1],
        data[dataIndex + 2],
        data[dataIndex + 3],
      )
    ) {
      return;
    }

    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const dataIndex = pixelIndex * 4;
    data[dataIndex + 3] = 0;

    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  sourceContext.putImageData(imageData, 0, 0);
  const sequenceUrl = sourceCanvas.toDataURL('image/png');

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 24) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      cleanedUrl: url,
      metrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
      sequenceUrl,
      sourceMetrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
    } satisfies CleanedSpriteCacheEntry;
  }

  const padding = 12;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = cropWidth;
  outputCanvas.height = cropHeight;
  const outputContext = outputCanvas.getContext('2d');

  if (!outputContext) {
    return {
      cleanedUrl: url,
      metrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
      sequenceUrl,
      sourceMetrics: {
        contentBottom: height,
        contentLeft: 0,
        contentRight: width,
        contentTop: 0,
        displayHeight: height,
        displayWidth: width,
      },
    } satisfies CleanedSpriteCacheEntry;
  }

  outputContext.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  const cleanedUrl = outputCanvas.toDataURL('image/png');
  const cleanedEntry = {
    cleanedUrl,
    metrics: {
      contentBottom: Math.max(1, maxY - cropY + 1),
      contentLeft: Math.max(0, minX - cropX),
      contentRight: Math.max(1, maxX - cropX + 1),
      contentTop: Math.max(0, minY - cropY),
      displayHeight: cropHeight,
      displayWidth: cropWidth,
    },
    sequenceUrl,
    sourceMetrics: {
      contentBottom: Math.max(1, maxY + 1),
      contentLeft: minX,
      contentRight: Math.max(1, maxX + 1),
      contentTop: minY,
      displayHeight: height,
      displayWidth: width,
    },
  } satisfies CleanedSpriteCacheEntry;
  cleanedSpriteCache.set(url, cleanedEntry);
  return cleanedEntry;
};

function mergeSpriteMetrics(metricsList: SpriteMetrics[]) {
  const validMetrics = metricsList.filter((metrics) => metrics.displayWidth > 0 && metrics.displayHeight > 0);
  if (validMetrics.length === 0) {
    return null;
  }

  const baseMetrics = validMetrics[0];
  const merged = validMetrics.reduce((currentMetrics, nextMetrics) => ({
    contentBottom: Math.max(currentMetrics.contentBottom, nextMetrics.contentBottom),
    contentLeft: Math.min(currentMetrics.contentLeft, nextMetrics.contentLeft),
    contentRight: Math.max(currentMetrics.contentRight, nextMetrics.contentRight),
    contentTop: Math.min(currentMetrics.contentTop, nextMetrics.contentTop),
    displayHeight: Math.max(currentMetrics.displayHeight, nextMetrics.displayHeight),
    displayWidth: Math.max(currentMetrics.displayWidth, nextMetrics.displayWidth),
  }), baseMetrics);

  return {
    ...merged,
    contentBottom: Math.min(merged.displayHeight, merged.contentBottom),
    contentLeft: Math.max(0, merged.contentLeft),
    contentRight: Math.min(merged.displayWidth, merged.contentRight),
    contentTop: Math.max(0, merged.contentTop),
  } satisfies SpriteMetrics;
}

function mergeSpriteMetricsPair(
  currentMetrics: SpriteMetrics | null,
  nextMetrics: SpriteMetrics,
) {
  if (!currentMetrics) {
    return nextMetrics;
  }

  return mergeSpriteMetrics([currentMetrics, nextMetrics]);
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function loadSequenceSpriteAssets(frameUrls: string[]) {
  const cacheKey = frameUrls.join('|');
  const cachedEntry = sequenceSpriteCache.get(cacheKey);
  if (cachedEntry) {
    return cachedEntry;
  }

  const pendingTask = pendingSequenceSpriteCache.get(cacheKey);
  if (pendingTask) {
    return pendingTask;
  }

  const task = (async () => {
    const alignedFrameUrls: string[] = [];
    const loadedEntries: CleanedSpriteCacheEntry[] = [];

    for (let frameIndex = 0; frameIndex < frameUrls.length; frameIndex += 1) {
      const entry = await cleanupSprite(frameUrls[frameIndex]);
      loadedEntries.push(entry);

      if ((frameIndex + 1) % SEQUENCE_METRICS_YIELD_EVERY === 0) {
        await waitForNextFrame();
      }
    }

    const cropBounds = loadedEntries.reduce((currentBounds, entry) => {
      const cropLeft = entry.sourceMetrics.contentLeft - entry.metrics.contentLeft;
      const cropTop = entry.sourceMetrics.contentTop - entry.metrics.contentTop;
      const cropRight = cropLeft + entry.metrics.displayWidth;
      const cropBottom = cropTop + entry.metrics.displayHeight;

      return {
        left: Math.min(currentBounds.left, cropLeft),
        top: Math.min(currentBounds.top, cropTop),
        right: Math.max(currentBounds.right, cropRight),
        bottom: Math.max(currentBounds.bottom, cropBottom),
      };
    }, {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    });

    const commonWidth = Math.max(1, Math.round(cropBounds.right - cropBounds.left));
    const commonHeight = Math.max(1, Math.round(cropBounds.bottom - cropBounds.top));
    let mergedMetrics: SpriteMetrics | null = null;

    for (const entry of loadedEntries) {
      const cropLeft = entry.sourceMetrics.contentLeft - entry.metrics.contentLeft;
      const cropTop = entry.sourceMetrics.contentTop - entry.metrics.contentTop;
      const offsetX = Math.round(cropLeft - cropBounds.left);
      const offsetY = Math.round(cropTop - cropBounds.top);
      const alignedCanvas = document.createElement('canvas');
      alignedCanvas.width = commonWidth;
      alignedCanvas.height = commonHeight;
      const alignedContext = alignedCanvas.getContext('2d');

      if (!alignedContext) {
        alignedFrameUrls.push(entry.cleanedUrl);
        continue;
      }

      const frameImage = await loadImage(entry.cleanedUrl);
      alignedContext.drawImage(frameImage, offsetX, offsetY);
      alignedFrameUrls.push(alignedCanvas.toDataURL('image/png'));

      mergedMetrics = mergeSpriteMetricsPair(mergedMetrics, {
        contentLeft: offsetX + entry.metrics.contentLeft,
        contentRight: offsetX + entry.metrics.contentRight,
        contentTop: offsetY + entry.metrics.contentTop,
        contentBottom: offsetY + entry.metrics.contentBottom,
        displayWidth: commonWidth,
        displayHeight: commonHeight,
      });
    }

    const nextCacheEntry = {
      displayFrames: alignedFrameUrls,
      metrics: mergedMetrics,
    } satisfies SequenceSpriteCacheEntry;

    sequenceSpriteCache.set(cacheKey, nextCacheEntry);
    pendingSequenceSpriteCache.delete(cacheKey);
    return nextCacheEntry;
  })().catch((error) => {
    pendingSequenceSpriteCache.delete(cacheKey);
    throw error;
  });

  pendingSequenceSpriteCache.set(cacheKey, task);
  return task;
}

function mergeVisualBounds(
  currentBounds: DirectionalExtents | null,
  nextBounds: DirectionalExtents,
) {
  if (!currentBounds) {
    return nextBounds;
  }

  return {
    left: Math.max(currentBounds.left, nextBounds.left),
    right: Math.max(currentBounds.right, nextBounds.right),
    top: Math.max(currentBounds.top, nextBounds.top),
    bottom: Math.max(currentBounds.bottom, nextBounds.bottom),
  };
}

function PetModel2D({
  url,
  scale = 1,
  action = 'IDLE',
  contentManifest = null,
  expressionAction = null,
  isDragging = false,
  isMoving = false,
  presentationState,
  renderAdapterState,
  sequenceFrameDurationMultiplier = 1,
  sequenceFrames = [],
  focusTarget = null,
  pointerLookTarget = null,
  onVisualBoundsChange,
}: PetModel2DProps) {
  const configuredSequenceFrames = sequenceFrames.length > 0 ? sequenceFrames : null;
  const walkSequenceFrameUrls = configuredSequenceFrames ?? resolvePet2DMotionSequenceFrames(
      contentManifest,
      url,
      'walking',
    );
  const [selectedExpressionSequenceFrames, setSelectedExpressionSequenceFrames] = useState<string[] | null>(null);
  const activeSequenceFrameUrls = selectedExpressionSequenceFrames ?? walkSequenceFrameUrls;
  const isSequenceModel = Boolean(activeSequenceFrameUrls?.length);
  const sequenceCacheKey = activeSequenceFrameUrls?.join('|') ?? '';
  const cachedSequenceEntry = isSequenceModel
    ? sequenceSpriteCache.get(sequenceCacheKey)
    : null;
  const [displayFrames, setDisplayFrames] = useState<string[]>(() => (
    isSequenceModel
      ? (cachedSequenceEntry?.displayFrames ?? activeSequenceFrameUrls ?? [url])
      : [cleanedSpriteCache.get(url)?.cleanedUrl ?? url]
  ));
  const [displayUrl, setDisplayUrl] = useState<string>(() => (
    isSequenceModel
      ? (cachedSequenceEntry?.displayFrames[0] ?? activeSequenceFrameUrls?.[0] ?? url)
      : (cleanedSpriteCache.get(url)?.cleanedUrl ?? url)
  ));
  const [spriteMetrics, setSpriteMetrics] = useState<SpriteMetrics | null>(() => (
    isSequenceModel
      ? (cachedSequenceEntry?.metrics ?? null)
      : (cleanedSpriteCache.get(url)?.metrics ?? null)
  ));
  const [boundsSampleToken, setBoundsSampleToken] = useState(0);
  const [imageLoadFailedUrl, setImageLoadFailedUrl] = useState<string | null>(null);
  const [faceDirection, setFaceDirection] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const onVisualBoundsChangeRef = useRef(onVisualBoundsChange);
  const currentFrameIndexRef = useRef(0);
  const lastSequenceTickAtRef = useRef<number | null>(null);
  const sequenceFrameCarryMsRef = useRef(0);
  const faceDirectionRef = useRef(1);
  const basePresentationState = renderAdapterState?.presentationState ?? presentationState
    ?? resolvePet2DPresentationState({
      action,
      expressionAction,
      isMoving,
    });
  const hasAnimatedSequence = isSequenceModel && displayFrames.length > 1;
  const showBuiltInFallback = imageLoadFailedUrl === url;
  const handleImageError = () => {
    if (imageLoadFailedUrl === url) {
      return;
    }
    pushFrontendRuntimeLog('model', '2d model image failed to load; showing the built-in pet', { modelUrl: url });
    setImageLoadFailedUrl(url);
  };
  const isExpressionSequenceActive = Boolean(selectedExpressionSequenceFrames?.length);
  const resolvedRenderAdapterState = resolvePet2DRenderAdapterState({
    action,
    expressionAction,
    hasAnimatedSequence,
    isAutoMoving: renderAdapterState?.actionPresentationProfile.shouldShowAutoMoveOverlay ?? false,
    isExpressionSequenceActive,
    isMoving,
    presentationState: basePresentationState,
    scale,
    sequenceFrameDurationMultiplier,
  });
  const resolvedPresentationState = resolvedRenderAdapterState.presentationState;
  const actionPresentationProfile = resolvedRenderAdapterState.actionPresentationProfile;
  const visualPreset = actionPresentationProfile.animationPreset;
  // Imported 2D sequences are authored animations, so they must keep playing
  // while the pet is idle too. Built-in walk sequences retain their original
  // movement-only behavior.
  // A sequence is an authored animated appearance. Turning off automatic
  // movement must only stop position updates, never freeze its frames.
  const isSequencePlaying = hasAnimatedSequence;
  const boundsSampleKey = hasAnimatedSequence ? (sequenceCacheKey || url) : displayUrl;

  useEffect(() => {
    onVisualBoundsChangeRef.current = onVisualBoundsChange;
  }, [onVisualBoundsChange]);

  useEffect(() => {
    const visualFocusTarget = pointerLookTarget ?? focusTarget;
    if (!visualFocusTarget || Math.abs(visualFocusTarget.x) < 0.25) {
      return;
    }

    const nextFaceDirection = resolve2dFaceDirectionScale(visualFocusTarget.x);
    if (nextFaceDirection === null) {
      return;
    }

    faceDirectionRef.current = nextFaceDirection;
    setFaceDirection((currentDirection) => (
      currentDirection === nextFaceDirection ? currentDirection : nextFaceDirection
    ));
  }, [focusTarget, pointerLookTarget]);

  useEffect(() => {
    if (!isSupportedExpressionSequenceAction(expressionAction)) {
      setSelectedExpressionSequenceFrames(null);
      return;
    }

    const nextExpressionSequenceFrames = resolvePet2DExpressionSequenceFrames(
      contentManifest,
      url,
      expressionAction,
    );
    setSelectedExpressionSequenceFrames(nextExpressionSequenceFrames);
  }, [contentManifest, expressionAction, url]);

  useEffect(() => {
    let isActive = true;
    currentFrameIndexRef.current = 0;

    if (isSequenceModel) {
      const initialFrames = cachedSequenceEntry?.displayFrames ?? activeSequenceFrameUrls ?? [url];
      setDisplayFrames(initialFrames);
      setDisplayUrl(initialFrames[0] ?? url);
      setSpriteMetrics(cachedSequenceEntry?.metrics ?? null);
      setBoundsSampleToken((currentValue) => currentValue + 1);

      loadSequenceSpriteAssets(activeSequenceFrameUrls ?? [url])
        .then((sequenceEntry) => {
          if (!isActive) {
            return;
          }

          setDisplayFrames(sequenceEntry.displayFrames);
          setDisplayUrl(sequenceEntry.displayFrames[0] ?? url);
          setSpriteMetrics(sequenceEntry.metrics);
          setBoundsSampleToken((currentValue) => currentValue + 1);
        })
        .catch(() => {
          if (!isActive) {
            return;
          }

          setSpriteMetrics(null);
          setBoundsSampleToken((currentValue) => currentValue + 1);
        });

      return () => {
        isActive = false;
      };
    }

    const cached = cleanedSpriteCache.get(url);
    setDisplayFrames([cached?.cleanedUrl ?? url]);
    setDisplayUrl(cached?.cleanedUrl ?? url);
    setSpriteMetrics(cached?.metrics ?? null);

    cleanupSprite(url)
      .then((cleanedEntry) => {
        if (isActive) {
          setDisplayFrames([cleanedEntry.cleanedUrl]);
          setDisplayUrl(cleanedEntry.cleanedUrl);
          setSpriteMetrics(cleanedEntry.metrics);
        }
      })
      .catch(() => {
        if (isActive) {
          setDisplayFrames([url]);
          setDisplayUrl(url);
          setSpriteMetrics(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeSequenceFrameUrls, cachedSequenceEntry, isSequenceModel, sequenceCacheKey, url]);

  useEffect(() => {
    if (!isSequenceModel) {
      currentFrameIndexRef.current = 0;
      lastSequenceTickAtRef.current = null;
      sequenceFrameCarryMsRef.current = 0;
      setDisplayUrl(displayFrames[0] ?? url);
      return;
    }

    currentFrameIndexRef.current = 0;
    lastSequenceTickAtRef.current = null;
    sequenceFrameCarryMsRef.current = 0;
    setDisplayUrl(displayFrames[0] ?? url);
    return undefined;
  }, [displayFrames, isSequenceModel, url]);

  useEffect(() => {
    if (!hasAnimatedSequence) {
      return;
    }

    const frameElement = imageRef.current;
    if (!(frameElement instanceof HTMLImageElement)) {
      return;
    }

    const applyFrameAtIndex = (frameIndex: number) => {
      const nextFrameUrl = displayFrames[frameIndex] ?? displayFrames[0] ?? url;
      if (frameElement.dataset.frameUrl === nextFrameUrl && frameElement.src === nextFrameUrl) {
        return;
      }

      frameElement.dataset.frameUrl = nextFrameUrl;
      frameElement.src = nextFrameUrl;
    };

    applyFrameAtIndex(0);
    currentFrameIndexRef.current = 0;

    const unsubscribe = subscribeSharedAnimationTick((timestamp) => {
      if (!displayFrames.length) {
        return;
      }

      if (!isSequencePlaying || isDragging) {
        lastSequenceTickAtRef.current = null;
        sequenceFrameCarryMsRef.current = 0;
        currentFrameIndexRef.current = 0;
        applyFrameAtIndex(0);
        return;
      }

      if (lastSequenceTickAtRef.current === null) {
        lastSequenceTickAtRef.current = timestamp;
        return;
      }

      const elapsedMs = Math.min(64, Math.max(0, timestamp - lastSequenceTickAtRef.current));
      lastSequenceTickAtRef.current = timestamp;
      const frameDurationMs = actionPresentationProfile.sequence.frameDurationMs;
      const accumulatedMs = sequenceFrameCarryMsRef.current + elapsedMs;
      if (accumulatedMs < frameDurationMs) {
        sequenceFrameCarryMsRef.current = accumulatedMs;
        return;
      }

      sequenceFrameCarryMsRef.current = accumulatedMs % Math.max(1, frameDurationMs);
      const nextFrameIndex = (currentFrameIndexRef.current + 1) % Math.max(1, displayFrames.length);
      currentFrameIndexRef.current = nextFrameIndex;
      applyFrameAtIndex(nextFrameIndex);
    });

    return () => {
      unsubscribe();
    };
  }, [
    actionPresentationProfile.sequence.frameDurationMs,
    displayFrames,
    hasAnimatedSequence,
    isDragging,
    isSequencePlaying,
    url,
  ]);

  useEffect(() => {
    if (!onVisualBoundsChangeRef.current || isDragging) {
      return;
    }

    let animationFrameId: number | null = null;
    let timerId: number | null = null;
    let maxMeasuredBounds: DirectionalExtents | null = null;
    let sampleAttempts = 0;
    let successfulSamples = 0;
    const targetSuccessfulSamples = hasAnimatedSequence ? 2 : 1;
    const maxSampleAttempts = hasAnimatedSequence ? 4 : 3;
    const resampleDelayMs = hasAnimatedSequence ? 72 : 24;

    const measureVisualBounds = () => {
      const containerElement = containerRef.current;
      const imageElement = imageRef.current;
      if (!containerElement || !imageElement) {
        return null;
      }

      const containerRect = containerElement.getBoundingClientRect();
      const imageRect = imageElement.getBoundingClientRect();
      if (
        containerRect.width <= 0
        || containerRect.height <= 0
        || imageRect.width <= 0
        || imageRect.height <= 0
      ) {
        return null;
      }

      const centerX = containerRect.left + containerRect.width / 2;
      const centerY = containerRect.top + containerRect.height / 2;
      const resolvedMetrics = (
        spriteMetrics
        && spriteMetrics.displayWidth > 0
        && spriteMetrics.displayHeight > 0
        && spriteMetrics.contentRight > spriteMetrics.contentLeft
        && spriteMetrics.contentBottom > spriteMetrics.contentTop
      )
        ? spriteMetrics
        : null;

      if (resolvedMetrics) {
        const visibleLeft = imageRect.left + (imageRect.width * resolvedMetrics.contentLeft / resolvedMetrics.displayWidth);
        const visibleRight = imageRect.left + (imageRect.width * resolvedMetrics.contentRight / resolvedMetrics.displayWidth);
        const visibleTop = imageRect.top + (imageRect.height * resolvedMetrics.contentTop / resolvedMetrics.displayHeight);
        const visibleBottom = imageRect.top + (imageRect.height * resolvedMetrics.contentBottom / resolvedMetrics.displayHeight);

        return {
          left: Math.max(0, Math.ceil(centerX - visibleLeft)),
          right: Math.max(0, Math.ceil(visibleRight - centerX)),
          top: Math.max(0, Math.ceil(centerY - visibleTop)),
          bottom: Math.max(0, Math.ceil(visibleBottom - centerY)),
        } satisfies DirectionalExtents;
      }

      return {
        left: Math.max(0, Math.ceil(centerX - imageRect.left)),
        right: Math.max(0, Math.ceil(imageRect.right - centerX)),
        top: Math.max(0, Math.ceil(centerY - imageRect.top)),
        bottom: Math.max(0, Math.ceil(imageRect.bottom - centerY)),
      } satisfies DirectionalExtents;
    };

    const sampleVisualBounds = () => {
      sampleAttempts += 1;
      const measuredBounds = measureVisualBounds();
      if (measuredBounds) {
        maxMeasuredBounds = mergeVisualBounds(maxMeasuredBounds, measuredBounds);
        successfulSamples += 1;
      }

      if (successfulSamples >= targetSuccessfulSamples || sampleAttempts >= maxSampleAttempts) {
        if (maxMeasuredBounds) {
          onVisualBoundsChangeRef.current?.(maxMeasuredBounds);
        }
        return;
      }

      timerId = window.setTimeout(() => {
        animationFrameId = window.requestAnimationFrame(sampleVisualBounds);
      }, resampleDelayMs);
    };

    animationFrameId = window.requestAnimationFrame(sampleVisualBounds);

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    boundsSampleToken,
    boundsSampleKey,
    hasAnimatedSequence,
    isDragging,
    scale,
    spriteMetrics,
  ]);

  const spriteAnimationClassName = isDragging
    ? 'pet-anim-dragging'
    : visualPreset.className;
  const pointerLookStyle = resolvePointerLookVisualStyle({
    maxRotateDeg: 5.2,
    maxTranslateX: 8,
    maxTranslateY: 5.2,
    target: pointerLookTarget,
  });
  const spriteStyle = {
    '--pet-scale-base': `${scale}`,
    '--pet-scale-peak': `${visualPreset.peakScale}`,
    '--pet-face-direction': `${faceDirection}`,
    '--pet-opacity-low': `${visualPreset.lowOpacity}`,
    animationDuration: `${visualPreset.durationMs}ms`,
  } as CSSProperties;
  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-visible">
      <div
        className={`pet-anim-shell flex h-full w-full items-center justify-center ${spriteAnimationClassName}`}
        style={spriteStyle}
      >
        <div className="flex h-full w-full items-center justify-center" style={pointerLookStyle}>
          {showBuiltInFallback ? (
            <img
              src={DEFAULT_BUILTIN_STATIC_PET_MODEL_URL}
              alt="Pet model failed to load; showing the built-in pet"
              className="max-h-full max-w-full object-contain"
            />
          ) : hasAnimatedSequence ? (
            <img
              ref={imageRef}
              src={displayFrames[0] ?? url}
              alt="Pet"
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
              onError={handleImageError}
            />
          ) : (
            <img
              ref={imageRef}
              src={displayUrl}
              alt="Pet"
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
              onError={handleImageError}
              onLoad={() => {
                if (!hasAnimatedSequence) {
                  setBoundsSampleToken((currentValue) => currentValue + 1);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const MemoizedPetModel2D = memo(PetModel2D);
MemoizedPetModel2D.displayName = 'PetModel2D';

export default MemoizedPetModel2D;
