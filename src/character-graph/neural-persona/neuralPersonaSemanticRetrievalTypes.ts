import type { NeuralPersonaNodeType, NeuralPersonaScope } from './neuralPersonaTypes';

export interface NeuralPersonaSemanticDocument {
  nodeId: string;
  scope: NeuralPersonaScope;
  summary: string;
  tagLabels: string[];
  type: NeuralPersonaNodeType;
}

export interface NeuralPersonaSemanticRetrievalRequest {
  documents: NeuralPersonaSemanticDocument[];
  maxResults: number;
  query: string;
  requestId: string;
  roleId: string;
  signal?: AbortSignal;
}

export interface NeuralPersonaSemanticMatch {
  nodeId: string;
  score: number;
}

export type NeuralPersonaSemanticProviderResult =
  | { matches: NeuralPersonaSemanticMatch[]; status: 'ok' }
  | { reason: string; status: 'unavailable' };

export interface NeuralPersonaSemanticRetrievalProvider {
  providerId: string;
  retrieve: (
    request: NeuralPersonaSemanticRetrievalRequest,
  ) => Promise<NeuralPersonaSemanticProviderResult>;
}

export type NeuralPersonaSemanticRetrievalDiagnostic =
  | { providerId: string; status: 'semantic' }
  | { providerId?: string; reason: string; status: 'keyword-fallback' };
