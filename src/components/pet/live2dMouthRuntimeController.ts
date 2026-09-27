import { pushFrontendRuntimeError } from '../../frontendRuntimeLogger';
import {
  resolveDeterministicTextMouthIntensity,
  sampleReplyMouthSignal,
} from '../../pet-runtime/performance/replyMouthSignalRuntime';
import { type ResolvedLive2DRuntimeProfile } from '../../pet-runtime/live2d/live2dRuntimeProfile';

type Live2DMouthCoreModelLike = {
  getParameterDefaultValue?: (parameterIndex: number) => number;
  getParameterIndex?: (parameterId: string) => number;
  getParameterMaximumValue?: (parameterIndex: number) => number;
  getParameterMinimumValue?: (parameterIndex: number) => number;
  setParameterValueById?: (parameterId: string, value: number, weight?: number) => void;
  setParameterValueByIndex?: (parameterIndex: number, value: number, weight?: number) => void;
};

type Live2DMouthInternalModelLike = {
  coreModel?: Live2DMouthCoreModelLike;
  off?: (eventName: string, listener: (timestampMs?: number) => void) => void;
  on?: (eventName: string, listener: (timestampMs?: number) => void) => void;
  removeListener?: (eventName: string, listener: (timestampMs?: number) => void) => void;
};

type Live2DMouthRuntimeModel = {
  internalModel?: Live2DMouthInternalModelLike;
};

export type Live2DMouthRuntimeState = {
  isSpeaking: boolean;
  isTyping: boolean;
  latestMessage: string;
  visible: boolean;
};

type Live2DMouthBinding = {
  defaultValue: number;
  id: string;
  index: number;
  invert: boolean;
  max: number;
  min: number;
  sensitivity: number;
};

const DEFAULT_MOUTH_STATE: Live2DMouthRuntimeState = {
  isSpeaking: false,
  isTyping: false,
  latestMessage: '',
  visible: true,
};

function resolveNowMs() {
  return window.performance?.now?.() ?? Date.now();
}

function resolveMouthBinding(
  coreModel: Live2DMouthCoreModelLike,
  runtimeProfile: ResolvedLive2DRuntimeProfile,
): Live2DMouthBinding | null {
  const id = runtimeProfile.parameters.mouthOpen.id;
  if (!runtimeProfile.parameters.mouthOpen.enabled || !id) {
    return null;
  }
  const index = coreModel.getParameterIndex?.(id) ?? -1;
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }
  const defaultValue = coreModel.getParameterDefaultValue?.(index) ?? 0;
  const max = coreModel.getParameterMaximumValue?.(index) ?? Math.max(1, defaultValue);
  const min = coreModel.getParameterMinimumValue?.(index) ?? Math.min(0, defaultValue);
  return {
    defaultValue,
    id,
    index,
    invert: runtimeProfile.parameters.mouthOpen.invert,
    max,
    min,
    sensitivity: runtimeProfile.parameters.mouthOpen.sensitivity,
  };
}

function writeMouthValue(
  coreModel: Live2DMouthCoreModelLike,
  binding: Live2DMouthBinding,
  intensity: number,
) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity * binding.sensitivity));
  const limit = binding.invert ? binding.min : binding.max;
  const value = binding.defaultValue + (limit - binding.defaultValue) * clampedIntensity;
  if (coreModel.setParameterValueByIndex) {
    coreModel.setParameterValueByIndex(binding.index, value, 1);
    return;
  }
  coreModel.setParameterValueById?.(binding.id, value, 1);
}

function advanceSmoothedIntensity(options: {
  current: number;
  deltaSeconds: number;
  target: number;
}) {
  const delta = options.target - options.current;
  const speed = delta >= 0 ? 12 : 8;
  const maxStep = Math.max(0, Math.min(0.08, options.deltaSeconds)) * speed;
  if (Math.abs(delta) <= maxStep) {
    return options.target;
  }
  return options.current + Math.sign(delta) * maxStep;
}

export type Live2DMouthRuntimeController = {
  applyImmediate: (timestampMs?: number) => void;
  destroy: () => void;
  parameterId: string;
  setState: (nextState: Partial<Live2DMouthRuntimeState>) => void;
};

type Live2DMouthRuntimeContext = {
  modelUrl: string;
  petId: string;
  runtimeProfile: ResolvedLive2DRuntimeProfile;
};

class Live2DMouthFrameDriver implements Live2DMouthRuntimeController {
  parameterId: string;
  private currentIntensity = 0;
  private destroyed = false;
  private fallbackAnimationFrameId: number | null = null;
  private lastAppliedAtMs = resolveNowMs();
  private lastModelUpdateAtMs = this.lastAppliedAtMs;
  private localTextActivityAtMs = this.lastAppliedAtMs;
  private localTextAvailable = false;
  private state = { ...DEFAULT_MOUTH_STATE };

  constructor(
    private coreModel: Live2DMouthCoreModelLike,
    private internalModel: Live2DMouthInternalModelLike,
    private binding: Live2DMouthBinding,
    private context: Live2DMouthRuntimeContext,
  ) {
    this.parameterId = binding.id;
  }

  applyImmediate = (timestampMs?: number) => {
    if (this.destroyed) {
      return;
    }
    try {
      const nowMs = Number.isFinite(timestampMs) ? timestampMs as number : resolveNowMs();
      const deltaSeconds = Math.max(0, (nowMs - this.lastAppliedAtMs) / 1000);
      this.lastAppliedAtMs = nowMs;
      const target = this.resolveTargetIntensity(nowMs);
      this.currentIntensity = advanceSmoothedIntensity({
        current: this.currentIntensity,
        deltaSeconds,
        target,
      });
      writeMouthValue(this.coreModel, this.binding, this.currentIntensity);
    } catch (error) {
      this.disableAfterError('disabled', error);
    }
  };

  setState = (nextState: Partial<Live2DMouthRuntimeState>) => {
    if (this.destroyed) {
      return;
    }
    const nextLatestMessage = nextState.latestMessage ?? this.state.latestMessage;
    const nextIsActive = (nextState.isSpeaking ?? this.state.isSpeaking)
      || (nextState.isTyping ?? this.state.isTyping);
    if (nextIsActive && nextLatestMessage !== this.state.latestMessage) {
      this.localTextAvailable = Boolean(nextLatestMessage.trim());
      this.localTextActivityAtMs = resolveNowMs();
    } else if (!nextIsActive) {
      this.localTextAvailable = false;
    }
    this.state = { ...this.state, ...nextState };
  };

  start() {
    try {
      this.internalModel.on?.('beforeModelUpdate', this.applyFromModelUpdate);
      if (typeof window.requestAnimationFrame === 'function') {
        this.fallbackAnimationFrameId = window.requestAnimationFrame(this.runFallbackFrame);
      }
      return true;
    } catch (error) {
      this.disableAfterError('setup skipped', error);
      return false;
    }
  }

  destroy = () => {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.stopFrameUpdates();
    writeMouthValue(this.coreModel, this.binding, 0);
  };

  private resolveTargetIntensity(nowMs: number) {
    const signal = sampleReplyMouthSignal(this.context.petId, nowMs);
    const shouldPresent = this.state.visible
      && (this.state.isTyping || this.state.isSpeaking || signal.mode !== 'inactive');
    if (!shouldPresent) {
      return 0;
    }
    if (signal.mode !== 'inactive' || !this.localTextAvailable) {
      return signal.intensity;
    }
    return resolveDeterministicTextMouthIntensity(
      this.state.latestMessage,
      Math.max(0, nowMs - this.localTextActivityAtMs),
    );
  }

  private applyFromModelUpdate = () => {
    this.lastModelUpdateAtMs = resolveNowMs();
    this.applyImmediate(this.lastModelUpdateAtMs);
  };

  private runFallbackFrame = (timestampMs: number) => {
    if (this.destroyed) {
      return;
    }
    if (timestampMs - this.lastModelUpdateAtMs > 50) {
      this.applyImmediate(timestampMs);
    }
    this.fallbackAnimationFrameId = window.requestAnimationFrame(this.runFallbackFrame);
  };

  private stopFrameUpdates() {
    this.internalModel.off?.('beforeModelUpdate', this.applyFromModelUpdate);
    this.internalModel.removeListener?.('beforeModelUpdate', this.applyFromModelUpdate);
    if (this.fallbackAnimationFrameId !== null) {
      window.cancelAnimationFrame(this.fallbackAnimationFrameId);
      this.fallbackAnimationFrameId = null;
    }
  }

  private disableAfterError(phase: string, error: unknown) {
    this.destroyed = true;
    this.stopFrameUpdates();
    pushFrontendRuntimeError('model', `live2d mouth ${phase} pet=${this.context.petId}`, error, {
      modelUrl: this.context.modelUrl,
      parameterId: this.binding.id,
    });
  }
}

export function createLive2DMouthRuntimeController(
  model: Live2DMouthRuntimeModel,
  context: Live2DMouthRuntimeContext,
): Live2DMouthRuntimeController | null {
  const internalModel = model.internalModel;
  const coreModel = internalModel?.coreModel;
  if (!internalModel || !coreModel) {
    return null;
  }
  const binding = resolveMouthBinding(coreModel, context.runtimeProfile);
  if (!binding) {
    return null;
  }
  const driver = new Live2DMouthFrameDriver(coreModel, internalModel, binding, context);
  return driver.start() ? driver : null;
}
