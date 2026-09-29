import { type RefObject } from 'react';
import { type ModelType } from '../../types';

export type Position = {
  x: number;
  y: number;
};

export type ElementSnapshot = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  transform: string;
  transition: string;
  width: number;
} | null;

type Live2DRendererSnapshot = ElementSnapshot & {
  appliedSource?: string;
  currentX?: string;
  currentY?: string;
  lookSettle?: string;
  lookSource?: string;
  lookStrength?: string;
  lookX?: string;
  lookY?: string;
  parameterInfluence?: string;
  postAngleX?: string;
  postAngleY?: string;
  postAngleZ?: string;
  preAngleX?: string;
  preAngleY?: string;
  preAngleZ?: string;
  secondaryAngleX?: string;
  secondaryAngleY?: string;
  secondaryAngleZ?: string;
  secondaryPhysicsSuppression?: string;
  targetX?: string;
  targetY?: string;
  timedSource?: string;
};

export type Live2DDragProbeSample = {
  canvas: ElementSnapshot;
  focusTarget: Position | null;
  live2d: Live2DRendererSnapshot | null;
  pointerLookTarget: Position | null;
  position: Position;
  shell: ElementSnapshot;
  tMs: number;
  visualSurface: ElementSnapshot;
  windowShape: ElementSnapshot;
  windowState: {
    height: number;
    screenX: number;
    screenY: number;
    width: number;
  };
};

export type Live2DDragReleaseProbeOptions = {
  avatarShellRef: RefObject<HTMLElement | null>;
  focusTarget: Position | null;
  isDragging: boolean;
  modelType: ModelType;
  modelUrl: string;
  petId: string;
  pointerLookTarget: Position | null;
  position: Position;
  scale: number;
};

export function roundProbeNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

function roundPosition(position: Position | null | undefined): Position | null {
  if (!position) {
    return null;
  }

  return {
    x: roundProbeNumber(position.x),
    y: roundProbeNumber(position.y),
  };
}

function snapshotElement(element: Element | null | undefined): ElementSnapshot {
  if (!(element instanceof HTMLElement) && !(element instanceof HTMLCanvasElement)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    bottom: roundProbeNumber(rect.bottom),
    height: roundProbeNumber(rect.height),
    left: roundProbeNumber(rect.left),
    right: roundProbeNumber(rect.right),
    top: roundProbeNumber(rect.top),
    transform: style.transform === 'none' ? '' : style.transform,
    transition: style.transition,
    width: roundProbeNumber(rect.width),
  };
}

function snapshotLive2DRenderer(element: HTMLElement | null | undefined): Live2DRendererSnapshot | null {
  const snapshot = snapshotElement(element);
  if (!snapshot || !element) {
    return null;
  }

  return {
    ...snapshot,
    appliedSource: element.dataset.live2dAppliedSource,
    currentX: element.dataset.live2dCurrentX,
    currentY: element.dataset.live2dCurrentY,
    lookSettle: element.dataset.live2dLookSettle,
    lookSource: element.dataset.live2dLookSource,
    lookStrength: element.dataset.live2dLookStrength,
    lookX: element.dataset.live2dLookX,
    lookY: element.dataset.live2dLookY,
    parameterInfluence: element.dataset.live2dParameterInfluence,
    postAngleX: element.dataset.live2dPostAngleX,
    postAngleY: element.dataset.live2dPostAngleY,
    postAngleZ: element.dataset.live2dPostAngleZ,
    preAngleX: element.dataset.live2dPreAngleX,
    preAngleY: element.dataset.live2dPreAngleY,
    preAngleZ: element.dataset.live2dPreAngleZ,
    secondaryAngleX: element.dataset.live2dSecondaryAngleX,
    secondaryAngleY: element.dataset.live2dSecondaryAngleY,
    secondaryAngleZ: element.dataset.live2dSecondaryAngleZ,
    secondaryPhysicsSuppression: element.dataset.live2dSecondaryPhysicsSuppression,
    targetX: element.dataset.live2dTargetX,
    targetY: element.dataset.live2dTargetY,
    timedSource: element.dataset.live2dTimedSource,
  };
}

export function collectLive2DDragProbeSample(
  options: Live2DDragReleaseProbeOptions,
  startedAtMs: number,
): Live2DDragProbeSample {
  const shell = options.avatarShellRef.current;
  const visualSurface = shell?.querySelector('[data-desktop-pet-debug-box$=" visual surface"]') ?? null;
  const live2DRenderer = shell?.querySelector<HTMLElement>('[data-desktop-pet-live2d-renderer]') ?? null;
  const canvas = live2DRenderer?.querySelector('canvas') ?? shell?.querySelector('canvas') ?? null;
  const windowShape = shell?.querySelector('[data-desktop-pet-debug-box$=" window shape"]') ?? null;

  return {
    canvas: snapshotElement(canvas),
    focusTarget: roundPosition(options.focusTarget),
    live2d: snapshotLive2DRenderer(live2DRenderer),
    pointerLookTarget: roundPosition(options.pointerLookTarget),
    position: roundPosition(options.position) ?? { x: 0, y: 0 },
    shell: snapshotElement(shell),
    tMs: roundProbeNumber((window.performance?.now?.() ?? Date.now()) - startedAtMs),
    visualSurface: snapshotElement(visualSurface),
    windowShape: snapshotElement(windowShape),
    windowState: {
      height: Math.round(window.innerHeight),
      screenX: Math.round(window.screenX),
      screenY: Math.round(window.screenY),
      width: Math.round(window.innerWidth),
    },
  };
}
