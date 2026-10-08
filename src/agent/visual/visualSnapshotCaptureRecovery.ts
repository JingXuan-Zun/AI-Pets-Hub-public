import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { analyzeAgentCaptureDataUrl } from '../agentCaptureQuality';
import { type AgentToolCallCommand } from '../agentChatCommand';
import { scoreVisualSnapshotSourceMatch } from './captureSourceMatching';
import { type VisualSnapshotFocusCropRequest, type VisualSnapshotPreparedSource } from './visualSnapshotCropTypes';
import { createFocusedVisualSnapshotSource } from './visualSnapshotFocusedCapture';
import { resolveVisualSnapshotSourceBounds } from './visualSnapshotSourceBounds';


function findVisualSnapshotScreenSourceForBounds(
  sources: DesktopPetCaptureSourceLike[],
  bounds: DesktopPetCaptureRectLike | null,
) {
  const screenSources = sources.filter((source) => source.type === 'screen' && Boolean(source.thumbnail));
  if (!screenSources.length) {
    return null;
  }

  if (!bounds) {
    return screenSources[0] ?? null;
  }

  const pointX = bounds.x + bounds.width / 2;
  const pointY = bounds.y + bounds.height / 2;
  return screenSources.find((source) => {
    const screenBounds = resolveVisualSnapshotSourceBounds(source);
    return Boolean(
      screenBounds
      && pointX >= screenBounds.x
      && pointX <= screenBounds.x + screenBounds.width
      && pointY >= screenBounds.y
      && pointY <= screenBounds.y + screenBounds.height,
    );
  }) ?? screenSources[0] ?? null;
}

function resolveVisualSnapshotFallbackCropRequest(options: {
  screenSource: DesktopPetCaptureSourceLike;
  windowSource: DesktopPetCaptureSourceLike;
}): VisualSnapshotFocusCropRequest | null {
  const windowBounds = resolveVisualSnapshotSourceBounds(options.windowSource);
  const screenBounds = resolveVisualSnapshotSourceBounds(options.screenSource);
  if (!windowBounds || !screenBounds) {
    return null;
  }

  const intersectionX = Math.max(windowBounds.x, screenBounds.x);
  const intersectionY = Math.max(windowBounds.y, screenBounds.y);
  const intersectionRight = Math.min(windowBounds.x + windowBounds.width, screenBounds.x + screenBounds.width);
  const intersectionBottom = Math.min(windowBounds.y + windowBounds.height, screenBounds.y + screenBounds.height);
  const width = Math.round(intersectionRight - intersectionX);
  const height = Math.round(intersectionBottom - intersectionY);
  if (width <= 8 || height <= 8) {
    return null;
  }

  return {
    coordinateSpace: 'native-screen',
    height,
    paddingRatio: 0,
    scale: 1,
    width,
    x: Math.round(intersectionX),
    y: Math.round(intersectionY),
  };
}

async function createFallbackScreenCropVisualSnapshotSource(options: {
  reason: string;
  screenSource: DesktopPetCaptureSourceLike;
  windowSource: DesktopPetCaptureSourceLike;
}) {
  const cropRequest = resolveVisualSnapshotFallbackCropRequest({
    screenSource: options.screenSource,
    windowSource: options.windowSource,
  });
  if (!cropRequest) {
    return null;
  }

  const fallbackToolCall: AgentToolCallCommand = {
    goal: 'fallback screen crop for window capture',
    input: {
      focusCoordinateSpace: 'native-screen',
      focusHeight: cropRequest.height,
      focusPaddingRatio: 0,
      focusScale: 1,
      focusWidth: cropRequest.width,
      focusX: cropRequest.x,
      focusY: cropRequest.y,
    },
    name: 'summarize_visual_snapshot',
  };
  const focusedSource = await createFocusedVisualSnapshotSource({
    source: options.screenSource,
    toolCall: fallbackToolCall,
  });
  const quality = await analyzeAgentCaptureDataUrl(focusedSource.imageDataUrl);

  return {
    captureFallbackLine: [
      'Capture fallback: capture_fallback_screen_crop',
      `from=${options.windowSource.id || options.windowSource.name}`,
      `to=${options.screenSource.id || options.screenSource.name}`,
      `reason=${options.reason}`,
    ].join(' | '),
    captureQuality: quality.trusted
      ? {
          ...quality,
          reason: `Fallback screen crop trusted after window capture issue: ${quality.reason}`,
          status: 'capture_fallback_screen_crop' as const,
          trusted: true,
        }
      : {
          ...quality,
          reason: `Fallback screen crop is still untrusted: ${quality.reason}`,
          status: 'capture_untrusted' as const,
          trusted: false,
        },
    cropLine: focusedSource.cropLine,
    imageDataUrl: focusedSource.imageDataUrl,
    source: {
      ...focusedSource.source,
      id: focusedSource.source.id || options.screenSource.id,
      name: `${options.windowSource.name} via screen crop`,
      type: 'window',
    } satisfies DesktopPetCaptureSourceLike,
  } satisfies VisualSnapshotPreparedSource;
}

export async function createActiveWindowCaptureRecoverySource(options: {
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
}) {
  if (!options.query) {
    return null;
  }

  let activeWindow: {
    bounds?: DesktopPetCaptureRectLike | null;
    displayId?: string | null;
    displayLabel?: string | null;
    executablePath?: string | null;
    hwnd?: number | null;
    ok?: boolean;
    pid?: number | null;
    processName?: string | null;
    title?: string | null;
  };
  try {
    activeWindow = await desktopPetShellRuntime.getActiveWindowInfo();
  } catch {
    return null;
  }
  const bounds = activeWindow?.bounds;
  const hwnd = Number(activeWindow?.hwnd);
  if (
    activeWindow?.ok === false
    || !bounds
    || !Number.isFinite(hwnd)
    || hwnd <= 0
  ) {
    return null;
  }

  const windowSource: DesktopPetCaptureSourceLike = {
    bounds,
    boundsCoordinateSpace: 'native-screen',
    displayId: activeWindow.displayId ?? null,
    height: bounds.height,
    id: `window:active:${Math.round(hwnd)}`,
    name: activeWindow.title?.trim() || activeWindow.processName?.trim() || `active window ${Math.round(hwnd)}`,
    type: 'window',
    width: bounds.width,
  };
  if (scoreVisualSnapshotSourceMatch(windowSource, options.query) < 8) {
    return null;
  }

  const screenSource = findVisualSnapshotScreenSourceForBounds(options.availableSources, bounds);
  if (!screenSource?.thumbnail) {
    return null;
  }

  return createFallbackScreenCropVisualSnapshotSource({
    reason: 'active window HWND/bounds recovery',
    screenSource,
    windowSource,
  });
}

export async function createTrustedVisualSnapshotSource(options: {
  allowScreenFallback: boolean;
  availableSources: DesktopPetCaptureSourceLike[];
  selectedSource: DesktopPetCaptureSourceLike;
  toolCall: AgentToolCallCommand;
}): Promise<VisualSnapshotPreparedSource> {
  const focusedSource = await createFocusedVisualSnapshotSource({
    source: options.selectedSource,
    toolCall: options.toolCall,
  });
  const quality = await analyzeAgentCaptureDataUrl(focusedSource.imageDataUrl);
  if (
    quality.trusted
    || options.selectedSource.type !== 'window'
    || !options.allowScreenFallback
  ) {
    return {
      captureFallbackLine: '',
      captureQuality: quality,
      cropLine: focusedSource.cropLine,
      imageDataUrl: focusedSource.imageDataUrl,
      source: focusedSource.source,
    };
  }

  const screenSource = findVisualSnapshotScreenSourceForBounds(
    options.availableSources,
    resolveVisualSnapshotSourceBounds(options.selectedSource),
  );
  if (!screenSource?.thumbnail) {
    return {
      captureFallbackLine: 'Capture fallback unavailable: no screen source with thumbnail for the selected window bounds.',
      captureQuality: {
        ...quality,
        reason: `Window capture is untrusted and no screen fallback was available: ${quality.reason}`,
        status: 'capture_untrusted',
        trusted: false,
      },
      cropLine: focusedSource.cropLine,
      imageDataUrl: focusedSource.imageDataUrl,
      source: focusedSource.source,
    };
  }

  const fallbackSource = await createFallbackScreenCropVisualSnapshotSource({
    reason: quality.status,
    screenSource,
    windowSource: options.selectedSource,
  });
  return fallbackSource ?? {
    captureFallbackLine: 'Capture fallback unavailable: selected window bounds could not be mapped into a screen crop.',
    captureQuality: {
      ...quality,
      reason: `Window capture is untrusted and screen crop mapping failed: ${quality.reason}`,
      status: 'capture_untrusted',
      trusted: false,
    },
    cropLine: focusedSource.cropLine,
    imageDataUrl: focusedSource.imageDataUrl,
    source: focusedSource.source,
  };
}
