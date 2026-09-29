import {
  resolvePetContentExpressionNames,
  type PetContentManifest,
} from '../content/petContentManifest';

export type Live2DExpressionPresentationSource = 'chat' | 'dragging' | 'idle';

export type Live2DExpressionPresentationTarget = {
  candidates: string[];
  expressionKey: string;
  source: Live2DExpressionPresentationSource;
};

const DEFAULT_DRAGGING_EXPRESSION_CANDIDATES = [
  'dragging',
  'Dragging',
  'drag',
  'Drag',
];

const DEFAULT_IDLE_EXPRESSION_CANDIDATES = ['idle', 'Idle'];

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function resolveLive2DExpressionPresentationTarget(options: {
  chatCandidates: string[];
  chatExpressionKey: string | null;
  contentManifest?: PetContentManifest | null;
  isDragging: boolean;
}): Live2DExpressionPresentationTarget {
  if (options.isDragging) {
    return {
      candidates: uniqueNonEmpty([
        ...resolvePetContentExpressionNames(options.contentManifest, 'dragging'),
        ...DEFAULT_DRAGGING_EXPRESSION_CANDIDATES,
      ]),
      expressionKey: 'dragging',
      source: 'dragging',
    };
  }
  if (options.chatExpressionKey) {
    return {
      candidates: uniqueNonEmpty(options.chatCandidates),
      expressionKey: options.chatExpressionKey,
      source: 'chat',
    };
  }
  return {
    candidates: uniqueNonEmpty([
      ...resolvePetContentExpressionNames(options.contentManifest, 'idle'),
      ...DEFAULT_IDLE_EXPRESSION_CANDIDATES,
    ]),
    expressionKey: 'idle',
    source: 'idle',
  };
}

export function resolveLive2DExpressionTransitionDelayMs(options: {
  appliedAtMs: number;
  nextSource: Live2DExpressionPresentationSource;
  nowMs: number;
  previousSource: Live2DExpressionPresentationSource | null;
}) {
  if (options.nextSource === 'dragging') {
    return 0;
  }
  if (options.previousSource === 'dragging') {
    return 140;
  }
  if (options.previousSource !== 'chat') {
    return 0;
  }
  return Math.max(0, 600 - Math.max(0, options.nowMs - options.appliedAtMs));
}
