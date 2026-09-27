import type {
  NeuralPersonaEdge,
  NeuralPersonaEdgeType,
  NeuralPersonaNode,
} from './neuralPersonaTypes';

export const NEURAL_PERSONA_RELATIONSHIP_CANDIDATE_VERSION = (
  'neural-persona-relationship-candidate.v1'
) as const;

export const NEURAL_PERSONA_COGNITIVE_RELATION_TYPES = [
  'associated-with',
  'supports',
  'triggers',
  'inhibits',
  'opposes',
] as const satisfies readonly NeuralPersonaEdgeType[];

export type NeuralPersonaCognitiveRelationType = (
  typeof NEURAL_PERSONA_COGNITIVE_RELATION_TYPES[number]
);

export interface NeuralPersonaRelationshipCandidate {
  candidateId: string;
  confidence: number;
  enabled: boolean;
  origin: 'local' | 'model' | 'user';
  reason: string;
  relationType: NeuralPersonaCognitiveRelationType;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
}

export interface NeuralPersonaRelationshipCandidateBatch {
  batchId: string;
  candidates: NeuralPersonaRelationshipCandidate[];
  generatedAt: number;
  graphVersion: string;
  providerId: string;
  revision: number;
  roleId: string;
  version: typeof NEURAL_PERSONA_RELATIONSHIP_CANDIDATE_VERSION;
}

export interface NeuralPersonaRelationshipCandidateRequest {
  edges: NeuralPersonaEdge[];
  nodes: NeuralPersonaNode[];
  requestId: string;
  roleId: string;
  signal?: AbortSignal;
}

export type NeuralPersonaRelationshipCandidateProviderResult =
  | { candidates: unknown; status: 'ok' }
  | { reason: string; status: 'unavailable' };

export interface NeuralPersonaRelationshipCandidateProvider {
  generate: (
    request: NeuralPersonaRelationshipCandidateRequest,
  ) => Promise<NeuralPersonaRelationshipCandidateProviderResult>;
  providerId: string;
}

export type NeuralPersonaRelationshipCandidateGenerationResult =
  | { batch: NeuralPersonaRelationshipCandidateBatch; status: 'ok' }
  | { reason: string; status: 'invalid' | 'unavailable' };
