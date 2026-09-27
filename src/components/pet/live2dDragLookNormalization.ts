import type { Live2DParameterSemantic } from '../../pet-runtime/live2d/live2dRuntimeProfile';

type Live2DDragParameterRange = {
  defaultValue: number;
  max: number;
  min: number;
};

type UnifiedDragParameterOptions = {
  axisValue: number;
  binding: Live2DDragParameterRange;
  fallbackScale: number;
  invert: boolean;
  semantic: Live2DParameterSemantic;
};

const LIVE2D_UNIFIED_DRAG_RANGE_GAIN: Partial<Record<Live2DParameterSemantic, number>> = {
  bodyTurnX: 2.2,
  eyeLookX: 2,
  eyeLookY: 1.8,
  headRoll: -0.54,
  lookX: 2,
  lookY: 1.6,
};

const LIVE2D_UNIFIED_MAX_PARAMETER_SPAN = 360;

function hasUsableParameterRange(binding: Live2DDragParameterRange) {
  return Number.isFinite(binding.defaultValue)
    && Number.isFinite(binding.min)
    && Number.isFinite(binding.max)
    && binding.min <= binding.defaultValue
    && binding.defaultValue <= binding.max
    && binding.max > binding.min;
}

export function resolveUnifiedLive2DDragParameterValue(
  options: UnifiedDragParameterOptions,
) {
  const invertFactor = options.invert ? -1 : 1;
  if (
    !hasUsableParameterRange(options.binding)
    || options.binding.max - options.binding.min > LIVE2D_UNIFIED_MAX_PARAMETER_SPAN
  ) {
    return options.binding.defaultValue
      + options.axisValue * options.fallbackScale * invertFactor;
  }

  const gain = LIVE2D_UNIFIED_DRAG_RANGE_GAIN[options.semantic] ?? 1;
  const signedInput = options.axisValue * gain * invertFactor;
  const directionalSpan = signedInput >= 0
    ? options.binding.max - options.binding.defaultValue
    : options.binding.defaultValue - options.binding.min;

  return options.binding.defaultValue + signedInput * directionalSpan;
}
