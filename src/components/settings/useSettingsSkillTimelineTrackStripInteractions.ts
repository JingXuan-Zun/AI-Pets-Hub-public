import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { type SkillTimelineSnapPolicy } from './settingsSkillTimelineSnapPolicy';
import {
  createSkillTimelineStripBatchDragPreviews,
  type SkillTimelineStripBatchDragPreview,
} from './settingsSkillTimelineStripBatchDragPreview';
import {
  createSkillTimelineStripDragTimingPreview,
  type SkillTimelineStripDragTimingPreview,
} from './settingsSkillTimelineStripDragTiming';
import {
  createSkillTimelineStripResizePreview,
  type SkillTimelineStripResizePreview,
} from './settingsSkillTimelineStripResizeDuration';
import { useSettingsSkillTimelineTrackDrop } from './useSettingsSkillTimelineTrackDrop';

interface SkillTimelineDragPreviewState {
  batchDragPreviews: SkillTimelineStripBatchDragPreview[];
  clearDragPreview: () => void;
  dragPreview: SkillTimelineStripDragTimingPreview | null;
  previewDragTiming: (stepId: string, leftPercent: number, selectedStepIds: string[]) => void;
}

interface SkillTimelineResizePreviewState {
  clearResizePreview: () => void;
  previewResizeDuration: (stepId: string, rightPercent: number) => void;
  resizePreview: SkillTimelineStripResizePreview | null;
}

interface UseSkillTimelineTrackStripInteractionsOptions {
  draft: SkillTimelineEditorDraft;
  durationMs: number;
  onDragStepTiming?: (stepId: string, leftPercent: number, durationMs: number) => void;
  onDropStepTrack?: (stepId: string, trackId: string) => void;
  onFocusStep?: (stepId: string) => void;
  onNudgeStepTiming?: (stepId: string, direction: -1 | 1) => void;
  onResizeStepDuration?: (stepId: string, rightPercent: number, durationMs: number) => void;
  onSelectStep?: (stepId: string) => void;
  selectedStepIds?: string[];
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
}

function resolveLeftPercent(event: PointerEvent<HTMLElement>) {
  const trackElement = event.currentTarget.closest('[data-skill-timeline-track]');
  const bounds = trackElement?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0) {
    return 0;
  }

  return ((event.clientX - bounds.left) / bounds.width) * 100;
}

function createDragPreview(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  leftPercent: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
  step?: SkillTimelineEditorStepDraft,
) {
  return step
    ? createSkillTimelineStripDragTimingPreview({ draft, durationMs, leftPercent, snapPolicy, step })
    : null;
}

function createResizePreview(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  rightPercent: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
  step?: SkillTimelineEditorStepDraft,
) {
  return step
    ? createSkillTimelineStripResizePreview({ draft, durationMs, rightPercent, snapPolicy, step })
    : null;
}

function resolveKeyboardNudgeDirection(key: string) {
  return key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
}

function useSkillTimelineDragPreviewState(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
): SkillTimelineDragPreviewState {
  const [batchDragPreviews, setBatchDragPreviews] = useState<SkillTimelineStripBatchDragPreview[]>([]);
  const [dragPreview, setDragPreview] = useState<SkillTimelineStripDragTimingPreview | null>(null);
  const stepsById = useMemo(() => new Map(draft.steps.map((step) => [step.id, step])), [draft.steps]);
  const previewDragTiming = (stepId: string, leftPercent: number, selectedStepIds: string[]) => {
    setDragPreview(createDragPreview(draft, durationMs, leftPercent, snapPolicy, stepsById.get(stepId)));
    setBatchDragPreviews(createSkillTimelineStripBatchDragPreviews({
      draft,
      durationMs,
      leftPercent,
      primaryStepId: stepId,
      selectedStepIds,
      snapPolicy,
    }));
  };

  return {
    batchDragPreviews,
    clearDragPreview: () => {
      setDragPreview(null);
      setBatchDragPreviews([]);
    },
    dragPreview,
    previewDragTiming,
  };
}

function useSkillTimelineResizePreviewState(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
): SkillTimelineResizePreviewState {
  const [resizePreview, setResizePreview] = useState<SkillTimelineStripResizePreview | null>(null);
  const stepsById = useMemo(() => new Map(draft.steps.map((step) => [step.id, step])), [draft.steps]);
  const previewResizeDuration = (stepId: string, rightPercent: number) => {
    setResizePreview(createResizePreview(draft, durationMs, rightPercent, snapPolicy, stepsById.get(stepId)));
  };

  return {
    clearResizePreview: () => setResizePreview(null),
    previewResizeDuration,
    resizePreview,
  };
}

function useSkillTimelinePointerDragHandlers(options: {
  dragPreviewState: SkillTimelineDragPreviewState;
  durationMs: number;
  onFocusStep?: (stepId: string) => void;
  onDragStepTiming?: (stepId: string, leftPercent: number, durationMs: number) => void;
  onSelectStep?: (stepId: string) => void;
  selectedStepIds: string[];
  trackDrop: ReturnType<typeof useSettingsSkillTimelineTrackDrop>;
}) {
  const dragStepIdRef = useRef('');
  const startDrag = (event: PointerEvent<HTMLButtonElement>, stepId: string) => {
    dragStepIdRef.current = stepId;
    event.currentTarget.setPointerCapture(event.pointerId);
    options.dragPreviewState.previewDragTiming(stepId, resolveLeftPercent(event), options.selectedStepIds);
    options.trackDrop.previewTrackDrop(event);
    options.onFocusStep?.(stepId);
  };
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragStepIdRef.current || event.buttons !== 1) {
      return;
    }

    const leftPercent = resolveLeftPercent(event);
    options.dragPreviewState.previewDragTiming(dragStepIdRef.current, leftPercent, options.selectedStepIds);
    options.trackDrop.previewTrackDrop(event);
    options.onDragStepTiming?.(dragStepIdRef.current, leftPercent, options.durationMs);
  };
  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    options.trackDrop.commitTrackDrop(dragStepIdRef.current, event);
    dragStepIdRef.current = '';
    options.dragPreviewState.clearDragPreview();
    options.trackDrop.clearTrackDrop();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return { endDrag, moveDrag, startDrag };
}

function useSkillTimelineResizeHandlers(options: {
  durationMs: number;
  onResizeStepDuration?: (stepId: string, rightPercent: number, durationMs: number) => void;
  onSelectStep?: (stepId: string) => void;
  resizePreviewState: SkillTimelineResizePreviewState;
}) {
  const resizeStepIdRef = useRef('');
  const startResize = (event: PointerEvent<HTMLElement>, stepId: string) => {
    event.stopPropagation();
    resizeStepIdRef.current = stepId;
    event.currentTarget.setPointerCapture(event.pointerId);
    options.resizePreviewState.previewResizeDuration(stepId, resolveLeftPercent(event));
    options.onSelectStep?.(stepId);
  };
  const moveResize = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!resizeStepIdRef.current || event.buttons !== 1) {
      return;
    }

    const rightPercent = resolveLeftPercent(event);
    options.resizePreviewState.previewResizeDuration(resizeStepIdRef.current, rightPercent);
    options.onResizeStepDuration?.(resizeStepIdRef.current, rightPercent, options.durationMs);
  };
  const endResize = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    resizeStepIdRef.current = '';
    options.resizePreviewState.clearResizePreview();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return { endResize, moveResize, startResize };
}

function useSkillTimelineKeyboardNudgeHandlers(options: {
  onNudgeStepTiming?: (stepId: string, direction: -1 | 1) => void;
  onSelectStep?: (stepId: string) => void;
}) {
  const nudgeStepFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, stepId: string) => {
    const direction = resolveKeyboardNudgeDirection(event.key);
    if (!direction) {
      return;
    }

    event.preventDefault();
    options.onSelectStep?.(stepId);
    options.onNudgeStepTiming?.(stepId, direction);
  };

  return { nudgeStepFromKeyboard };
}

export function useSettingsSkillTimelineTrackStripInteractions({
  draft,
  durationMs,
  onDragStepTiming,
  onDropStepTrack,
  onFocusStep,
  onNudgeStepTiming,
  onResizeStepDuration,
  onSelectStep,
  selectedStepIds = [],
  snapPolicy,
}: UseSkillTimelineTrackStripInteractionsOptions) {
  const dragPreviewState = useSkillTimelineDragPreviewState(draft, durationMs, snapPolicy);
  const resizePreviewState = useSkillTimelineResizePreviewState(draft, durationMs, snapPolicy);
  const trackDrop = useSettingsSkillTimelineTrackDrop(onDropStepTrack);
  const pointerHandlers = useSkillTimelinePointerDragHandlers({
    dragPreviewState,
    durationMs,
    onDragStepTiming,
    onFocusStep,
    onSelectStep,
    selectedStepIds,
    trackDrop,
  });
  const keyboardHandlers = useSkillTimelineKeyboardNudgeHandlers({ onNudgeStepTiming, onSelectStep });
  const resizeHandlers = useSkillTimelineResizeHandlers({
    durationMs,
    onResizeStepDuration,
    onSelectStep,
    resizePreviewState,
  });

  return {
    batchDragPreviews: dragPreviewState.batchDragPreviews,
    dragPreview: dragPreviewState.dragPreview,
    hoverTrackId: trackDrop.hoverTrackId,
    registerTrackElement: trackDrop.registerTrackElement,
    resizePreview: resizePreviewState.resizePreview,
    ...keyboardHandlers,
    ...pointerHandlers,
    ...resizeHandlers,
  };
}
