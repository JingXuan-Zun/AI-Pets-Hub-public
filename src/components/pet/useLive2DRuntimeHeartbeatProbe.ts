import { useEffect, type MutableRefObject } from 'react';
import { Application, Ticker } from 'pixi.js';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { isLive2DDragReleaseProbeEnabled } from './live2dDragProbeFlag';
import { type Live2DModelLike } from './live2dModelRuntime';

type ModelUpdateEmitter = {
  off?: (eventName: string, listener: () => void) => void;
  on?: (eventName: string, listener: () => void) => void;
  removeListener?: (eventName: string, listener: () => void) => void;
};

type HeartbeatCounters = {
  appTickerFrames: number;
  modelUpdateFrames: number;
};

const LIVE2D_HEARTBEAT_INTERVAL_MS = 1000;
const LIVE2D_HEARTBEAT_LOG_INTERVAL_SAMPLES = 5;

function detachModelUpdateListener(emitter: ModelUpdateEmitter, listener: () => void) {
  emitter.off?.('beforeModelUpdate', listener);
  emitter.removeListener?.('beforeModelUpdate', listener);
}

function buildHeartbeatDetails(
  app: Application,
  model: Live2DModelLike,
  counters: HeartbeatCounters,
  previous: HeartbeatCounters,
) {
  return {
    appTickerDelta: counters.appTickerFrames - previous.appTickerFrames,
    appTickerStarted: app.ticker.started,
    appTickerTotal: counters.appTickerFrames,
    modelAutoUpdate: model.autoUpdate,
    modelElapsedTime: Number(model.elapsedTime) || 0,
    modelHasParent: Boolean(model.parent),
    modelUpdateDelta: counters.modelUpdateFrames - previous.modelUpdateFrames,
    modelUpdateTotal: counters.modelUpdateFrames,
    sharedTickerStarted: Ticker.shared.started,
  };
}

export function useLive2DRuntimeHeartbeatProbe(options: {
  appRef: MutableRefObject<Application | null>;
  modelRef: MutableRefObject<Live2DModelLike | null>;
  petId: string;
  runtimeReadyVersion: number;
}) {
  useEffect(() => {
    if (!isLive2DDragReleaseProbeEnabled() || options.runtimeReadyVersion <= 0) {
      return undefined;
    }

    const app = options.appRef.current;
    const model = options.modelRef.current;
    const emitter = model?.internalModel as ModelUpdateEmitter | undefined;
    if (!app || !model || !emitter?.on) {
      return undefined;
    }

    const counters = { appTickerFrames: 0, modelUpdateFrames: 0 };
    const previous = { appTickerFrames: 0, modelUpdateFrames: 0 };
    let sampleCount = 0;
    let wasUpdating: boolean | null = null;
    const onAppTicker = () => { counters.appTickerFrames += 1; };
    const onModelUpdate = () => { counters.modelUpdateFrames += 1; };
    app.ticker.add(onAppTicker);
    emitter.on('beforeModelUpdate', onModelUpdate);

    const intervalId = window.setInterval(() => {
      sampleCount += 1;
      const details = buildHeartbeatDetails(app, model, counters, previous);
      const isUpdating = details.appTickerDelta > 0 && details.modelUpdateDelta > 0;
      const didUpdateStateChange = wasUpdating !== null && wasUpdating !== isUpdating;
      if (
        sampleCount === 1
        || sampleCount % LIVE2D_HEARTBEAT_LOG_INTERVAL_SAMPLES === 0
        || didUpdateStateChange
      ) {
        pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d runtime heartbeat', {
          ...details,
          petId: options.petId,
          sampleCount,
          updateState: isUpdating ? 'updating' : 'stalled',
        });
      }
      wasUpdating = isUpdating;
      previous.appTickerFrames = counters.appTickerFrames;
      previous.modelUpdateFrames = counters.modelUpdateFrames;
    }, LIVE2D_HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      app.ticker.remove(onAppTicker);
      detachModelUpdateListener(emitter, onModelUpdate);
    };
  }, [options.appRef, options.modelRef, options.petId, options.runtimeReadyVersion]);
}
