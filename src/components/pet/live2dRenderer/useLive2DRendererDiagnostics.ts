import { useCallback, useMemo, type MutableRefObject } from 'react';
import { type Application } from 'pixi.js';
import { pushFrontendRuntimeError } from '../../../frontendRuntimeLogger';
import { type PetVisualBounds } from '../petVisualBounds';
import { isLive2DDragReleaseProbeEnabled } from '../live2dDragProbeFlag';
import { type Live2DPointerLookFrameDiagnostic } from '../live2dPointerLookRuntimeController';
import { resolveLive2DDrawableVisualBounds } from './live2dRendererVisualBounds';
import { type Live2DRendererRefs } from './live2dRendererRefs';

function writeLive2DDiagnosticFrame(diagnosticContainer: HTMLDivElement, frame: Live2DPointerLookFrameDiagnostic) {
  const writeNumber = (key: string, value: number | null) => {
    diagnosticContainer.dataset[key] = value === null ? '' : value.toFixed(4);
  };
  diagnosticContainer.dataset.live2dAppliedSource = frame.appliedSource;
  diagnosticContainer.dataset.live2dTimedSource = frame.timedSource;
  writeNumber('live2dCurrentX', frame.currentX);
  writeNumber('live2dCurrentY', frame.currentY);
  writeNumber('live2dParameterInfluence', frame.parameterInfluence);
  writeNumber('live2dTargetX', frame.targetX);
  writeNumber('live2dTargetY', frame.targetY);
  writeNumber('live2dPreAngleX', frame.preAngleX);
  writeNumber('live2dPreAngleY', frame.preAngleY);
  writeNumber('live2dPreAngleZ', frame.preAngleZ);
  writeNumber('live2dPostAngleX', frame.postAngleX);
  writeNumber('live2dPostAngleY', frame.postAngleY);
  writeNumber('live2dPostAngleZ', frame.postAngleZ);
  writeNumber('live2dSecondaryAngleX', frame.secondaryAngleX);
  writeNumber('live2dSecondaryAngleY', frame.secondaryAngleY);
  writeNumber('live2dSecondaryAngleZ', frame.secondaryAngleZ);
  writeNumber('live2dSecondaryPhysicsSuppression', frame.secondaryPhysicsSuppression);
}

export function useLive2DDragProbeDiagnosticFrame(containerRef: MutableRefObject<HTMLDivElement | null>) {
  return useMemo(() => (
    isLive2DDragReleaseProbeEnabled()
      ? (frame: Live2DPointerLookFrameDiagnostic) => {
          const diagnosticContainer = containerRef.current;
          if (!diagnosticContainer) {
            return;
          }

          writeLive2DDiagnosticFrame(diagnosticContainer, frame);
        }
      : undefined
  ), []);
}

type RenderedBoundsRefs = Pick<
  Live2DRendererRefs,
  'modelLayerRef' | 'modelRef' | 'renderedVisualBoundsSignatureRef' | 'runtimeContextRef' | 'sharedRendererHandleRef'
>;

export function useLive2DRenderedVisualBoundsEmitter(
  refs: RenderedBoundsRefs,
  onVisualBoundsChangeRef: MutableRefObject<((bounds: PetVisualBounds) => void) | undefined>,
) {
  return useCallback((app: Application, measuredStageSize: number) => {
    try {
      const modelLayer = refs.modelLayerRef.current;
      if (!modelLayer) {
        return false;
      }
      refs.sharedRendererHandleRef.current?.syncLayout();
      const model = refs.modelRef.current;
      if (!model) {
        return false;
      }
      // The root stage has no parent transform; calling stage.updateTransform()
      // directly throws after a model replacement. Let Pixi's renderer perform
      // the root transform pass before sampling the current model bounds.
      app.render();
      const bounds = resolveLive2DDrawableVisualBounds(model, modelLayer, measuredStageSize);
      if (!bounds) {
        return false;
      }

      const runtimeContext = refs.runtimeContextRef.current;
      refs.renderedVisualBoundsSignatureRef.current = `${runtimeContext.modelUrl}|${measuredStageSize}`;
      runtimeContext.onRuntimeEvent?.({
        bounds,
        petId: runtimeContext.runtimePetId,
        runtimeKind: 'live2d',
        source: 'measured',
        type: 'visual-bounds',
      });
      onVisualBoundsChangeRef.current?.(bounds);
      return true;
    } catch (error) {
      pushFrontendRuntimeError('model', 'live2d rendered bounds measurement failed', error, {
        modelUrl: refs.runtimeContextRef.current.modelUrl,
        petId: refs.runtimeContextRef.current.runtimePetId,
        stageSize: measuredStageSize,
      });
      return false;
    }
  }, []);
}
