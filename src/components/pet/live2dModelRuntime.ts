import { Ticker } from 'pixi.js';
import type { Live2DModel as Live2DModelClass, MotionPriority } from 'pixi-live2d-display/cubism4';
import { type PetModelMotionBinding } from '../../types';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { ensureLive2DCubism4Core } from '../../pet-runtime/live2d/live2dCubismCoreLoader';
import {
  resolveLive2DExternalExpressionDefinitions,
  resolveLive2DExternalMotionGroups,
} from '../../pet-runtime/live2d/live2dRuntimeMapping';
import { resolveLive2DAvailableMotionCandidateGroups } from './live2dMotionAvailability';
import { resolveLive2DStageFit, type Live2DFitBounds } from './live2dModelFit';
import {
  resolveLive2DRuntimeProfile,
  type Live2DRuntimeProfileConfigV1,
  type ResolvedLive2DRuntimeProfile,
} from '../../pet-runtime/live2d/live2dRuntimeProfile';

type Live2DCoreModelLike = {
  getDrawableOpacity?: (drawableIndex: number) => number;
  getParameterIndex?: (parameterId: string) => number;
};

type Live2DMotionManagerLike = {
  definitions?: Record<string, Array<Record<string, unknown>>>;
  expressionManager?: Live2DExpressionManagerLike;
  motionGroups?: Record<string, unknown[]>;
  settings?: unknown;
  stopAllMotions?: () => void;
};

type Live2DExpressionManagerLike = {
  currentExpression?: unknown;
  defaultExpression?: unknown;
  definitions?: Array<{ File?: string; Name?: string; name?: string }>;
  expressions?: unknown[];
  resetExpression?: () => void;
  setExpression?: (index: number | string) => Promise<boolean>;
};

type Live2DInternalModelLike = {
  expressionManager?: Live2DExpressionManagerLike;
  getDrawableBounds?: (drawableIndex: number) => Live2DFitBounds;
  getDrawableIDs?: () => string[];
  height?: number;
  motionManager?: Live2DMotionManagerLike;
  width?: number;
};

export type Live2DModelLike = Awaited<ReturnType<typeof Live2DModelClass.from>> & {
  height: number;
  internalModel?: Live2DInternalModelLike;
  width: number;
};

export type Live2DModelPresentationOptions = {
  contentManifest: PetContentManifest | null;
  live2dRuntimeProfile?: Live2DRuntimeProfileConfigV1 | null;
  motionBindings: PetModelMotionBinding[];
  stageSize: number;
  visible: boolean;
};

type Live2DCubism4RuntimeModule = typeof import('pixi-live2d-display/cubism4');

export type Live2DExpressionManagerConstructor = new (
  settings: unknown,
  options?: unknown,
) => Live2DExpressionManagerLike;

export const LIVE2D_MOTION_PRIORITY_NORMAL = 2;
export const LIVE2D_MOTION_PRIORITY_FORCE = 3;

let live2dCubism4RuntimePromise: Promise<Live2DCubism4RuntimeModule> | null = null;

export async function loadLive2DCubism4Runtime() {
  await ensureLive2DCubism4Core();

  if (!live2dCubism4RuntimePromise) {
    live2dCubism4RuntimePromise = import('pixi-live2d-display/cubism4').then((runtimeModule) => {
      runtimeModule.Live2DModel.registerTicker(Ticker);
      return runtimeModule;
    });
  }

  return live2dCubism4RuntimePromise;
}

function resolveLive2DModelCanvasBounds(model: Live2DModelLike): Live2DFitBounds {
  const localBounds = model.getLocalBounds();
  const localWidth = Math.max(1, Number(localBounds.width) || 0);
  const localHeight = Math.max(1, Number(localBounds.height) || 0);
  const currentScaleX = Math.abs(Number(model.scale.x) || 1);
  const currentScaleY = Math.abs(Number(model.scale.y) || 1);
  const widthFromCurrentScale = Math.max(1, (Number(model.width) || 0) / currentScaleX);
  const heightFromCurrentScale = Math.max(1, (Number(model.height) || 0) / currentScaleY);

  return {
    height: Math.max(1, Number(model.internalModel?.height) || (localHeight > 1 ? localHeight : heightFromCurrentScale)),
    width: Math.max(1, Number(model.internalModel?.width) || (localWidth > 1 ? localWidth : widthFromCurrentScale)),
    x: 0,
    y: 0,
  };
}

export function resolveLive2DVisibleDrawableBounds(model: Live2DModelLike): Live2DFitBounds | null {
  const internalModel = model.internalModel;
  const drawableIds = internalModel?.getDrawableIDs?.() ?? [];
  if (!internalModel?.getDrawableBounds || drawableIds.length === 0) {
    return null;
  }

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const coreModel = (internalModel as unknown as { coreModel?: Live2DCoreModelLike } | undefined)?.coreModel;
  for (let drawableIndex = 0; drawableIndex < drawableIds.length; drawableIndex += 1) {
    const opacity = coreModel?.getDrawableOpacity?.(drawableIndex);
    if (Number.isFinite(opacity) && (opacity as number) <= 0.001) {
      continue;
    }

    const bounds = internalModel.getDrawableBounds(drawableIndex);
    if (
      !Number.isFinite(bounds.x)
      || !Number.isFinite(bounds.y)
      || !Number.isFinite(bounds.width)
      || !Number.isFinite(bounds.height)
      || bounds.width <= 0
      || bounds.height <= 0
    ) {
      continue;
    }

    left = Math.min(left, bounds.x);
    top = Math.min(top, bounds.y);
    right = Math.max(right, bounds.x + bounds.width);
    bottom = Math.max(bottom, bounds.y + bounds.height);
  }

  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
    return null;
  }

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}

export function resolveLive2DRuntimeProfileForModel(
  model: Live2DModelLike,
  config?: Live2DRuntimeProfileConfigV1 | null,
  declaredParameterIds?: ReadonlySet<string> | null,
) {
  const coreModel = (model.internalModel as unknown as { coreModel?: Live2DCoreModelLike } | undefined)?.coreModel;
  return resolveLive2DRuntimeProfile({
    config,
    coreModel: coreModel ?? {},
    declaredParameterIds,
  });
}

function fitLive2DModelToStage(
  model: Live2DModelLike,
  stageSize: number,
  runtimeProfile: ResolvedLive2DRuntimeProfile,
) {
  const safeStageSize = Math.max(1, Math.round(stageSize));
  const fit = resolveLive2DStageFit({
    canvasBounds: resolveLive2DModelCanvasBounds(model),
    drawableBounds: resolveLive2DVisibleDrawableBounds(model),
    fitMode: runtimeProfile.layout.fitMode,
    profileScale: runtimeProfile.layout.scale,
    stageSize: safeStageSize,
  });

  if (fit.useDrawableBounds) {
    model.anchor.set(0, 0);
    model.pivot.set(
      fit.bounds.x + fit.bounds.width * runtimeProfile.layout.visibleBoundsAnchorX,
      fit.bounds.y + fit.bounds.height * runtimeProfile.layout.visibleBoundsAnchorY,
    );
  } else {
    model.anchor.set(
      runtimeProfile.layout.canvasAnchorX,
      runtimeProfile.layout.canvasAnchorY,
    );
  }
  model.scale.set(fit.scale);
  model.x = safeStageSize * (0.5 + runtimeProfile.layout.offsetX);
  model.y = safeStageSize * (0.5 + runtimeProfile.layout.offsetY);
}

export function resolveLive2DExpressionManager(model: Live2DModelLike) {
  return model.internalModel?.motionManager?.expressionManager
    ?? model.internalModel?.expressionManager
    ?? null;
}

export function resolveAvailableExpressionNames(model: Live2DModelLike) {
  return (resolveLive2DExpressionManager(model)?.definitions ?? [])
    .map((definition) => definition.Name ?? definition.name ?? '')
    .filter(Boolean);
}

function ensureLive2DExpressionManager(options: {
  createExpressionManager?: Live2DExpressionManagerConstructor | null;
  model: Live2DModelLike;
}) {
  const existingExpressionManager = resolveLive2DExpressionManager(options.model);
  if (existingExpressionManager) {
    return existingExpressionManager;
  }

  const motionManager = options.model.internalModel?.motionManager;
  if (!motionManager || !options.createExpressionManager || !motionManager.settings) {
    return null;
  }

  const expressionManager = new options.createExpressionManager(motionManager.settings);
  (motionManager as Live2DMotionManagerLike).expressionManager = expressionManager;
  return expressionManager;
}

function injectExternalLive2DMotionGroups(options: {
  contentManifest?: PetContentManifest | null;
  model: Live2DModelLike;
  motionBindings?: PetModelMotionBinding[] | null;
}) {
  const { contentManifest = null, model, motionBindings = null } = options;
  const motionManager = model.internalModel?.motionManager;
  if (!motionManager?.definitions || !motionManager.motionGroups) {
    return;
  }

  const externalGroups = resolveLive2DExternalMotionGroups({
    contentManifest,
    motionBindings,
  });
  Object.entries(externalGroups).forEach(([group, definitions]) => {
    if (!definitions.length) {
      return;
    }

    const existingDefinitions = motionManager.definitions[group] ?? [];
    const existingFiles = new Set(existingDefinitions.map((definition) => String(definition.File ?? '')));
    const nextDefinitions = definitions.filter((definition) => !existingFiles.has(definition.File));
    if (nextDefinitions.length === 0) {
      return;
    }

    motionManager.definitions[group] = [...existingDefinitions, ...nextDefinitions];
    motionManager.motionGroups[group] = motionManager.motionGroups[group] ?? [];
  });
}

function injectExternalLive2DExpressions(options: {
  createExpressionManager?: Live2DExpressionManagerConstructor | null;
  model: Live2DModelLike;
  motionBindings?: PetModelMotionBinding[] | null;
}) {
  const externalDefinitions = resolveLive2DExternalExpressionDefinitions({
    motionBindings: options.motionBindings,
  });
  if (externalDefinitions.length === 0) {
    return;
  }

  const expressionManager = ensureLive2DExpressionManager({
    createExpressionManager: options.createExpressionManager,
    model: options.model,
  });
  if (!expressionManager?.definitions || !Array.isArray(expressionManager.expressions)) {
    return;
  }

  const existingDefinitionKeys = new Set(expressionManager.definitions.map((definition) => (
    `${definition.Name ?? definition.name ?? ''}|${definition.File ?? ''}`
  )));
  externalDefinitions.forEach((definition) => {
    const definitionKey = `${definition.Name}|${definition.File}`;
    if (existingDefinitionKeys.has(definitionKey)) {
      return;
    }

    expressionManager.definitions.push(definition);
    expressionManager.expressions.push(undefined);
    existingDefinitionKeys.add(definitionKey);
  });
}

export function syncLive2DModelPresentation(
  model: Live2DModelLike,
  options: Live2DModelPresentationOptions,
  createExpressionManager?: Live2DExpressionManagerConstructor | null,
) {
  const runtimeProfile = resolveLive2DRuntimeProfileForModel(
    model,
    options.live2dRuntimeProfile,
  );
  injectExternalLive2DExpressions({
    createExpressionManager,
    model,
    motionBindings: options.motionBindings,
  });
  injectExternalLive2DMotionGroups({
    contentManifest: options.contentManifest,
    model,
    motionBindings: options.motionBindings,
  });
  fitLive2DModelToStage(model, options.stageSize, runtimeProfile);
  model.visible = options.visible;
}

export async function playFirstAvailableMotion(options: {
  candidates: string[];
  model: Live2DModelLike;
  priority: MotionPriority;
}) {
  const availableCandidates = resolveLive2DAvailableMotionCandidateGroups(options.model, options.candidates);
  for (const motionGroup of availableCandidates) {
    const didStart = await options.model.motion(motionGroup, undefined, options.priority);
    if (didStart) {
      return motionGroup;
    }
  }

  return null;
}

export async function setFirstAvailableExpression(options: {
  candidates: string[];
  model: Live2DModelLike;
}) {
  const expressionManager = resolveLive2DExpressionManager(options.model);
  const availableExpressionDefinitions = expressionManager?.definitions ?? [];
  for (const candidate of options.candidates) {
    const candidateIndex = availableExpressionDefinitions.findIndex((definition) => {
      const expressionName = definition.Name ?? definition.name ?? '';
      return expressionName === candidate;
    });
    if (candidateIndex < 0) {
      continue;
    }

    const expressionName = availableExpressionDefinitions[candidateIndex]?.Name
      ?? availableExpressionDefinitions[candidateIndex]?.name
      ?? candidate;
    const didSet = await options.model.expression(expressionName);
    if (didSet) {
      return expressionName;
    }

    const didSetByIndex = await expressionManager?.setExpression?.(candidateIndex);
    if (didSetByIndex) {
      return expressionName;
    }
  }

  return null;
}

export function resetLive2DExpression(model: Live2DModelLike) {
  const expressionManager = resolveLive2DExpressionManager(model);
  expressionManager?.resetExpression?.();

  if (
    expressionManager
    && 'currentExpression' in expressionManager
    && 'defaultExpression' in expressionManager
  ) {
    expressionManager.currentExpression = expressionManager.defaultExpression;
  }
}

export function stopLive2DMotions(model: Live2DModelLike) {
  model.internalModel?.motionManager?.stopAllMotions?.();
}
