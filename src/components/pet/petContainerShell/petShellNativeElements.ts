const NATIVE_INTERACTIVE_REGION_PADDING_PX = 6;
const ACTIVITY_REGION_HANDLE_NATIVE_PADDING_PX = NATIVE_INTERACTIVE_REGION_PADDING_PX / 4;
const NATIVE_WINDOW_SHAPE_REGION_PADDING_PX = 48;
export const NATIVE_WINDOW_SHAPE_SELECTOR = '[data-desktop-pet-interactive="true"], [data-desktop-pet-window-shape="true"]';
const NATIVE_WINDOW_SHAPE_PADDING_ATTRIBUTE = 'data-desktop-pet-window-shape-padding';
export const PET_NATIVE_SCOPE = 'pet';

export function isClientPointInsideElementRect(
  point: { x: number; y: number },
  element: Element,
) {
  const rect = element.getBoundingClientRect();

  return rect.width > 0
    && rect.height > 0
    && point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom;
}

export function isClientPointInsideActivityRegionHandle(point: { x: number; y: number }) {
  return Array.from(document.querySelectorAll('[data-desktop-pet-activity-region-handle="true"]'))
    .some((element) => isClientPointInsideElementRect(point, element));
}

export function resolveNativeElementScope(element: Element) {
  const explicitScope = element.getAttribute('data-desktop-pet-native-scope')
    ?? element.closest('[data-desktop-pet-native-scope]')?.getAttribute('data-desktop-pet-native-scope');
  if (explicitScope) {
    return explicitScope;
  }

  if (element.closest('[data-desktop-pet-id]')) {
    return PET_NATIVE_SCOPE;
  }

  return 'other';
}

export function shouldCollectNativeInteractiveElement(
  element: Element,
  isPetNativeShapeSuspended: boolean,
) {
  void isPetNativeShapeSuspended;
  // BrowserWindow.setShape clips the visible window, not just hit testing.
  // Pet-scoped visible/protection regions must stay in the native shape, while
  // transparent pet hit areas stay out so 3D protection does not block selection.
  const scope = resolveNativeElementScope(element);
  if (!scope) {
    return false;
  }

  if (
    scope === PET_NATIVE_SCOPE
    && element.getAttribute('data-desktop-pet-interactive') === 'true'
    && !element.hasAttribute('data-desktop-pet-window-shape')
  ) {
    return false;
  }

  return true;
}

export function resolveNativeInteractiveRegionFromRect(
  rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
  viewport: { height: number; width: number },
  padding = NATIVE_INTERACTIVE_REGION_PADDING_PX,
) {
  const left = Math.max(0, Math.floor(rect.left - padding));
  const top = Math.max(0, Math.floor(rect.top - padding));
  const right = Math.min(Math.max(0, Math.round(viewport.width)), Math.ceil(rect.right + padding));
  const bottom = Math.min(Math.max(0, Math.round(viewport.height)), Math.ceil(rect.bottom + padding));
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    height,
    width,
    x: left,
    y: top,
  } satisfies DesktopPetInteractiveRegionLike;
}

export function resolveNativeInteractiveRegionPadding(element: Element) {
  const explicitPadding = element.getAttribute(NATIVE_WINDOW_SHAPE_PADDING_ATTRIBUTE);
  if (explicitPadding !== null) {
    const parsedPadding = Number(explicitPadding);
    if (Number.isFinite(parsedPadding)) {
      return Math.max(0, Math.min(128, parsedPadding));
    }
  }

  const isActivityRegionHandle = element.getAttribute('data-desktop-pet-activity-region-handle') === 'true';
  if (isActivityRegionHandle) {
    return ACTIVITY_REGION_HANDLE_NATIVE_PADDING_PX;
  }

  return element.hasAttribute('data-desktop-pet-window-shape')
    && !element.hasAttribute('data-desktop-pet-interactive')
    ? NATIVE_WINDOW_SHAPE_REGION_PADDING_PX
    : NATIVE_INTERACTIVE_REGION_PADDING_PX;
}

export function createNativeInteractiveRegionsSignature(regions: DesktopPetInteractiveRegionLike[]) {
  return regions
    .map((region) => `${region.x},${region.y},${region.width},${region.height}`)
    .join('|');
}

export function summarizeNativeInteractiveRegionMutationSource(source: unknown) {
  if (Array.isArray(source)) {
    const records = source.filter((record): record is MutationRecord => record instanceof MutationRecord);
    return {
      attributes: records.slice(0, 8).map((record) => record.attributeName ?? record.type),
      count: records.length,
      target: summarizePointerElement(records[0]?.target instanceof Element ? records[0].target : null),
      type: 'mutation',
    };
  }

  if (source instanceof Event) {
    return {
      type: source.type,
    };
  }

  return {
    type: typeof source === 'string' ? source : 'unknown',
  };
}

export function getNativeElementScopePriority(scope: string | null) {
  if (scope === PET_NATIVE_SCOPE) {
    return 0;
  }

  if (scope === 'activity-region') {
    return 1;
  }

  return 2;
}

export function summarizePointerElement(element: Element | null) {
  if (!element) {
    return null;
  }

  const className = element.getAttribute('class') ?? '';
  const interactiveElement = element.closest('[data-desktop-pet-interactive="true"]');
  const petElement = element.closest('[data-desktop-pet-id]');

  return {
    className: className ? className.slice(0, 120) : null,
    id: element.id || null,
    interactive: Boolean(interactiveElement),
    interactiveTag: interactiveElement?.tagName.toLowerCase() ?? null,
    petId: petElement?.getAttribute('data-desktop-pet-id') ?? null,
    scope: resolveNativeElementScope(element),
    tag: element.tagName.toLowerCase(),
  };
}
