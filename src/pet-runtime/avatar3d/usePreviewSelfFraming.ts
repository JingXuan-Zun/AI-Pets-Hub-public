import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { createAvatar3DCanvasVisualBoundsSampler, measureAvatar3DCanvasVisualBounds } from './avatar3dCanvasVisualBounds';
import { type PetVisualBounds } from '../../components/pet/petVisualBounds';

// The settings preview frames a model from its measured box, which is taken in the model's
// rest pose. Some models are far from that box once posed: 康熙's dress train trails ~8
// units behind her, so the box centre sits behind the body, the body is nearer the camera
// than the aim point, and perspective pushed her feet out of the bottom of the card. The
// preview now looks at what it actually drew and corrects itself: it shifts the camera so the
// silhouette is centred and backs off until it fits with a margin (a few rounds at most),
// with the model hidden until it has settled.

export type PreviewFraming = { distanceScale: number; shiftY: number };

const NEUTRAL: PreviewFraming = { distanceScale: 1, shiftY: 0 };
// The camera snaps to each correction, so a few frames are enough before looking again.
const LOOK_MS = 120;
const MAX_ROUNDS = 4;
const FILL = 0.84;
const CENTER_TOLERANCE = 0.04;
// The model may not be drawn yet when the first look is due; keep looking for a while.
const MAX_EMPTY_LOOKS = 40;

// The preview canvas is larger than its card (hems may swing out of view while animating),
// so "fits" and "centred" are judged against the part of the canvas the card shows.
function visibleHeightOf(canvas: HTMLCanvasElement) {
  const canvasHeight = canvas.getBoundingClientRect().height;
  for (let node = canvas.parentElement; node; node = node.parentElement) {
    const height = node.getBoundingClientRect().height;
    if (height > 0 && height < canvasHeight - 1 && getComputedStyle(node).overflow !== 'visible') return height;
  }
  return canvasHeight;
}

function measure(canvas: HTMLCanvasElement, sampler: ReturnType<typeof createAvatar3DCanvasVisualBoundsSampler>) {
  return measureAvatar3DCanvasVisualBounds(canvas, sampler);
}

/** The correction for one measurement, or null when the silhouette already sits well. */
export function resolvePreviewFramingStep(
  bounds: PetVisualBounds,
  viewportHeight: number,
  cameraDistance: number,
  verticalFovDegrees: number,
  visibleHeight: number = viewportHeight,
): PreviewFraming | null {
  const half = visibleHeight / 2;
  const clipped = bounds.top >= half - 1 || bounds.bottom >= half - 1;
  const height = bounds.top + bounds.bottom;
  const offsetPx = (bounds.bottom - bounds.top) / 2;
  const tooTall = height > visibleHeight * FILL;
  const offCenter = Math.abs(offsetPx) > visibleHeight * CENTER_TOLERANCE;
  if (!clipped && !tooTall && !offCenter) return null;
  // The projection spans the whole canvas, so pixels turn into world units by its height.
  const worldPerPx = (2 * cameraDistance * Math.tan(THREE.MathUtils.degToRad(verticalFovDegrees) / 2)) / viewportHeight;
  return {
    // A silhouette cut by the card is larger than measured; back off a step and look again.
    distanceScale: Math.max(tooTall ? height / (visibleHeight * FILL) : 1, clipped ? 1.2 : 1),
    // Drawn low (positive offset) means the camera has to come down.
    shiftY: -offsetPx * worldPerPx,
  };
}

export function usePreviewSelfFraming(options: {
  baseDistance: number;
  canvas: HTMLCanvasElement;
  enabled: boolean;
  label: string;
  modelKey: unknown;
  verticalFovDegrees: number;
  viewportHeight: number;
}): PreviewFraming & { settled: boolean } {
  const { baseDistance, canvas, enabled, label, modelKey, verticalFovDegrees, viewportHeight } = options;
  const [framing, setFraming] = useState<PreviewFraming & { settled: boolean }>({ ...NEUTRAL, settled: !enabled });
  // Read when measuring, not effect inputs: the distance follows the idle breathing scale and
  // changes nearly every frame, which kept restarting the look before it ever happened.
  const baseDistanceRef = useRef(baseDistance);
  baseDistanceRef.current = baseDistance;
  const fovRef = useRef(verticalFovDegrees);
  fovRef.current = verticalFovDegrees;

  useEffect(() => {
    if (!enabled || viewportHeight <= 0) {
      setFraming({ ...NEUTRAL, settled: true });
      return undefined;
    }
    // Hidden until settled: the camera jumps straight to each correction, and showing those
    // jumps read as the model zooming in and out right after a switch.
    setFraming({ ...NEUTRAL, settled: false });
    const sampler = createAvatar3DCanvasVisualBoundsSampler();
    let current = NEUTRAL;
    let round = 0;
    let emptyLooks = 0;
    let timer: number | null = null;
    let cancelled = false;
    const settle = () => setFraming({ ...current, settled: true });
    const step = () => {
      if (cancelled) return;
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        const bounds = measure(canvas, sampler);
        if (!bounds) {
          emptyLooks += 1;
          if (emptyLooks < MAX_EMPTY_LOOKS) timer = window.setTimeout(step, LOOK_MS);
          else settle();
          return;
        }
        const correction = round < MAX_ROUNDS
          ? resolvePreviewFramingStep(
            bounds,
            viewportHeight,
            baseDistanceRef.current * current.distanceScale,
            fovRef.current,
            visibleHeightOf(canvas),
          )
          : null;
        if (!correction) {
          settle();
          return;
        }
        current = {
          distanceScale: current.distanceScale * correction.distanceScale,
          shiftY: current.shiftY + correction.shiftY,
        };
        round += 1;
        pushFrontendRuntimeLog('model', `3d preview self-framing pet=${label} round=${round} distanceScale=${current.distanceScale.toFixed(3)} shiftY=${current.shiftY.toFixed(3)}`);
        setFraming({ ...current, settled: false });
        timer = window.setTimeout(step, LOOK_MS);
      });
    };
    timer = window.setTimeout(step, LOOK_MS);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [canvas, enabled, label, modelKey, viewportHeight]);

  return framing;
}
