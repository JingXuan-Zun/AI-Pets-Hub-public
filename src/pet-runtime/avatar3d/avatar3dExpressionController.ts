import {
  resolvePetMessageExpressionActions,
  type PetMessageExpressionAction,
} from '../interactions/petMessageExpressionSignals';
import {
  type PetHoverRegion,
} from '../interactions/petHoverController';
import { type PetContentExpressionKey } from '../content/petContentManifest';
import {
  type PetHoverInteractionEvent,
} from '../interactions/petHoverInteractionController';
import { type AvatarRuntimeManualExpressionSelection } from '../avatar-runtime/avatarRuntimeTypes';
import { createManualAvatar3DExpressionCue } from './avatar3dManualExpressionState';

const DEFAULT_EXPRESSION_CUE_DURATION_MS = 1800;

export type Avatar3DExpressionCue = {
  action: PetMessageExpressionAction | null;
  affectsPresentation: boolean;
  candidateExpressionNames?: string[];
  durationMs: number;
  expressionKey?: PetContentExpressionKey | null;
  id: string;
  index: number;
  region?: PetHoverRegion | null;
  source: 'fallback' | 'hover' | 'manual' | 'message';
  weightMultiplier: number;
};

export type Avatar3DExpressionControllerState = {
  activeAction: PetMessageExpressionAction | null;
  activeCue: Avatar3DExpressionCue | null;
  cues: Avatar3DExpressionCue[];
  hasActiveExpression: boolean;
  shouldOverridePresentation: boolean;
  source: 'fallback' | 'hover' | 'manual' | 'message' | 'none';
};

type ResolveAvatar3DExpressionControllerStateOptions = {
  durationMs?: number;
  fallbackExpressionAction?: PetMessageExpressionAction | null;
  hoverInteractionEvent?: PetHoverInteractionEvent | null;
  isTyping?: boolean;
  latestMessage?: string;
  manualExpressionSelection?: AvatarRuntimeManualExpressionSelection | null;
  messageExpressionAction?: PetMessageExpressionAction | null;
};

export function resolveAvatar3DExpressionCues(
  latestMessage: string,
  durationMs = DEFAULT_EXPRESSION_CUE_DURATION_MS,
) {
  return resolvePetMessageExpressionActions(latestMessage).map((action, index) => ({
    action,
    affectsPresentation: true,
    durationMs,
    expressionKey: null,
    id: `${action}-${index}`,
    index,
    source: 'message' as const,
    weightMultiplier: 1,
  }));
}

function resolveHoverExpressionCue(
  hoverInteractionEvent: PetHoverInteractionEvent | null | undefined,
): Avatar3DExpressionCue | null {
  if (!hoverInteractionEvent) {
    return null;
  }

  return {
    action: hoverInteractionEvent.action,
    affectsPresentation: hoverInteractionEvent.affectsPresentation,
    durationMs: hoverInteractionEvent.durationMs,
    expressionKey: hoverInteractionEvent.expressionKey,
    id: hoverInteractionEvent.id,
    index: 0,
    region: hoverInteractionEvent.region,
    source: 'hover',
    weightMultiplier: hoverInteractionEvent.weightMultiplier,
  };
}

export function resolveAvatar3DExpressionControllerState({
  durationMs = DEFAULT_EXPRESSION_CUE_DURATION_MS,
  fallbackExpressionAction = null,
  hoverInteractionEvent,
  isTyping = false,
  latestMessage = '',
  manualExpressionSelection = null,
  messageExpressionAction = null,
}: ResolveAvatar3DExpressionControllerStateOptions): Avatar3DExpressionControllerState {
  if (isTyping) {
    return {
      activeAction: null,
      activeCue: null,
      cues: [],
      hasActiveExpression: false,
      shouldOverridePresentation: false,
      source: 'none',
    };
  }

  const hoverCue = resolveHoverExpressionCue(hoverInteractionEvent);
  if (hoverCue) {
    return {
      activeAction: hoverCue.action,
      activeCue: hoverCue,
      cues: [hoverCue],
      hasActiveExpression: Boolean(hoverCue.action || hoverCue.expressionKey),
      shouldOverridePresentation: hoverCue.affectsPresentation,
      source: 'hover',
    };
  }

  const manualCue = createManualAvatar3DExpressionCue(manualExpressionSelection);
  if (manualCue) {
    return {
      activeAction: null,
      activeCue: manualCue,
      cues: [manualCue],
      hasActiveExpression: true,
      shouldOverridePresentation: false,
      source: 'manual',
    };
  }

  const cues = resolveAvatar3DExpressionCues(latestMessage, durationMs);
  if (messageExpressionAction) {
    const matchedCue = cues.find((cue) => cue.action === messageExpressionAction) ?? null;
    const activeCue = matchedCue ?? {
      action: messageExpressionAction,
      affectsPresentation: true,
      durationMs,
      expressionKey: null,
      id: `${messageExpressionAction}-message`,
      index: 0,
      source: 'message' as const,
      weightMultiplier: 1,
    };
    return {
      activeAction: messageExpressionAction,
      activeCue,
      cues: cues.length > 0 ? cues : [activeCue],
      hasActiveExpression: true,
      shouldOverridePresentation: activeCue.affectsPresentation,
      source: 'message',
    };
  }

  if (fallbackExpressionAction) {
    const fallbackCue: Avatar3DExpressionCue = {
      action: fallbackExpressionAction,
      affectsPresentation: true,
      durationMs,
      expressionKey: null,
      id: `${fallbackExpressionAction}-fallback`,
      index: 0,
      source: 'fallback',
      weightMultiplier: 1,
    };
    return {
      activeAction: fallbackExpressionAction,
      activeCue: fallbackCue,
      cues: [fallbackCue],
      hasActiveExpression: true,
      shouldOverridePresentation: fallbackCue.affectsPresentation,
      source: 'fallback',
    };
  }

  return {
    activeAction: null,
    activeCue: null,
    cues: [],
    hasActiveExpression: false,
    shouldOverridePresentation: false,
    source: 'none',
  };
}
