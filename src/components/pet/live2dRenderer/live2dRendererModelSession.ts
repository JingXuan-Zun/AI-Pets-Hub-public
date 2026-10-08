import { type Live2DModelLike } from '../live2dModelRuntime';
import { type Live2DRendererRefs } from './live2dRendererRefs';

export type ModelLoadSession = {
  cancelled: boolean;
  delayedPresentationProbeTimeoutId: number | null;
  loadedModel: Live2DModelLike | null;
  presentationProbeTimeoutId: number | null;
};

export function releaseLive2DRendererModel(refs: Live2DRendererRefs, session: ModelLoadSession) {
  session.cancelled = true;
  if (session.presentationProbeTimeoutId !== null) {
    window.clearTimeout(session.presentationProbeTimeoutId);
    session.presentationProbeTimeoutId = null;
  }
  if (session.delayedPresentationProbeTimeoutId !== null) {
    window.clearTimeout(session.delayedPresentationProbeTimeoutId);
    session.delayedPresentationProbeTimeoutId = null;
  }
  refs.resetMotionExpressionSignaturesRef.current();
  refs.modelTickerHandleRef.current?.release();
  refs.modelTickerHandleRef.current = null;
  refs.createExpressionManagerRef.current = null;
  refs.mouthRuntimeControllerRef.current?.destroy();
  refs.mouthRuntimeControllerRef.current = null;
  refs.performanceRuntimeControllerRef.current?.destroy();
  refs.performanceRuntimeControllerRef.current = null;
  refs.pointerLookRuntimeControllerRef.current?.destroy();
  refs.pointerLookRuntimeControllerRef.current = null;
  const model = session.loadedModel;
  session.loadedModel = null;
  if (model) {
    if (model.parent) {
      model.parent.removeChild(model);
    }
    model.destroy({ baseTexture: false, children: true, texture: false });
  }
  if (refs.modelRef.current === model) {
    refs.modelRef.current = null;
    refs.declaredParameterIdsRef.current = null;
  }
}
