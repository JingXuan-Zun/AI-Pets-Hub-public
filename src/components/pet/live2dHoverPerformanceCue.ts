export type Live2DHoverPerformanceCue = {
  bodyAngleYBias: number;
  bodyAngleZBias: number;
  breathBonus: number;
  mouthBonus: number;
};

function resolveStableUnitValue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return (hash % 2001) / 1000 - 1;
}

function resolveCueVariant(region: string, variantSeed: number, axis: 'y' | 'z') {
  return resolveStableUnitValue(`${region}:${Math.trunc(variantSeed)}:${axis}`);
}

export function resolveLive2DHoverPerformanceCue(
  hoverRegion: string | null,
  variantSeed = 0,
): Live2DHoverPerformanceCue {
  const region = hoverRegion ?? '';
  const yVariant = resolveCueVariant(region, variantSeed, 'y');
  const zVariant = resolveCueVariant(region, variantSeed, 'z');

  switch (hoverRegion) {
    case 'head':
      return {
        bodyAngleYBias: yVariant * 0.14,
        bodyAngleZBias: -0.18 + zVariant * 0.07,
        breathBonus: 0.02,
        mouthBonus: 0.022,
      };
    case 'body':
      return {
        bodyAngleYBias: yVariant * 0.12,
        bodyAngleZBias: 0.16 + zVariant * 0.07,
        breathBonus: 0.09,
        mouthBonus: 0.006,
      };
    case 'handL':
      return {
        bodyAngleYBias: -0.76 + yVariant * 0.12,
        bodyAngleZBias: -0.3 + zVariant * 0.08,
        breathBonus: 0.03,
        mouthBonus: 0.012,
      };
    case 'handR':
      return {
        bodyAngleYBias: 0.76 + yVariant * 0.12,
        bodyAngleZBias: 0.3 + zVariant * 0.08,
        breathBonus: 0.03,
        mouthBonus: 0.012,
      };
    default:
      return {
        bodyAngleYBias: 0,
        bodyAngleZBias: 0,
        breathBonus: 0,
        mouthBonus: 0,
      };
  }
}
