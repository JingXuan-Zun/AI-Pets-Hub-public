export const DEFAULT_PET_HOVER_REGIONS = ['head', 'body', 'handL', 'handR'] as const;

export type PetHoverRegion = typeof DEFAULT_PET_HOVER_REGIONS[number];

export type PetHoverState = {
  activeRegion: PetHoverRegion | null;
  focusTarget: {
    x: number;
    y: number;
  } | null;
  supportedRegions: PetHoverRegion[];
};

type NormalizedPoint = {
  x: number;
  y: number;
};

const PET_HOVER_REGION_SET = new Set<string>(DEFAULT_PET_HOVER_REGIONS);
const REGION_BOUNDS: Record<PetHoverRegion, { minX: number; maxX: number; minY: number; maxY: number }> = {
  body: { minX: 0.22, maxX: 0.78, minY: 0.3, maxY: 1 },
  handL: { minX: 0, maxX: 0.34, minY: 0.24, maxY: 0.82 },
  handR: { minX: 0.66, maxX: 1, minY: 0.24, maxY: 0.82 },
  head: { minX: 0.2, maxX: 0.8, minY: 0, maxY: 0.34 },
};
const REGION_PRIORITY: PetHoverRegion[] = ['head', 'handL', 'handR', 'body'];

export function normalizePetHoverRegions(regions?: readonly string[] | null) {
  if (!regions?.length) {
    return [...DEFAULT_PET_HOVER_REGIONS];
  }

  const normalizedRegions = Array.from(new Set(
    regions
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => PET_HOVER_REGION_SET.has(value)),
  )) as PetHoverRegion[];

  return normalizedRegions.length > 0
    ? normalizedRegions
    : [...DEFAULT_PET_HOVER_REGIONS];
}

function isPointInRegion(point: NormalizedPoint, region: PetHoverRegion) {
  const bounds = REGION_BOUNDS[region];
  return point.x >= bounds.minX
    && point.x <= bounds.maxX
    && point.y >= bounds.minY
    && point.y <= bounds.maxY;
}

function resolveFallbackHoverRegion(
  point: NormalizedPoint,
  supportedRegions: PetHoverRegion[],
) {
  if (point.y <= 0.38 && supportedRegions.includes('head')) {
    return 'head';
  }

  if (point.x < 0.5 && supportedRegions.includes('handL')) {
    return 'handL';
  }

  if (point.x >= 0.5 && supportedRegions.includes('handR')) {
    return 'handR';
  }

  if (supportedRegions.includes('body')) {
    return 'body';
  }

  return supportedRegions[0] ?? null;
}

export function resolvePetHoverRegion(
  point: NormalizedPoint,
  regions?: readonly string[] | null,
) {
  const supportedRegions = normalizePetHoverRegions(regions);
  const directHitRegion = REGION_PRIORITY.find((region) => (
    supportedRegions.includes(region) && isPointInRegion(point, region)
  ));

  return directHitRegion ?? resolveFallbackHoverRegion(point, supportedRegions);
}

export function resolvePetHoverFocusTarget(point: NormalizedPoint) {
  return {
    x: Math.round((point.x - 0.5) * 56),
    y: Math.round((point.y - 0.5) * 84),
  };
}

export function createEmptyPetHoverState(regions?: readonly string[] | null): PetHoverState {
  return {
    activeRegion: null,
    focusTarget: null,
    supportedRegions: normalizePetHoverRegions(regions),
  };
}

export function resolvePetHoverState(
  point: NormalizedPoint | null,
  regions?: readonly string[] | null,
): PetHoverState {
  const supportedRegions = normalizePetHoverRegions(regions);

  if (!point) {
    return {
      activeRegion: null,
      focusTarget: null,
      supportedRegions,
    };
  }

  return {
    activeRegion: resolvePetHoverRegion(point, supportedRegions),
    focusTarget: resolvePetHoverFocusTarget(point),
    supportedRegions,
  };
}
