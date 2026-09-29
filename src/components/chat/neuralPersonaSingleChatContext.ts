import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS,
  buildNeuralContextContribution,
  buildNeuralContextContributionWithSemantic,
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaGraphRepository,
  createReadonlyNeuralPersonaGraphStore,
  resolveNeuralPersonaMode,
  type NeuralContextContribution,
  type NeuralPersonaGraphRepository,
  type NeuralPersonaMode,
  type NeuralPersonaContextInput,
  type NeuralPersonaProviderDataPolicy,
  type ReadonlyNeuralPersonaGraphStore,
  type NeuralPersonaSemanticRetrievalDiagnostic,
  type NeuralPersonaSemanticRetrievalProvider,
  type NeuralPersonaTrace,
} from '../../character-graph/neural-persona';
import type { DesktopPetChatMode } from '../../types';

export type SingleChatNeuralContextResult =
  | { reason: string; status: 'classic' | 'unavailable' }
  | { contribution: NeuralContextContribution; semantic?: NeuralPersonaSemanticRetrievalDiagnostic;
    status: 'neural'; trace: NeuralPersonaTrace };

function runtimeRepository() {
  return createNeuralPersonaGraphRepository({
    config: DEFAULT_NEURAL_PERSONA_CONFIG,
    storage: createNeuralPersonaDesktopStorage(),
  });
}

interface LoadSingleChatNeuralContextOptions {
  chatMode: DesktopPetChatMode;
  featureEnabled: boolean;
  includePrivate?: boolean;
  now?: number;
  promptText: string;
  repository?: Pick<NeuralPersonaGraphRepository, 'load'>;
  requestId: string;
  requestedMode?: NeuralPersonaMode;
  roleId: string;
  semantic?: {
    dataPolicy: NeuralPersonaProviderDataPolicy;
    provider: NeuralPersonaSemanticRetrievalProvider;
    signal?: AbortSignal;
  };
}

function createContextInput(
  options: LoadSingleChatNeuralContextOptions,
  now: number,
): NeuralPersonaContextInput {
  return {
    groupIds: [], includePrivate: options.includePrivate ?? true, now,
    query: options.promptText, requestId: options.requestId, roleId: options.roleId,
    sessionId: `single:${options.roleId}`, subgroupIds: [], turnId: options.requestId,
  };
}

function buildContext(
  options: LoadSingleChatNeuralContextOptions,
  input: NeuralPersonaContextInput,
  store: ReadonlyNeuralPersonaGraphStore,
) {
  return options.semantic
    ? buildNeuralContextContributionWithSemantic({
      config: DEFAULT_NEURAL_PERSONA_CONFIG,
      dataPolicy: options.semantic.dataPolicy,
      input,
      semanticProvider: options.semantic.provider,
      signal: options.semantic.signal,
      store,
    })
    : Promise.resolve(buildNeuralContextContribution({
      config: DEFAULT_NEURAL_PERSONA_CONFIG, input, store,
    }));
}

export async function loadSingleChatNeuralContext(
  options: LoadSingleChatNeuralContextOptions,
): Promise<SingleChatNeuralContextResult> {
  const mode = resolveNeuralPersonaMode(options.requestedMode ?? 'neural', {
    ...DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS,
    enabled: options.featureEnabled,
  });
  if (mode !== 'neural') return { reason: 'feature-disabled-or-classic', status: 'classic' };
  if (options.chatMode !== 'single') return { reason: 'single-chat-only', status: 'classic' };
  try {
    const loaded = await (options.repository ?? runtimeRepository()).load(options.roleId);
    if (loaded.status !== 'ok') return { reason: `graph-${loaded.status}`, status: 'unavailable' };
    const graphStore = createReadonlyNeuralPersonaGraphStore(
      loaded.record.graph,
      DEFAULT_NEURAL_PERSONA_CONFIG,
    );
    if (!graphStore.valid) return { reason: 'graph-invalid', status: 'unavailable' };
    const now = options.now ?? Date.now();
    const built = await buildContext(
      options, createContextInput(options, now), graphStore.store,
    );
    return { ...built, status: 'neural' };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : 'neural-context-load-failed',
      status: 'unavailable',
    };
  }
}
