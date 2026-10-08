import { type MutableRefObject } from 'react';
import { type summarizeNativeInteractiveRegionMutationSource } from './petShellNativeElements';

export type NativeShapeRuntimeState = {
  companionDragState: unknown;
  dragState: unknown;
  isPetMotionActive: boolean;
  useFullWindowNativeShapeForPetDrag: boolean;
};

// Values and refs captured when the pointer shell effect starts. Plain values
// keep the effect closure semantics: they are a snapshot of that render.
export type PetShellPointerSessionValues = {
  activityRegionDragState: unknown;
  activityRegionResizeState: unknown;
  chatPanelDragState: unknown;
  chatPanelResizeState: unknown;
  isChatOpen: boolean;
  isSettingsOpen: boolean;
  latestNativeShapeRuntimeStateRef: MutableRefObject<NativeShapeRuntimeState>;
  nativeInteractiveRegionBaseRegionsRef?: MutableRefObject<DesktopPetInteractiveRegionLike[]>;
  nativeInteractiveRegionPostRenderSyncRef: MutableRefObject<(() => void) | null>;
  nativePetShapeStartupSuppressionUntilRef: MutableRefObject<number | null>;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  useExternalChatWindow: boolean;
  useExternalSettingsWindow: boolean;
  useNativeInteractiveRegions: boolean;
};

// Mutable per-effect session state (formerly closure-local variables).
export type PetShellPointerSessionState = {
  hasHoveredNativeInteractiveElement: boolean;
  hasHoveredNativePetElement: boolean;
  hoverPollIntervalId: number | null;
  hoveredNativeInteractiveScope: string | null;
  latestPointerPosition: { x: number; y: number } | null;
  live2DNativeRegionProbeCount: number;
  nativeInteractiveRegionDiagnosticsSignature: string;
  nativeInteractiveRegionLastSyncedAt: number;
  nativeInteractiveRegionObserver: MutationObserver | null;
  nativeInteractiveRegionResyncIntervalId: number | null;
  nativeInteractiveRegionScheduleReason: string;
  nativeInteractiveRegionScheduleSource: ReturnType<typeof summarizeNativeInteractiveRegionMutationSource>;
  nativeInteractiveRegionSyncAnimationFrameId: number | null;
  nativeInteractiveRegionSyncDirtyWhilePending: boolean;
  nativeInteractiveRegionSyncTimeoutId: number | null;
  pointerMoveAnimationFrameId: number | null;
  pointerPassthroughReleaseTimeoutId: number | null;
  pointerPassthroughState: boolean | null;
  suppressPetHitAreaHoverActivation: boolean;
  syncNativeInteractiveRegions: (reason?: string) => void;
};

export type PetShellPointerContext = PetShellPointerSessionValues & {
  live2DDragProbeEnabled: boolean;
  pointerDiagnosticsEnabled: boolean;
  pushPointerDiagnosticLog: (message: string, details?: unknown) => void;
  session: PetShellPointerSessionState;
};
