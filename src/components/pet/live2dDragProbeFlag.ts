const LIVE2D_DRAG_PROBE_STORAGE_KEY = 'desktop-pet:live2d-drag-probe';
const LIVE2D_DRAG_PROBE_QUERY_KEY = 'live2dDragProbe';

function readStorageValue(storage: Storage | null | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function isLive2DDragReleaseProbeEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const rawValue = (
    searchParams.get(LIVE2D_DRAG_PROBE_QUERY_KEY)
    ?? readStorageValue(window.localStorage, LIVE2D_DRAG_PROBE_STORAGE_KEY)
    ?? readStorageValue(window.sessionStorage, LIVE2D_DRAG_PROBE_STORAGE_KEY)
    ?? '0'
  ).trim().toLowerCase();

  return ['1', 'true', 'on', 'enabled', 'yes'].includes(rawValue);
}
