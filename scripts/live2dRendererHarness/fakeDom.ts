import { record } from './traceStore.ts';

type Rect = { height: number; left: number; top: number; width: number };
type Listener = { capture: boolean; handler: (event: unknown) => void };

function parseSelector(selector: string) {
  return selector.split(',').map((part) => {
    const match = /^\s*\[([^\]=]+)(?:="([^"]*)")?\]\s*$/u.exec(part);
    if (!match) throw new Error(`unsupported selector ${selector}`);
    return { name: match[1], value: match[2] ?? null };
  });
}

export class FakeElement {
  readonly id = '';
  children: FakeElement[] = [];
  constructor(
    public tagName: string,
    public attributes: Record<string, string>,
    public rect: Rect,
    public parentElement: FakeElement | null = null,
  ) {
    parentElement?.children.push(this);
  }
  getAttribute(name: string) { return this.attributes[name] ?? null; }
  hasAttribute(name: string) { return name in this.attributes; }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  matches(selector: string) {
    return parseSelector(selector).some(({ name, value }) => (
      this.hasAttribute(name) && (value === null || this.attributes[name] === value)
    ));
  }
  closest(selector: string): FakeElement | null {
    for (let current: FakeElement | null = this; current; current = current.parentElement) {
      if (current.matches(selector)) return current;
    }
    return null;
  }
  getBoundingClientRect() {
    const { height, left, top, width } = this.rect;
    return { bottom: top + height, height, left, right: left + width, top, width, x: left, y: top };
  }
}

export class FakeEvent {
  constructor(public type: string, init: Record<string, unknown> = {}) {
    Object.assign(this, init);
  }
}

export class FakeMutationRecord {
  constructor(public type: string, public attributeName: string | null, public target: unknown) {}
}

export class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];
  constructor(public callback: (records: unknown) => void) {
    FakeMutationObserver.instances.push(this);
  }
  observe(_target: unknown, options: unknown) { record('mutationObserver.observe', options); }
  disconnect() {
    record('mutationObserver.disconnect');
    FakeMutationObserver.instances = FakeMutationObserver.instances.filter((entry) => entry !== this);
  }
}

export function createListenerTarget(label: string) {
  const listeners = new Map<string, Listener[]>();
  return {
    addEventListener(type: string, handler: (event: unknown) => void, capture = false) {
      record(`${label}.addEventListener`, type, Boolean(capture));
      listeners.set(type, [...(listeners.get(type) ?? []), { capture: Boolean(capture), handler }]);
    },
    removeEventListener(type: string, handler: (event: unknown) => void, capture = false) {
      record(`${label}.removeEventListener`, type, Boolean(capture));
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => !(entry.handler === handler && entry.capture === Boolean(capture))));
    },
    dispatch(type: string, event: unknown) {
      for (const entry of [...(listeners.get(type) ?? [])]) entry.handler(event);
    },
  };
}

export function createFakeDocumentTree() {
  const body = new FakeElement('BODY', {}, { height: 600, left: 0, top: 0, width: 800 });
  const pet = new FakeElement('DIV', { 'data-desktop-pet-id': 'pet-a' }, { height: 240, left: 100, top: 100, width: 200 }, body);
  const petShape = new FakeElement('DIV', { 'data-desktop-pet-window-shape': 'true' }, { height: 220, left: 110, top: 110, width: 180 }, pet);
  const petHitArea = new FakeElement('DIV', { 'data-desktop-pet-interactive': 'true' }, { height: 200, left: 120, top: 120, width: 160 }, pet);
  const chatButton = new FakeElement('BUTTON', { 'data-desktop-pet-interactive': 'true', 'data-desktop-pet-native-scope': 'ui' }, { height: 30, left: 10, top: 10, width: 40 }, body);
  const activityHandle = new FakeElement('DIV', {
    'data-desktop-pet-activity-region-handle': 'true',
    'data-desktop-pet-interactive': 'true',
    'data-desktop-pet-native-scope': 'activity-region',
  }, { height: 20, left: 300, top: 5, width: 20 }, body);
  const paddedShape = new FakeElement('DIV', {
    'data-desktop-pet-native-scope': 'ui',
    'data-desktop-pet-window-shape': 'true',
    'data-desktop-pet-window-shape-padding': '12',
  }, { height: 50, left: 400, top: 400, width: 50 }, body);
  const collapsed = new FakeElement('SPAN', { 'data-desktop-pet-interactive': 'true' }, { height: 0, left: 0, top: 0, width: 0 }, body);
  const all = () => {
    const result: FakeElement[] = [];
    const visit = (element: FakeElement) => { element.children.forEach((child) => { result.push(child); visit(child); }); };
    visit(body);
    return result;
  };
  const elementFromPoint = (x: number, y: number) => {
    const hits = all().filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
    return hits[hits.length - 1] ?? body;
  };
  return {
    activityHandle, all, body, chatButton, collapsed, elementFromPoint, paddedShape, pet, petHitArea, petShape,
    querySelectorAll: (selector: string) => all().filter((element) => element.matches(selector)),
  };
}
