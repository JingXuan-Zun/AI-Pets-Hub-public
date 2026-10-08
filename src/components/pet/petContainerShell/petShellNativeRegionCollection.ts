import {
  NATIVE_WINDOW_SHAPE_SELECTOR,
  PET_NATIVE_SCOPE,
  getNativeElementScopePriority,
  resolveNativeElementScope,
  resolveNativeInteractiveRegionFromRect,
  resolveNativeInteractiveRegionPadding,
  shouldCollectNativeInteractiveElement,
  summarizePointerElement,
} from './petShellNativeElements';
import { type PetShellInteractionQueries } from './petShellInteractionQueries';
import { type PetShellPointerContext } from './petShellPointerSessionTypes';

type CollectionFlags = {
  inputProxyOnly: boolean;
  isPetNativeShapeSuspended: boolean;
  localPetOnly: boolean;
  viewport: { height: number; width: number };
};

export function createPetShellNativeRegionCollector(ctx: PetShellPointerContext, queries: PetShellInteractionQueries) {
  const { hasFullWindowNativeShape, hasSuspendedNativePetShape } = queries;
  return function collectNativeInteractiveRegionEntries(options?: {
    inputProxyOnly?: boolean;
    localPetOnly?: boolean;
  }) {
    if (!ctx.useNativeInteractiveRegions) {
      return [];
    }

    const localPetOnly = Boolean(options?.localPetOnly);
    const inputProxyOnly = Boolean(options?.inputProxyOnly);
    if (hasFullWindowNativeShape() && !localPetOnly && !inputProxyOnly) {
      return [{
        element: null,
        elementAtElementCenter: null,
        elementCenter: null,
        reason: 'full-window',
        rect: null,
        region: createFullWindowRegion(),
        scope: 'full-window',
      }];
    }

    const isPetNativeShapeSuspended = hasSuspendedNativePetShape();

    const viewport = {
      height: window.innerHeight,
      width: window.innerWidth,
    };
    const flags = { inputProxyOnly, isPetNativeShapeSuspended, localPetOnly, viewport };
    const entries = Array.from(document.querySelectorAll(NATIVE_WINDOW_SHAPE_SELECTOR))
      .sort((firstElement, secondElement) => (
        getNativeElementScopePriority(resolveNativeElementScope(firstElement))
        - getNativeElementScopePriority(resolveNativeElementScope(secondElement))
      ))
      .map((element) => resolveNativeRegionEntryForElement(element, flags))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return localPetOnly
      ? entries.filter((entry) => entry.scope === PET_NATIVE_SCOPE)
      : entries;
  };
}

function createFullWindowRegion() {
  return {
    height: Math.max(1, Math.round(window.innerHeight)),
    width: Math.max(1, Math.round(window.innerWidth)),
    x: 0,
    y: 0,
  } satisfies DesktopPetInteractiveRegionLike;
}

function isExcludedFromScopedCollection(element: Element, flags: CollectionFlags) {
  const { inputProxyOnly, isPetNativeShapeSuspended, localPetOnly } = flags;
  if (
    (localPetOnly || inputProxyOnly)
    && element.getAttribute('data-desktop-pet-interactive') !== 'true'
  ) {
    return true;
  }

  if (
    (localPetOnly || inputProxyOnly)
    && (
      localPetOnly
      && resolveNativeElementScope(element) !== PET_NATIVE_SCOPE
    )
  ) {
    return true;
  }

  return !localPetOnly
    && !inputProxyOnly
    && !shouldCollectNativeInteractiveElement(element, isPetNativeShapeSuspended);
}

function resolveNativeRegionEntryForElement(element: Element, flags: CollectionFlags) {
  if (element.getAttribute('data-desktop-pet-window-shape') === 'full-window') {
    if (flags.localPetOnly || flags.inputProxyOnly) {
      return null;
    }
    return {
      element: summarizePointerElement(element),
      elementAtElementCenter: null,
      elementCenter: null,
      reason: 'full-window-shape',
      rect: null,
      region: createFullWindowRegion(),
      scope: 'full-window',
    };
  }

  if (isExcludedFromScopedCollection(element, flags)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const padding = resolveNativeInteractiveRegionPadding(element);
  const region = resolveNativeInteractiveRegionFromRect(
    rect,
    flags.viewport,
    padding,
  );
  if (!region) {
    return null;
  }

  const elementCenter = {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
  const scope = resolveNativeElementScope(element);

  return {
    element: summarizePointerElement(element),
    elementAtElementCenter: summarizePointerElement(
      document.elementFromPoint(elementCenter.x, elementCenter.y),
    ),
    elementCenter,
    reason: null,
    rect: {
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
    },
    region,
    scope,
  };
}

export type CollectNativeInteractiveRegionEntries = ReturnType<typeof createPetShellNativeRegionCollector>;
