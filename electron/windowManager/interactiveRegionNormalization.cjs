const MAX_INTERACTIVE_WINDOW_SHAPE_REGIONS = 320;

function sanitizeInteractiveRegion(region) {
  if (!region || typeof region !== 'object') {
    return null;
  }

  const x = Math.max(0, Math.round(Number(region.x ?? 0)));
  const y = Math.max(0, Math.round(Number(region.y ?? 0)));
  const width = Math.max(0, Math.round(Number(region.width ?? 0)));
  const height = Math.max(0, Math.round(Number(region.height ?? 0)));
  if (
    !Number.isFinite(x)
    || !Number.isFinite(y)
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || width <= 0
    || height <= 0
  ) {
    return null;
  }

  return { height, width, x, y };
}

function normalizeInteractiveRegions(regions) {
  return (Array.isArray(regions) ? regions : [])
    .map(sanitizeInteractiveRegion)
    .filter(Boolean)
    .slice(0, MAX_INTERACTIVE_WINDOW_SHAPE_REGIONS);
}

function createInteractiveRegionsSignature(regions) {
  return regions
    .map((region) => `${region.x},${region.y},${region.width},${region.height}`)
    .join('|');
}

function summarizeInteractiveRegion(region) {
  return region
    ? `${region.x},${region.y},${region.width},${region.height}`
    : 'none';
}

function normalizeInteractiveRegionSource(options) {
  return typeof options?.source === 'string' ? options.source : '';
}

module.exports = {
  normalizeInteractiveRegions,
  createInteractiveRegionsSignature,
  summarizeInteractiveRegion,
  normalizeInteractiveRegionSource,
};
