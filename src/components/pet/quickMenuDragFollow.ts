// While a pet is dragged its new place is drawn straight onto the page and only committed to
// state on release, so the quick action menu (placed from that state) stayed behind. The drag
// preview publishes how far the pet is from its committed place; the open menu shifts by the
// same amount until the release re-places it.

export type QuickMenuDragOffset = { petId: string; x: number; y: number };
type Listener = (offset: QuickMenuDragOffset) => void;

const listeners = new Set<Listener>();

export function publishQuickMenuDragOffset(offset: QuickMenuDragOffset) {
  listeners.forEach((listener) => listener(offset));
}

export function subscribeQuickMenuDragOffset(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
