type ManagedMediaStream = MediaStream & {
  __desktopPetCleanup?: () => void;
};

export function cloneCaptureOptions(options?: DesktopPetCaptureOptionsLike | null) {
  if (!options) {
    return null;
  }

  return {
    ...options,
    cropRect: options.cropRect ? { ...options.cropRect } : null,
    areaSources: Array.isArray(options.areaSources)
      ? options.areaSources.map((source) => ({ ...source }))
      : undefined,
  } satisfies DesktopPetCaptureOptionsLike;
}

function captureRectEqual(
  firstRect: DesktopPetCaptureRectLike | null | undefined,
  secondRect: DesktopPetCaptureRectLike | null | undefined,
) {
  if (!firstRect && !secondRect) {
    return true;
  }

  if (!firstRect || !secondRect) {
    return false;
  }

  return firstRect.x === secondRect.x
    && firstRect.y === secondRect.y
    && firstRect.width === secondRect.width
    && firstRect.height === secondRect.height;
}

function areaSourcesEqual(
  firstSources: DesktopPetAreaSourceLike[] | undefined,
  secondSources: DesktopPetAreaSourceLike[] | undefined,
) {
  if (!firstSources?.length && !secondSources?.length) {
    return true;
  }

  if (!firstSources || !secondSources || firstSources.length !== secondSources.length) {
    return false;
  }

  return firstSources.every((source, index) => {
    const nextSource = secondSources[index];
    return source.displayId === nextSource.displayId
      && source.displayLabel === nextSource.displayLabel
      && source.sourceId === nextSource.sourceId
      && source.sourceName === nextSource.sourceName
      && source.sourceType === nextSource.sourceType
      && source.x === nextSource.x
      && source.y === nextSource.y
      && source.width === nextSource.width
      && source.height === nextSource.height;
  });
}

export function captureOptionsEqual(
  firstOptions: DesktopPetCaptureOptionsLike | null | undefined,
  secondOptions: DesktopPetCaptureOptionsLike | null | undefined,
) {
  if (!firstOptions && !secondOptions) {
    return true;
  }

  if (!firstOptions || !secondOptions) {
    return false;
  }

  return firstOptions.mode === secondOptions.mode
    && firstOptions.sourceId === secondOptions.sourceId
    && firstOptions.sourceName === secondOptions.sourceName
    && firstOptions.sourceType === secondOptions.sourceType
    && firstOptions.cropBasisX === secondOptions.cropBasisX
    && firstOptions.cropBasisY === secondOptions.cropBasisY
    && firstOptions.cropBasisWidth === secondOptions.cropBasisWidth
    && firstOptions.cropBasisHeight === secondOptions.cropBasisHeight
    && captureRectEqual(firstOptions.cropRect, secondOptions.cropRect)
    && areaSourcesEqual(firstOptions.areaSources, secondOptions.areaSources);
}

function stopManagedMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) {
    return;
  }

  const managedStream = stream as ManagedMediaStream;
  if (typeof managedStream.__desktopPetCleanup === 'function') {
    const cleanup = managedStream.__desktopPetCleanup;
    managedStream.__desktopPetCleanup = undefined;
    cleanup();
    return;
  }

  stream.getTracks().forEach((track) => track.stop());
}

export function releaseManagedMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.onended = null;
  });

  stopManagedMediaStream(stream);
}

function normalizeCaptureRect(
  cropRect: DesktopPetCaptureRectLike | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
) {
  if (!cropRect || sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  const x = Math.max(0, Math.min(sourceWidth - 1, Math.round(cropRect.x)));
  const y = Math.max(0, Math.min(sourceHeight - 1, Math.round(cropRect.y)));
  const width = Math.max(1, Math.min(sourceWidth - x, Math.round(cropRect.width)));
  const height = Math.max(1, Math.min(sourceHeight - y, Math.round(cropRect.height)));

  return { x, y, width, height };
}

function resolveCaptureContentRect(
  sourceWidth: number,
  sourceHeight: number,
  basisWidth: number,
  basisHeight: number,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  if (basisWidth <= 0 || basisHeight <= 0) {
    return {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const basisAspect = basisWidth / basisHeight;

  if (!Number.isFinite(sourceAspect) || !Number.isFinite(basisAspect) || Math.abs(sourceAspect - basisAspect) < 0.02) {
    return {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  if (sourceAspect > basisAspect) {
    const contentWidth = Math.max(1, Math.round(sourceHeight * basisAspect));
    return {
      x: Math.round((sourceWidth - contentWidth) / 2),
      y: 0,
      width: contentWidth,
      height: sourceHeight,
    };
  }

  const contentHeight = Math.max(1, Math.round(sourceWidth / basisAspect));
  return {
    x: 0,
    y: Math.round((sourceHeight - contentHeight) / 2),
    width: sourceWidth,
    height: contentHeight,
  };
}

export async function createDesktopSourceStream(sourceId: string) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Desktop source capture is not available in this environment');
  }

  const sourceStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: 7680,
        maxHeight: 4320,
        maxFrameRate: 60,
      },
    } as MediaTrackConstraints,
  });

  const managedSourceStream = sourceStream as ManagedMediaStream;
  managedSourceStream.__desktopPetCleanup = () => {
    sourceStream.getTracks().forEach((track) => track.stop());
  };

  return managedSourceStream;
}

async function createCapturePreview(sourceStream: MediaStream) {
  const preview = document.createElement('video');
  preview.srcObject = sourceStream;
  preview.muted = true;
  preview.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    preview.onloadedmetadata = () => {
      preview.play()
        .then(() => resolve())
        .catch(reject);
    };
    preview.onerror = () => reject(new Error('Unable to load capture preview metadata'));
  });

  return preview;
}

function resolveRectIntersection(
  firstRect: { x: number; y: number; width: number; height: number },
  secondRect: { x: number; y: number; width: number; height: number },
) {
  const left = Math.max(firstRect.x, secondRect.x);
  const top = Math.max(firstRect.y, secondRect.y);
  const right = Math.min(firstRect.x + firstRect.width, secondRect.x + secondRect.width);
  const bottom = Math.min(firstRect.y + firstRect.height, secondRect.y + secondRect.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export async function createCroppedCaptureStream(
  sourceStream: MediaStream,
  cropRect: DesktopPetCaptureRectLike,
  cropBasisWidth?: number,
  cropBasisHeight?: number,
) {
  const preview = await createCapturePreview(sourceStream);

  const basisWidth = cropBasisWidth && cropBasisWidth > 0 ? cropBasisWidth : preview.videoWidth;
  const basisHeight = cropBasisHeight && cropBasisHeight > 0 ? cropBasisHeight : preview.videoHeight;
  const contentRect = resolveCaptureContentRect(
    preview.videoWidth,
    preview.videoHeight,
    basisWidth,
    basisHeight,
  );
  if (!contentRect) {
    throw new Error('Unable to resolve capture content area');
  }

  const scaledCropRect = {
    x: contentRect.x + Math.round((cropRect.x / basisWidth) * contentRect.width),
    y: contentRect.y + Math.round((cropRect.y / basisHeight) * contentRect.height),
    width: Math.round((cropRect.width / basisWidth) * contentRect.width),
    height: Math.round((cropRect.height / basisHeight) * contentRect.height),
  };
  const normalizedRect = normalizeCaptureRect(scaledCropRect, preview.videoWidth, preview.videoHeight);
  if (!normalizedRect) {
    throw new Error('Invalid capture crop area');
  }

  const canvas = document.createElement('canvas');
  canvas.width = normalizedRect.width;
  canvas.height = normalizedRect.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Unable to initialize capture crop canvas');
  }

  let animationFrameId = 0;
  let disposed = false;

  const renderFrame = () => {
    if (disposed) {
      return;
    }

    if (preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      context.drawImage(
        preview,
        normalizedRect.x,
        normalizedRect.y,
        normalizedRect.width,
        normalizedRect.height,
        0,
        0,
        normalizedRect.width,
        normalizedRect.height,
      );
    }

    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  renderFrame();

  const outputStream = canvas.captureStream(30) as ManagedMediaStream;
  outputStream.__desktopPetCleanup = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    window.cancelAnimationFrame(animationFrameId);
    preview.pause();
    preview.srcObject = null;
    outputStream.getTracks().forEach((track) => track.stop());
    stopManagedMediaStream(sourceStream);
  };

  sourceStream.getTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      stopManagedMediaStream(outputStream);
    }, { once: true });
  });

  return outputStream;
}

export async function createCompositeCaptureStream(
  areaSources: DesktopPetAreaSourceLike[],
  cropRect: DesktopPetCaptureRectLike,
  cropBasisWidth?: number,
  cropBasisHeight?: number,
) {
  if (!areaSources.length) {
    throw new Error('No desktop area sources were provided');
  }

  const basisWidth = cropBasisWidth && cropBasisWidth > 0
    ? cropBasisWidth
    : Math.max(...areaSources.map((source) => source.x + source.width));
  const basisHeight = cropBasisHeight && cropBasisHeight > 0
    ? cropBasisHeight
    : Math.max(...areaSources.map((source) => source.y + source.height));
  const normalizedCropRect = normalizeCaptureRect(cropRect, basisWidth, basisHeight);
  if (!normalizedCropRect) {
    throw new Error('Invalid composite capture crop area');
  }

  const compositeSources = await Promise.all(areaSources.map(async (areaSource) => {
    const stream = await createDesktopSourceStream(areaSource.sourceId);
    const preview = await createCapturePreview(stream);
    const contentRect = resolveCaptureContentRect(
      preview.videoWidth,
      preview.videoHeight,
      areaSource.width,
      areaSource.height,
    );

    if (!contentRect) {
      preview.pause();
      preview.srcObject = null;
      stopManagedMediaStream(stream);
      throw new Error(`Unable to resolve desktop content for ${areaSource.sourceName}`);
    }

    return {
      areaSource,
      stream,
      preview,
      contentRect,
    };
  }));

  const canvas = document.createElement('canvas');
  canvas.width = normalizedCropRect.width;
  canvas.height = normalizedCropRect.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    compositeSources.forEach(({ preview, stream }) => {
      preview.pause();
      preview.srcObject = null;
      stopManagedMediaStream(stream);
    });
    throw new Error('Unable to initialize composite capture canvas');
  }

  let animationFrameId = 0;
  let disposed = false;

  const renderFrame = () => {
    if (disposed) {
      return;
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    compositeSources.forEach(({ areaSource, preview, contentRect }) => {
      if (preview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      const sourceRect = {
        x: areaSource.x,
        y: areaSource.y,
        width: areaSource.width,
        height: areaSource.height,
      };
      const intersectionRect = resolveRectIntersection(normalizedCropRect, sourceRect);
      if (!intersectionRect) {
        return;
      }

      const sampleX = contentRect.x + ((intersectionRect.x - areaSource.x) / areaSource.width) * contentRect.width;
      const sampleY = contentRect.y + ((intersectionRect.y - areaSource.y) / areaSource.height) * contentRect.height;
      const sampleWidth = (intersectionRect.width / areaSource.width) * contentRect.width;
      const sampleHeight = (intersectionRect.height / areaSource.height) * contentRect.height;

      context.drawImage(
        preview,
        sampleX,
        sampleY,
        sampleWidth,
        sampleHeight,
        intersectionRect.x - normalizedCropRect.x,
        intersectionRect.y - normalizedCropRect.y,
        intersectionRect.width,
        intersectionRect.height,
      );
    });

    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  renderFrame();

  const outputStream = canvas.captureStream(30) as ManagedMediaStream;
  outputStream.__desktopPetCleanup = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    window.cancelAnimationFrame(animationFrameId);
    compositeSources.forEach(({ preview, stream }) => {
      preview.pause();
      preview.srcObject = null;
      stopManagedMediaStream(stream);
    });
    outputStream.getTracks().forEach((track) => track.stop());
  };

  compositeSources.forEach(({ stream }) => {
    stream.getTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stopManagedMediaStream(outputStream);
      }, { once: true });
    });
  });

  return outputStream;
}
