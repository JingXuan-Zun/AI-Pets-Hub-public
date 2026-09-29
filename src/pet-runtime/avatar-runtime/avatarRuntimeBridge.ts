import { type AvatarRuntimeEvent, type AvatarRuntimeEventListener } from './avatarRuntimeEvents';
import {
  type AvatarRuntimeContentState,
  type AvatarRuntimeKind,
  type AvatarRuntimeLayoutState,
} from './avatarRuntimeTypes';
import { type AvatarRuntimeSemanticState } from './avatarSemanticState';

type AvatarRuntimeSnapshotListener = () => void;

export type AvatarRuntimeSessionSnapshot = {
  content: AvatarRuntimeContentState;
  debugLabel: string | null;
  layout: AvatarRuntimeLayoutState;
  petId: string;
  runtimeKind: AvatarRuntimeKind;
  semanticState: AvatarRuntimeSemanticState;
  visible: boolean;
};

export interface AvatarRuntimeBridgeSession<TKind extends AvatarRuntimeKind = AvatarRuntimeKind> {
  dispose: () => void;
  emitEvent: (event: AvatarRuntimeEvent) => void;
  getSnapshot: () => AvatarRuntimeSessionSnapshot & { runtimeKind: TKind };
  loadContent: (content: AvatarRuntimeContentState) => void;
  petId: string;
  runtimeKind: TKind;
  setLayout: (layout: AvatarRuntimeLayoutState) => void;
  setSemanticState: (semanticState: AvatarRuntimeSemanticState) => void;
  setVisibility: (visible: boolean) => void;
  subscribe: (listener: AvatarRuntimeSnapshotListener) => () => void;
  subscribeToEvents: (listener: AvatarRuntimeEventListener) => () => void;
}

export interface AvatarRuntimeBridge<TKind extends AvatarRuntimeKind = AvatarRuntimeKind> {
  createSession: (petId: string, debugLabel?: string | null) => AvatarRuntimeBridgeSession<TKind>;
  runtimeKind: TKind;
}

type CreateAvatarRuntimeSessionStoreOptions<TKind extends AvatarRuntimeKind> = {
  debugLabel?: string | null;
  initialContent: AvatarRuntimeContentState;
  initialLayout: AvatarRuntimeLayoutState;
  initialSemanticState: AvatarRuntimeSemanticState;
  petId: string;
  runtimeKind: TKind;
  visible?: boolean;
};

export function createAvatarRuntimeSessionStore<TKind extends AvatarRuntimeKind>({
  debugLabel = null,
  initialContent,
  initialLayout,
  initialSemanticState,
  petId,
  runtimeKind,
  visible = true,
}: CreateAvatarRuntimeSessionStoreOptions<TKind>): AvatarRuntimeBridgeSession<TKind> {
  let snapshot: AvatarRuntimeSessionSnapshot & { runtimeKind: TKind } = {
    content: initialContent,
    debugLabel,
    layout: initialLayout,
    petId,
    runtimeKind,
    semanticState: initialSemanticState,
    visible,
  };
  const snapshotListeners = new Set<AvatarRuntimeSnapshotListener>();
  const eventListeners = new Set<AvatarRuntimeEventListener>();
  let disposed = false;

  const notifySnapshotListeners = () => {
    snapshotListeners.forEach((listener) => listener());
  };

  const updateSnapshot = (
    nextPartial: Partial<AvatarRuntimeSessionSnapshot & { runtimeKind: TKind }>,
  ) => {
    if (disposed) {
      return;
    }

    snapshot = {
      ...snapshot,
      ...nextPartial,
    };
    notifySnapshotListeners();
  };

  return {
    dispose: () => {
      disposed = true;
      snapshotListeners.clear();
      eventListeners.clear();
    },
    emitEvent: (event) => {
      if (disposed) {
        return;
      }

      eventListeners.forEach((listener) => listener(event));
    },
    getSnapshot: () => snapshot,
    loadContent: (content) => {
      updateSnapshot({ content });
    },
    petId,
    runtimeKind,
    setLayout: (layout) => {
      updateSnapshot({ layout });
    },
    setSemanticState: (semanticState) => {
      updateSnapshot({ semanticState });
    },
    setVisibility: (nextVisible) => {
      updateSnapshot({ visible: nextVisible });
    },
    subscribe: (listener) => {
      if (disposed) {
        return () => {};
      }

      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribeToEvents: (listener) => {
      if (disposed) {
        return () => {};
      }

      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
  };
}
