import { createContext, type ReactNode } from 'react';
// @ts-expect-error The reconciler bundled with @react-three/fiber ships without a typed default export path.
import reconcilerModule from '@react-three/fiber/react-reconciler/index.js';

// A DOM-free React renderer for smoke tests: host elements become plain
// records, so real components and hooks run their render, layout and passive
// effects synchronously in Node without a browser or test renderer package.
export interface NullHostInstance {
  __fakeId: string;
  type: string;
  props: Record<string, unknown>;
  children: NullHostInstance[];
  parent: NullHostInstance | null;
  dataset: Record<string, string>;
  isConnected: boolean;
  parentElement: { getBoundingClientRect: () => DOMRectLike } | null;
  getBoundingClientRect: () => DOMRectLike;
}

export interface DOMRectLike {
  height: number;
  left: number;
  top: number;
  width: number;
}

const NO_CONTEXT = {};
let currentUpdatePriority = 0;

function createHostInstance(type: string, props: Record<string, unknown>): NullHostInstance {
  const rect = { height: 300, left: 10, top: 20, width: 300 };
  return {
    __fakeId: `host:${type}`,
    type,
    props,
    children: [],
    parent: null,
    dataset: {},
    isConnected: true,
    parentElement: { getBoundingClientRect: () => ({ height: 400, left: 0, top: 0, width: 400 }) },
    getBoundingClientRect: () => ({ ...rect }),
  };
}

function append(parent: NullHostInstance | { children: NullHostInstance[] }, child: NullHostInstance) {
  parent.children.push(child);
  child.parent = 'type' in parent ? parent : null;
}

function remove(parent: { children: NullHostInstance[] }, child: NullHostInstance) {
  const index = parent.children.indexOf(child);
  if (index >= 0) parent.children.splice(index, 1);
  child.isConnected = false;
}

const createReconciler = reconcilerModule.default ?? reconcilerModule;
const reconciler = createReconciler({
  isPrimaryRenderer: false,
  warnsIfNotActing: false,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  supportsMicrotasks: true,
  scheduleMicrotask: (callback: () => void) => queueMicrotask(callback),
  createInstance: (type: string, props: Record<string, unknown>) => createHostInstance(type, props),
  appendInitialChild: append,
  appendChild: append,
  appendChildToContainer: append,
  insertBefore: (parent: NullHostInstance, child: NullHostInstance, before: NullHostInstance) => {
    parent.children.splice(parent.children.indexOf(before), 0, child);
  },
  insertInContainerBefore: (container: { children: NullHostInstance[] }, child: NullHostInstance, before: NullHostInstance) => {
    container.children.splice(container.children.indexOf(before), 0, child);
  },
  removeChild: remove,
  removeChildFromContainer: remove,
  commitUpdate: (instance: NullHostInstance, _type: string, _oldProps: unknown, newProps: Record<string, unknown>) => {
    instance.props = newProps;
  },
  getRootHostContext: () => NO_CONTEXT,
  getChildHostContext: () => NO_CONTEXT,
  finalizeInitialChildren: () => false,
  commitMount() {},
  getPublicInstance: (instance: NullHostInstance) => instance,
  prepareForCommit: () => null,
  preparePortalMount() {},
  resetAfterCommit() {},
  shouldSetTextContent: () => false,
  clearContainer: (container: { children: NullHostInstance[] }) => { container.children.length = 0; },
  hideInstance() {},
  unhideInstance() {},
  createTextInstance: (text: string) => createHostInstance('#text', { text }),
  commitTextUpdate() {},
  hideTextInstance() {},
  unhideTextInstance() {},
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  detachDeletedInstance() {},
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent() {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  requestPostPaintCallback() {},
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),
  setCurrentUpdatePriority(priority: number) { currentUpdatePriority = priority; },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  // Treat every update as discrete so state set inside effects settles within one flush.
  resolveUpdatePriority: () => (currentUpdatePriority !== 0 ? currentUpdatePriority : 2),
  resetFormInstance() {},
  rendererPackageName: 'null-react-renderer',
  rendererVersion: '0.0.0',
  applyViewTransitionName() {},
  restoreViewTransitionName() {},
  cancelViewTransitionName() {},
  cancelRootViewTransitionName() {},
  restoreRootViewTransitionName() {},
  InstanceMeasurement: null,
  measureInstance: () => null,
  wasInstanceInViewport: () => true,
  hasInstanceChanged: () => false,
  hasInstanceAffectedParent: () => false,
  suspendOnActiveViewTransition() {},
});

export function createNullRoot(onError: (error: unknown) => void) {
  const container = { children: [] as NullHostInstance[] };
  const root = reconciler.createContainer(container, 0, null, false, null, '', onError, onError, onError, null);
  const flush = async () => {
    for (let round = 0; round < 8; round += 1) {
      reconciler.flushSyncWork();
      reconciler.flushPassiveEffects();
      reconciler.flushSyncWork();
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  return {
    container,
    async render(element: ReactNode) {
      reconciler.updateContainerSync(element, root, null, null);
      await flush();
    },
    flush,
    async unmount() {
      reconciler.updateContainerSync(null, root, null, null);
      await flush();
    },
  };
}
