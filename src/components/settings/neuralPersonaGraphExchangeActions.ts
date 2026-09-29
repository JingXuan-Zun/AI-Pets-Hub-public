import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaGraphExchangeService,
  createNeuralPersonaGraphImportPreview,
  createNeuralPersonaGraphRepository,
  type NeuralPersonaGraphExchangeResult,
  type NeuralPersonaGraphImportPreview,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';

function repository() {
  return createNeuralPersonaGraphRepository({
    config: DEFAULT_NEURAL_PERSONA_CONFIG,
    storage: createNeuralPersonaDesktopStorage(),
  });
}

export function previewNeuralPersonaGraphImport(
  record: NeuralPersonaPersistedRecord,
  serialized: string,
): NeuralPersonaGraphImportPreview {
  return createNeuralPersonaGraphImportPreview({
    config: DEFAULT_NEURAL_PERSONA_CONFIG,
    currentRecord: record,
    expectedRevision: record.revision,
    now: Date.now(),
    serialized,
  });
}

export async function commitNeuralPersonaGraphImport(input: {
  confirmProtectedChanges: boolean;
  onResult: (result: NeuralPersonaGraphExchangeResult) => Promise<NeuralPersonaGraphExchangeResult>;
  preview: Extract<NeuralPersonaGraphImportPreview, { status: 'ready' }>;
  roleId: string;
}) {
  const service = createNeuralPersonaGraphExchangeService({ repository: repository() });
  return input.onResult(await service.importGraph({
    commandId: `import-graph:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    confirmProtectedChanges: input.confirmProtectedChanges,
    expectedRevision: input.preview.expectedRevision,
    graph: input.preview.graph,
    roleId: input.roleId,
    sourceRevision: input.preview.sourceRevision,
  }));
}

export function createNeuralPersonaGraphExchangeActions(input: {
  onResult: (result: NeuralPersonaGraphExchangeResult) => Promise<NeuralPersonaGraphExchangeResult>;
  record?: NeuralPersonaPersistedRecord;
  roleId: string;
}) {
  const previewImport = (serialized: string): NeuralPersonaGraphImportPreview => input.record
    ? previewNeuralPersonaGraphImport(input.record, serialized)
    : { expectedRevision: 0, reason: 'graph-not-ready', status: 'invalid' };
  const commitImport = (preview: Extract<NeuralPersonaGraphImportPreview, { status: 'ready' }>, confirmProtectedChanges: boolean) => input.record
    ? commitNeuralPersonaGraphImport({ confirmProtectedChanges, onResult: input.onResult, preview, roleId: input.roleId })
    : Promise.resolve({ reason: 'graph-not-ready', status: 'missing' as const });
  return { commitImport, previewImport };
}
