import {
  resolveVisualSnapshotSourceImage,
} from '../visual/visualSnapshotSourceImage';
import {
  desktopPetShellRuntime,
} from '../../desktopShellRuntime';
import {
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  analyzeAgentCaptureDataUrl,
  compareAgentCaptureDataUrls,
  createAgentCaptureRedDotPreview,
  formatAgentCaptureQualityLine,
  type AgentCaptureQualityAnalysis,
  type AgentInputReplayPreview,
} from '../agentCaptureQuality';
import {
  createAgentCoordinateAuditEvidence,
  formatAgentCoordinateAuditLine,
} from '../agentCoordinateAudit';
import {
  evaluateAgentCoordinateReplayClosureHarness,
} from '../agentCoordinateHarness';
import {
  getToolNumberInputAny,
  getToolStringInput,
  shouldDefaultDesktopInputToNativeScreen,
  hasDesktopInputPoint,
} from './desktopToolInput';

export function resolveDesktopInputReplayPoint(toolCall: AgentToolCallCommand, action: string) {
  if (action === 'drag') {
    const toX = getToolNumberInputAny(toolCall, ['toX', 'targetX', 'endX']);
    const toY = getToolNumberInputAny(toolCall, ['toY', 'targetY', 'endY']);
    if (typeof toX === 'number' && typeof toY === 'number') {
      return {
        x: Math.round(toX),
        y: Math.round(toY),
      };
    }
  }

  const x = getToolNumberInputAny(toolCall, ['x', 'nativeScreenX', 'clientX']);
  const y = getToolNumberInputAny(toolCall, ['y', 'nativeScreenY', 'clientY']);
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

export function shouldUseToolCallPointForNativeScreenReplay(toolCall: AgentToolCallCommand, action: string) {
  const explicitCoordinateSpace = getToolStringInput(toolCall, ['coordinateSpace']).toLowerCase();
  if (explicitCoordinateSpace) {
    return explicitCoordinateSpace === 'native-screen';
  }

  return shouldDefaultDesktopInputToNativeScreen(action) && hasDesktopInputPoint(toolCall, action);
}

function getDesktopInputResultNumber(result: Record<string, unknown>, key: string) {
  const value = result[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? Math.round(numberValue) : null;
}

export function resolveDesktopInputResultReplayPoint(
  result: Record<string, unknown> | null | undefined,
  action: string,
) {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const x = action === 'drag'
    ? getDesktopInputResultNumber(result, 'toX')
    : getDesktopInputResultNumber(result, 'x');
  const y = action === 'drag'
    ? getDesktopInputResultNumber(result, 'toY')
    : getDesktopInputResultNumber(result, 'y');
  if (x === null || y === null) {
    return null;
  }

  return { x, y };
}

export function shouldCaptureDesktopInputReplay(action: string) {
  return action === 'click'
    || action === 'double_click'
    || action === 'right_click'
    || action === 'drag';
}

function findDesktopInputReplayScreenSource(
  sources: DesktopPetCaptureSourceLike[],
  point: { x: number; y: number },
) {
  const screenSources = sources.filter((source) => source.type === 'screen' && Boolean(source.thumbnail));
  return screenSources.find((source) => {
    const bounds = source.bounds;
    return Boolean(
      bounds
      && point.x >= bounds.x
      && point.x <= bounds.x + bounds.width
      && point.y >= bounds.y
      && point.y <= bounds.y + bounds.height,
    );
  }) ?? screenSources[0] ?? null;
}

async function captureDesktopInputReplayFrame(point: { x: number; y: number }) {
  const sources = await desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes: ['screen'],
    forceRefresh: true,
    includeCaptureThumbnails: true,
  }) as DesktopPetCaptureSourceLike[];
  const screenSources = Array.isArray(sources) ? sources : [];
  const source = findDesktopInputReplayScreenSource(screenSources, point);
  if (!source?.thumbnail) {
    return null;
  }

  const imageDataUrl = await resolveVisualSnapshotSourceImage(source);
  const quality = await analyzeAgentCaptureDataUrl(imageDataUrl);
  const coordinateAudit = createAgentCoordinateAuditEvidence({
    displaySources: screenSources,
    point,
    source,
  });
  const redDotDataUrl = await createAgentCaptureRedDotPreview({
    imageDataUrl,
    point,
    source,
  });

  return {
    coordinateAudit,
    displaySources: screenSources,
    imageDataUrl,
    quality,
    redDotDataUrl,
    source,
  };
}

async function waitForDesktopInputReplayAfterCapture() {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, 220);
  });
}

export async function captureDesktopInputReplayBefore(point: { x: number; y: number } | null) {
  if (!point) {
    return null;
  }

  try {
    return await captureDesktopInputReplayFrame(point);
  } catch {
    return null;
  }
}

export async function captureDesktopInputReplayAfter(options: {
  beforeImageDataUrl?: string | null;
  point: { x: number; y: number } | null;
}) {
  if (!options.point) {
    return null;
  }

  try {
    await waitForDesktopInputReplayAfterCapture();
    const frame = await captureDesktopInputReplayFrame(options.point);
    if (!frame) {
      return null;
    }

    const delta = options.beforeImageDataUrl
      ? await compareAgentCaptureDataUrls(options.beforeImageDataUrl, frame.imageDataUrl).catch(() => null)
      : null;

    return {
      ...frame,
      delta,
    };
  } catch {
    return null;
  }
}

export function createDesktopInputReplayEvidence(options: {
  after: Awaited<ReturnType<typeof captureDesktopInputReplayAfter>>;
  before: Awaited<ReturnType<typeof captureDesktopInputReplayBefore>>;
  point: { x: number; y: number } | null;
}) {
  const beforeRegionSignature = options.after?.delta
    ? options.after.delta.uiChanged
      ? 'before-change'
      : 'unchanged'
    : null;
  const afterRegionSignature = options.after?.delta
    ? options.after.delta.uiChanged
      ? 'after-change'
      : 'unchanged'
    : null;
  const replaySource = options.after?.source ?? options.before?.source ?? null;
  const replayDisplaySources = options.after?.displaySources?.length
    ? options.after.displaySources
    : options.before?.displaySources ?? [];
  const coordinateClosure = options.point && replaySource
    ? evaluateAgentCoordinateReplayClosureHarness({
        afterRegion: {
          signature: afterRegionSignature,
          trusted: options.after?.quality.trusted ?? null,
        },
        beforeRegion: {
          signature: beforeRegionSignature,
          trusted: options.before?.quality.trusted ?? null,
        },
        clickPoint: options.point,
        displaySources: replayDisplaySources,
        source: replaySource,
      })
    : null;
  const preview: AgentInputReplayPreview | null = options.point
    ? {
        afterCaptureStatus: options.after?.quality.status ?? null,
        afterRedDotDataUrl: options.after?.redDotDataUrl ?? null,
        beforeCaptureStatus: options.before?.quality.status ?? null,
        beforeRedDotDataUrl: options.before?.redDotDataUrl ?? null,
        clickPoint: options.point,
        coordinateAudit: options.after?.coordinateAudit ?? options.before?.coordinateAudit ?? null,
        coordinateClosure,
        coordinateClosureStatus: coordinateClosure?.status ?? null,
        screenSource: options.after?.source.name ?? options.before?.source.name ?? null,
        uiChanged: options.after?.delta?.uiChanged ?? null,
        visualDeltaRatio: options.after?.delta?.changedRatio ?? null,
      }
    : null;
  const coordinateAudit = preview?.coordinateAudit ?? null;
  const coordinateAuditLine = formatAgentCoordinateAuditLine(coordinateAudit, 'Input replay coordinate audit');
  const lines = [
    options.point ? `Input replay point: x=${options.point.x} y=${options.point.y}` : '',
    coordinateAuditLine,
    options.before?.quality ? formatAgentCaptureQualityLine(options.before.quality, 'Input replay before capture') : '',
    options.after?.quality ? formatAgentCaptureQualityLine(options.after.quality, 'Input replay after capture') : '',
    options.after?.delta
      ? `Input replay visual delta: changed=${options.after.delta.uiChanged} changedRatio=${options.after.delta.changedRatio} meanDiff=${options.after.delta.meanDiff}`
      : '',
    coordinateClosure
      ? `Input replay coordinate closure: status=${coordinateClosure.status} targetRegionChanged=${coordinateClosure.targetRegionChanged} redDotRatio=${coordinateClosure.redDotRatio ? `${coordinateClosure.redDotRatio.x},${coordinateClosure.redDotRatio.y}` : 'unknown'}`
      : '',
    preview?.beforeRedDotDataUrl ? 'Input replay before red-dot preview captured.' : '',
    preview?.afterRedDotDataUrl ? 'Input replay after red-dot preview captured.' : '',
  ].filter(Boolean);
  const untrustedCaptures = [
    options.before?.quality,
    options.after?.quality,
  ].filter((quality): quality is AgentCaptureQualityAnalysis => Boolean(quality && !quality.trusted));
  const coordinateAuditMissingEvidence = coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
    ? [`Input replay coordinate audit failed: ${coordinateAudit.status} (${coordinateAudit.reason})`]
    : [];
  const coordinateClosureMissingEvidence = coordinateClosure && coordinateClosure.status !== 'coordinate_closure_ok'
    ? [`Input replay coordinate closure failed: ${coordinateClosure.status}`]
    : [];

  return {
    lines,
    missingEvidence: [
      ...untrustedCaptures.map((quality) => `Input replay capture untrusted: ${quality.status} (${quality.reason})`),
      ...coordinateAuditMissingEvidence,
      ...coordinateClosureMissingEvidence,
    ],
    preview,
  };
}
